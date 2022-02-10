import { dataClient, s3Client } from './aws-clients';
import { GetObjectCommand } from '@aws-sdk/client-s3';
import { Readable } from 'stream';
import * as getStream from 'get-stream';

const tableName = process.env.TABLE_NAME as string;
const rawBucket = process.env.RAW_BUCKET_NAME as string;

export const partitionRecords = <T>(records: T[], batchSize: number = 10) =>
    records.reduce((chunks: T[][], record: T, index) => {
        const chunk = Math.floor(index / batchSize);
        chunks[chunk] = ([] as T[]).concat(chunks[chunk] || [], record);
        return chunks;
    }, []);

export async function getObject(key: string): Promise<string> {
    let body: string = '';
    const command = new GetObjectCommand({
        Bucket: rawBucket,
        Key: key
    });
    try {
        const { Body } = await s3Client.send(command);
        const bodyContent = await getStream.buffer(Body as Readable);
        body = bodyContent?.toString() ?? '';
    } catch (error) {
        console.log(error);
    }
    return body;
}

export async function batchInsert(params: Array<Array<ParamType>>) {
    try {
        await dataClient.query(`INSERT INTO ${tableName} (id,data,createDate) VALUES(:id,:data,:createDate)`, params);
    } catch (error) {
        console.log(error);
    }
}

export type ParamType = {
    name: string;
    value: string;
    cast?: string;
};
