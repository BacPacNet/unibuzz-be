import { SQSNotificationModel } from '../../modules/sqsNotification';

export async function handleFollowNotification(data: any) {
  const doc = await SQSNotificationModel.create({
    sender_id: data.sender_id,
    receiverId: data.receiverId,
    type: 'FOLLOW',
    message: 'Started following you',
  });
  console.log('📌 Follow notification created:', doc._id);
  return doc;
}

export async function handleLikeNotification(data: any) {
  const doc = await SQSNotificationModel.create({
    sender_id: data.sender_id,
    receiverId: data.receiverId,
    type: 'LIKE',
    message: 'Liked your post',
  });
  console.log('👍 Like notification created:', doc._id);
  return doc;
}

export async function handleCommentNotification(data: any) {
  const doc = await SQSNotificationModel.create({
    sender_id: data.sender_id,
    receiverId: data.receiverId,
    type: 'COMMENT',
    message: 'Commented on your post',
  });
  console.log('💬 Comment notification created:', doc._id);
  return doc;
}
