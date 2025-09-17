import { SendMessageCommand, SQSClient } from '@aws-sdk/client-sqs';
import config from '../../config/config';

const sqs = new SQSClient({ region: config.aws.region });

export async function queueSQSNotification(message: any) {
  try {
    console.log('📤 Sending message to SQS...', {
      queueUrl: config.sqsQueueUrl,
      messageType: message.type,
      timestamp: new Date().toISOString(),
      isFifoQueue: config.sqsQueueUrl.endsWith('.fifo'),
      awsRegion: config.aws.region,
    });

    const result = await sqs.send(
      new SendMessageCommand({
        QueueUrl: config.sqsQueueUrl,
        MessageBody: JSON.stringify(message),
        MessageAttributes: {
          timestamp: {
            DataType: 'String',
            StringValue: new Date().toISOString(),
          },
          messageType: {
            DataType: 'String',
            StringValue: message.type,
          },
          uniqueId: {
            DataType: 'String',
            StringValue: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
          },
        },
      })
    );

    console.log('✅ Message sent to SQS successfully', {
      messageId: result.MessageId,
      md5OfBody: result.MD5OfMessageBody,
      timestamp: new Date().toISOString(),
      responseMetadata: result.$metadata,
    });

    // 🔄 Removed: triggerImmediatePoll logic
    // Worker will pick it up on next long poll automatically

    return result;
  } catch (error) {
    console.error('❌ Failed to send SQS message:', error);
    throw error;
  }
}
