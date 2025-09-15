import mongoose from 'mongoose';
import { SQSClient, ReceiveMessageCommand, DeleteMessageCommand, GetQueueAttributesCommand } from '@aws-sdk/client-sqs';
import config from '../../config/config';
import { handleFollowNotification, handleLikeNotification, handleCommentNotification } from '../handlers';
import logger from '../../modules/logger/logger';

const sqs = new SQSClient({ region: config.aws.region });

let isWorkerRunning = false;
let workerInterval: NodeJS.Timeout | null = null;

async function testSQSConnection() {
  try {
    logger.info('🔍 Testing SQS connection...');

    const response = await sqs.send(
      new GetQueueAttributesCommand({
        QueueUrl: config.sqsQueueUrl,
        AttributeNames: ['ApproximateNumberOfMessages', 'ApproximateNumberOfMessagesNotVisible'],
      })
    );

    logger.info('✅ SQS connection successful');
    logger.info('📊 Queue status:', {
      approximateMessages: response.Attributes?.ApproximateNumberOfMessages || '0',
      approximateInFlight: response.Attributes?.ApproximateNumberOfMessagesNotVisible || '0',
    });

    return true;
  } catch (err) {
    logger.error('❌ SQS connection failed:', err);
    return false;
  }
}

async function dispatchNotification(data: any) {
  logger.info('dispatchNotification', data);
  switch (data.type) {
    case 'follow_notification':
      return handleFollowNotification(data);
    case 'like_notification':
      return handleLikeNotification(data);
    case 'comment_notification':
      return handleCommentNotification(data);
    default:
      logger.warn('⚠️ Unknown notification type:', data.type);
  }
}

async function processMessages() {
  try {
    const response = await sqs.send(
      new ReceiveMessageCommand({
        QueueUrl: config.sqsQueueUrl,
        MaxNumberOfMessages: 5,
        WaitTimeSeconds: 10,
      })
    );

    if (response.Messages && response.Messages.length > 0) {
      for (const message of response.Messages) {
        try {
          const body = JSON.parse(message.Body!);

          await dispatchNotification(body);

          //  Delete message only after successful handling
          await sqs.send(
            new DeleteMessageCommand({
              QueueUrl: config.sqsQueueUrl,
              ReceiptHandle: message.ReceiptHandle!,
            })
          );

          logger.info('✅ Message processed and deleted successfully');
        } catch (err) {
          logger.error('❌ Failed to process message:', err);
        }
      }
    } else {
      logger.info('📭 No messages in queue');
    }
  } catch (err) {
    logger.error('❌ Polling error:', err);
  }

  // Continue polling if worker is still running
  if (isWorkerRunning) {
    setImmediate(processMessages);
  }
}

export async function startSQSWorker() {
  if (isWorkerRunning) {
    logger.warn('SQS Worker is already running');
    return;
  }

  if (!config.sqsQueueUrl) {
    logger.warn('⚠️ SQS_QUEUE_URL not configured. SQS Worker will not start.');
    return;
  }

  if (!config.aws.accessKeyId || !config.aws.secretAccessKey || !config.aws.region) {
    logger.warn('⚠️ AWS credentials not configured. SQS Worker will not start.');
    logger.warn('Required: AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY, AWS_REGION');
    return;
  }

  logger.info('🚀 Starting SQS Worker...');

  // Test SQS connection first
  const connectionTest = await testSQSConnection();
  if (!connectionTest) {
    logger.error('❌ Failed to connect to SQS. Worker will not start.');
    return;
  }

  isWorkerRunning = true;

  // Start the polling loop
  processMessages();

  logger.info('✅ SQS Worker started successfully');
}

export function stopSQSWorker() {
  if (!isWorkerRunning) {
    logger.warn('SQS Worker is not running');
    return;
  }

  isWorkerRunning = false;
  logger.info('🛑 Stopping SQS Worker...');

  if (workerInterval) {
    clearInterval(workerInterval);
    workerInterval = null;
  }

  logger.info('✅ SQS Worker stopped successfully');
}

// For backward compatibility - only run if this file is executed directly
if (process.argv[1] && process.argv[1].endsWith('worker/index.js')) {
  mongoose.connect(config.mongoose.url).then(async () => {
    logger.info('✅ MongoDB connected (Worker)');
    await startSQSWorker();
  });
}
