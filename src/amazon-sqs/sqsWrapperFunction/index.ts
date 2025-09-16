import { SendMessageCommand, SQSClient } from '@aws-sdk/client-sqs';
import config from '../../config/config';

const sqs = new SQSClient({ region: config.aws.region });

export async function queueSQSNotification(message: any) {
  return sqs.send(
    new SendMessageCommand({
      QueueUrl: config.sqsQueueUrl,
      MessageBody: JSON.stringify(message),
    })
  );
}
