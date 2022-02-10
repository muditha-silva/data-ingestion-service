# Solution Overview

## Architecture

The following diagram shows the data ingestion architecture.

![image info](images/architecture.jpg)

The proposed solution is a production-ready AWS fully managed scalable serverless solution.

### AWS Services

-   `S3` for Object store
-   `Serverless Aurora PostgreSQL` as Back End
-   `SQS` for buffering S3 Object Create events
-   `Lambda Function (sqs-event-listener-lambda)` Batch process events using Lambda event source configurations (Batch Size and Batch Window). Trigger State Machine execution and pass event batches as input for Lambda code [here](./src/sqs-event-listener-lambda.ts)

-   `Step Function` process S3 Object Create events in batches, retrieve the S3 Objects, and ingest data into PostgreSQL.

    -   Batch Process S3 Lambda code [here](./src/s3-messages-retrieval-lambda.ts)
    -   Batch Ingest Data Lambda code [here](./src/rds-message-ingestion-lambda.ts)

-   `CDK` for Infrastructure provisioning and deployment code [here](./lib/project-stack.ts)

### Programming Language

-   TypeScript

## Getting started

### prerequisite

-   An AWS account
-   AWS CLI configured
-   Node.js 14+

To deploy this project, follow these steps.

### Clone the project

```
git clone https://github.com/muditha-silva/data-ingestion-service.git
```

### Install dependencies

```
> npm install
```

### Run the build

```
> npm run build
```

### Deployment Stack Configurations.

Default stack configurations can find here [here](./etc/default.json).

**_Important_**

-   Change the 'RawDataBucketName' for a unique s3 bucket name. Please note that Bucket name is suffixed with {aws-region}. For this senario **_raw-data-lake-dev-eu-west-1_**
-   Lambda SQS event source mapping configurations for Batch Size and Batch Window (in minutes)
    -   `"SQSBatchSize":"100"`
    -   `"SQSBatchWindow":"1"`

### Deploy the stack

Install the CDK globally

```
> npm install -g cdk
```

This stack uses **_assets_**, therefore the toolkit stack (CDKToolkit) therefore the toolkit stack (CDKToolkit) must deploy to the environment if it does not exist.

```
> cdk bootstrap aws://{aws-account}/{aws-region}
```

```
> cdk deploy
```

### Create the raw_data table

Visit the RDS dashboard and click on Query Editor. From the dropdown menu, choose the database (it should begin with `dataingestionservice-auroradatacluster`).

For the Database username, choose Connect with a Secrets Manager ARN.

To sign in, you will need the ARN from the secret that was created by CDK. To get this secret, in a new window open AWS Secrets manager. Here, click on the secret that was created by CDK (it should start with `AuroraDataClusterSecret`). Copy the Secret ARN to your clipboard and go back to the RDS Query Editor.

Next, use the Secret ARN as the Secrets Manager ARN and RawDataDB as the name of the database. Next, press enter and click on Connect to Database.

Once signed in, create the posts table by executing the following query:

```
    CREATE TABLE raw_data (
    id TEXT NOT NULL PRIMARY KEY,
    data JSONB,
    createDate TEXT NOT NULL
    );
```

**_Table Design_**

-   `data` column, JSONB data type is used for storing JSON data which supports querying, filtering, and indexing JSON data.
-   `createDate` column, if date-specific partitioning is required, create an index.

### Testing

Upload batch of files into s3 raw data bucket.

![image info](images/s3-bucket.png)

State Machine Execution

![image info](images/state-machine.png)

Query Data

![image info](images/query-editor-1.png)

![image info](images/qurey-results.png)
