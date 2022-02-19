import { Construct, Stack, StackProps, RemovalPolicy } from '@aws-cdk/core';
import { Function, Runtime, Code } from '@aws-cdk/aws-lambda';
import { Duration } from '@aws-cdk/core';
import { Chain, StateMachine } from '@aws-cdk/aws-stepfunctions';
import { LambdaInvoke } from '@aws-cdk/aws-stepfunctions-tasks';
import { Bucket, EventType } from '@aws-cdk/aws-s3';
import { Queue } from '@aws-cdk/aws-sqs';
import { SqsEventSource } from '@aws-cdk/aws-lambda-event-sources';
import { SqsDestination } from '@aws-cdk/aws-s3-notifications';
import { Role, ServicePrincipal, PolicyDocument, PolicyStatement, Effect } from '@aws-cdk/aws-iam';
import { Vpc } from '@aws-cdk/aws-ec2';
import { ServerlessCluster, DatabaseClusterEngine, ParameterGroup } from '@aws-cdk/aws-rds';

const RUNTIME_DURATION: number = 5; // in minutes

export class ProjectStack extends Stack {
    protected id: string;

    constructor(scope: Construct, id: string, props?: StackProps) {
        super(scope, id, props);
        this.id = id;
        /**
         * SQS queue
         */
        const queue = new Queue(this, `${id}-s3-event-notification-queue`, {
            queueName: 's3-event-notification-queue',
            visibilityTimeout: Duration.minutes(RUNTIME_DURATION),
            deliveryDelay: Duration.seconds(1),
            receiveMessageWaitTime: Duration.seconds(1)
        });

        /**
         * S3 Bucket
         */
        const s3BucketName = scope.node.tryGetContext('RawDataBucketName');
        const rawDataBucket = new Bucket(this, `${id}-raw-data-bucket`, {
            bucketName: `${s3BucketName}-${this.region}`
        });

        rawDataBucket.addEventNotification(EventType.OBJECT_CREATED, new SqsDestination(queue), {
            suffix: '.json'
        });

        /**
         * Serverless Aurora PostgreSQL
         */
        const dbName = scope.node.tryGetContext('DataBaseName');
        // Create the VPC needed for the Aurora Serverless DB cluster
        const vpc = new Vpc(this, `${id}-data-ingestion-vpc`);
        // Create the Serverless Aurora DB cluster; set the engine to Postgres
        const cluster = new ServerlessCluster(this, 'AuroraDataCluster', {
            engine: DatabaseClusterEngine.AURORA_POSTGRESQL,
            parameterGroup: ParameterGroup.fromParameterGroupName(
                this,
                'ParameterGroup',
                'default.aurora-postgresql10'
            ),
            defaultDatabaseName: dbName,
            vpc,
            scaling: { autoPause: Duration.seconds(0) } // Optional. If not set, then instance will pause after 5 minutes
        });

        /**
         * IAM role for Step Function Lambda
         */
        const stepFunctionLambdaRole = new Role(this, id, {
            assumedBy: new ServicePrincipal('lambda.amazonaws.com'),
            inlinePolicies: {
                lambdaPolicy: new PolicyDocument({
                    statements: [
                        new PolicyStatement({
                            effect: Effect.ALLOW,
                            actions: ['lambda:InvokeFunction'],
                            resources: [`arn:aws:lambda:${this.region}:${this.account}:function:*`]
                        }),
                        new PolicyStatement({
                            effect: Effect.ALLOW,
                            actions: ['s3:GetObject'],
                            resources: [`arn:aws:s3:::${rawDataBucket.bucketName}/*`]
                        }),
                        new PolicyStatement({
                            effect: Effect.ALLOW,
                            actions: ['logs:*'],
                            resources: [`arn:aws:logs:${this.region}:${this.account}:log-group:*`]
                        })
                    ]
                })
            },
            roleName: 'step-function-lambda-role'
        });

        const lambdaCommonProps = {
            code: Code.fromAsset('build'),
            timeout: Duration.minutes(RUNTIME_DURATION),
            memorySize: 1024,
            runtime: Runtime.NODEJS_14_X
        };

        const stepFunctionLambdaCommonEnvProps = {
            CLUSTER_ARN: cluster.clusterArn,
            SECRET_ARN: cluster.secret?.secretArn || '',
            DB_NAME: dbName,
            TABLE_NAME: scope.node.tryGetContext('RawDataTableName'),
            AWS_NODEJS_CONNECTION_REUSE_ENABLED: '1'
        };

        /**
         * S3 objectrRetrieval Lambda
         */
        const s3MessageRetrieverLambda = new Function(this, `${id}-s3-message-retrieval-function`, {
            ...lambdaCommonProps,
            functionName: 's3-message-retrieval-lambda',
            handler: 's3-messages-retrieval-lambda.handler',
            role: stepFunctionLambdaRole,
            environment: {
                ...stepFunctionLambdaCommonEnvProps,
                RAW_BUCKET_NAME: rawDataBucket.bucketName
            }
        });

        /**
         * PostgreSQL data ingestion Lambda
         */
        const auroraMessageIngestionLambda = new Function(this, `${id}-aurora-message-ingestion-function`, {
            ...lambdaCommonProps,
            functionName: 'aurora-message-ingestion-lambda',
            handler: 'aurora-message-ingestion-lambda.handler',
            role: stepFunctionLambdaRole,
            environment: stepFunctionLambdaCommonEnvProps
        });

        cluster.grantDataApiAccess(auroraMessageIngestionLambda);

        const s3MessageRretriever = new LambdaInvoke(this, 's3 message retriever', {
            lambdaFunction: s3MessageRetrieverLambda
        });

        const ddbMessageIngester = new LambdaInvoke(this, 'aurora message ingester', {
            lambdaFunction: auroraMessageIngestionLambda
        });

        const chain = Chain.start(s3MessageRretriever).next(ddbMessageIngester);

        /**
         * State Machine definition
         */
        const stateMachine = new StateMachine(this, 'message-ingestion-state-machine', {
            definition: chain,
            stateMachineName: 'message-ingestion-state-machine'
        });

        /**
         * SQS event source Lambda
         */
        const sqsEventListnerLambda = new Function(this, `${id}-sqs-event-listener-function`, {
            ...lambdaCommonProps,
            functionName: 'sqs-event-listener',
            handler: 'sqs-event-listener-lambda.handler',
            environment: {
                STATE_MACHINE_ARN: stateMachine.stateMachineArn
            }
        });

        const invokeStateMachinePolicy = new PolicyStatement({
            actions: ['states:StartExecution'],
            effect: Effect.ALLOW,
            resources: [`arn:aws:states:${this.region}:${this.account}:stateMachine:message-ingestion-state-machine`]
        });

        sqsEventListnerLambda.addToRolePolicy(invokeStateMachinePolicy);

        sqsEventListnerLambda.addEventSource(
            new SqsEventSource(queue, {
                batchSize: 1000,
                maxBatchingWindow: Duration.minutes(1)
            })
        );
    }
}
