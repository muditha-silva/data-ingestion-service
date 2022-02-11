import { partitionRecords, getObject, batchInsert, ParamType } from './utils';

const currentDate: string = new Date().toISOString().split('T')[0];

/**
 * Ingest S3 data in batches
 * @param s3Records
 */
export async function ingestData(s3Records: S3Record[]) {
    /**
     * Partition records into batchers (default batch size 10)
     */
    const partitionedS3Records: S3Record[][] = partitionRecords(s3Records);
    /**
     * Parallelly execute the batch
     */
    await Promise.all(
        partitionedS3Records.map(async (s3RecordBatch: S3Record[]) => {
            await ingestDataBatch(s3RecordBatch);
        })
    );
}

/**
 * Batch Insert data into Aurora PostgreSQL
 * @param s3Records S3 key as 'key' S3 data as 'value'
 */
async function ingestDataBatch(s3Records: S3Record[]) {
    const params: Array<Array<ParamType>> = new Array<Array<ParamType>>();
    for (const s3Record of s3Records) {
        const param: Array<ParamType> = new Array<ParamType>();
        param.push(
            { name: 'id', value: s3Record.key },
            { name: 'data', value: s3Record.value, cast: 'jsonb' },
            { name: 'createDate', value: currentDate }
        );
        params.push(param);
    }
    await batchInsert(params);
}

/**
 * Retrieve S3 objects in batches
 * @param s3Keys
 * @returns
 */
export async function getS3Objects(s3Keys: string[]): Promise<Array<S3Record>> {
    const s3Records: Array<S3Record> = new Array<S3Record>();
    /**
     * Partition records into batchers (default batch size 10)
     */
    const partitionedS3Keys: string[][] = partitionRecords(s3Keys);
    for (const partitionedList of partitionedS3Keys) {
        /**
         * Parallelly execute the batch
         */
        await Promise.all(
            partitionedList.map(async (s3Key: string) => {
                const body = await getObject(s3Key);
                if (body) {
                    const s3Record: S3Record = {
                        key: s3Key,
                        value: body
                    };
                    s3Records.push(s3Record);
                }
            })
        );
    }
    return s3Records;
}

export type S3Record = { [key: string]: string };
