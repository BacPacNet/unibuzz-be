import { openai } from '../../app';
import config from '../../config/config';

async function runAssistant(threadId: string) {
  console.log('Running assistant for thread: ' + threadId);
  const response = await (openai as any).beta.threads.runs.create(threadId, {
    assistant_id: config.ASSISTANT_ID,
    // Make sure to not overwrite the original instruction, unless you want to
  });

  console.log(response);

  return response;
}

async function checkingStatus(threadId: string, runId: string): Promise<any[]> {
  return new Promise((resolve, reject) => {
    const pollingInterval = setInterval(async () => {
      try {
        const runObject = await (openai as any).beta.threads.runs.retrieve(threadId, runId);
        const status = runObject.status;
        console.log('Current status: ' + status);

        if (status === 'completed') {
          clearInterval(pollingInterval);

          const messagesList: any = await (openai as any).beta.threads.messages.list(threadId);
          const messages: any[] = messagesList.body.data.map((message: { content: any }) => message.content);

          console.log('messages', messages);
          resolve(messages);
        }
      } catch (error) {
        clearInterval(pollingInterval);
        reject(error);
      }
    }, 5000);
  });
}

export const addMessageService = async (threadId: string, message: string): Promise<any[]> => {
  console.log('Adding a new message to thread: ' + threadId);

  await openai.beta.threads.messages.create(threadId, {
    role: 'user',
    content: message,
  });

  const run = await runAssistant(threadId);
  const runId = run.id;

  // Wait for the status to become "completed" and return the messages
  return checkingStatus(threadId, runId);
};
