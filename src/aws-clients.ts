import { S3Client } from '@aws-sdk/client-s3';

export const dataClient = require('data-api-client')({
    secretArn: process.env.SECRET_ARN,
    resourceArn: process.env.CLUSTER_ARN,
    database: process.env.DB_NAME
});

export const s3Client = new S3Client({ region: 'eu-west-1' });
