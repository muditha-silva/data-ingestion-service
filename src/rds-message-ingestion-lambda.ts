import { Context } from 'aws-lambda';
import { ingestData, S3Record } from './service';

export async function handler(event: any, context: Context) {
    try {
        const { Payload } = JSON.parse(JSON.stringify(event));
        const s3Records: Array<S3Record> = JSON.parse(Payload);
        await ingestData(s3Records);
    } catch (error) {
        console.log(error);
        throw error;
    }
}
