import { Context } from 'aws-lambda';
import { getS3Objects, S3Record } from './service';

/**
 * Retrieve S3 Objects in batches
 * @param event
 * @param context
 * @returns
 */
export async function handler(event: any, context: Context): Promise<string> {
    try {
        console.log(`event ${JSON.stringify(event, null, 2)}`);
        const response: Array<S3Record> = await getS3Objects(event);
        console.log(`response ${JSON.stringify(response, null, 2)}`);
        return JSON.stringify(response);
    } catch (error) {
        console.log(error);
        throw error;
    }
}
