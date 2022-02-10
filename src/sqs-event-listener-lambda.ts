import { Context, SQSEvent, SQSRecord } from 'aws-lambda';
import { SFNClient, StartExecutionCommand } from '@aws-sdk/client-sfn';

const client = new SFNClient({ region: 'eu-west-1' });

export async function handler(event: SQSEvent, context: Context) {
    try {
        console.log(`event ${JSON.stringify(event, null, 2)}`);
        const s3Keys: Array<string> = new Array<string>();
        for (const record of event.Records) {
            const bodyJson = JSON.parse(record.body);
            console.log(`body ${JSON.stringify(bodyJson, null, 2)}`);
            for (const record of bodyJson.Records) {
                s3Keys.push(record.s3.object.key);
            }
        }
        const command = new StartExecutionCommand({
            input: JSON.stringify(s3Keys),
            stateMachineArn: process.env.STATE_MACHINE_ARN
        });
        return await client.send(command);
    } catch (error) {
        console.log(error);
        throw error;
    }
}
