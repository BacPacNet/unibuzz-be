import { SendMessageBatchCommand, SQSClient } from '@aws-sdk/client-sqs';
import { v4 as uuidv4 } from 'uuid';
import config from '../../config/config';

const sqs = new SQSClient({ region: config.aws.region });

export async function queueSQSNotificationBatch(messages: any[]) {
  if (!messages.length) return;

  const entries = messages.map((msg) => {
    const notificationWithId = {
      ...msg,
      uuid: msg.uuid || uuidv4(),
    };

    return {
      Id: notificationWithId.uuid, // required by SQS batch
      MessageBody: JSON.stringify(notificationWithId),
      MessageAttributes: {
        timestamp: {
          DataType: 'String',
          StringValue: new Date().toISOString(),
        },
        messageType: {
          DataType: 'String',
          StringValue: msg.type,
        },
        uniqueId: {
          DataType: 'String',
          StringValue: notificationWithId.uuid,
        },
      },
    };
  });

  try {
    console.log(`📤 Sending batch of ${entries.length} messages to SQS...`);

    const result = await sqs.send(
      new SendMessageBatchCommand({
        QueueUrl: config.sqsQueueUrl,
        Entries: entries,
      })
    );

    if (result.Failed && result.Failed.length > 0) {
      console.error('❌ Some messages failed to send:', result.Failed);
    } else {
      console.log('✅ All messages sent successfully');
    }

    return result;
  } catch (error) {
    console.error('❌ Failed to send SQS batch:', error);
    throw error;
  }
}
