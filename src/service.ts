import { partitionRecords, getObject, batchInsert, ParamType } from './utils';

const currentDate: string = new Date().toISOString().split('T')[0];

export async function ingestData(s3Records: S3Record[]) {
    const partitionedS3Records: S3Record[][] = partitionRecords(s3Records);
    await Promise.all(
        partitionedS3Records.map(async (s3RecordBatch: S3Record[]) => {
            await ingestDataBatch(s3RecordBatch);
        })
    );
}

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

export async function getS3Objects(s3Keys: string[]): Promise<Array<S3Record>> {
    const s3Records: Array<S3Record> = new Array<S3Record>();
    const partitionedS3Keys: string[][] = partitionRecords(s3Keys);
    for (const partitionedList of partitionedS3Keys) {
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
