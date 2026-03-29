import { PipelineStage, Types } from 'mongoose';

/**
 * Builds the aggregation pipeline for unread message count per user across chats.
 * Strategy: match messages in given chats, sort by createdAt desc (newest first), group by chat
 * and push each message's readByUsers. Then for each chat, reduce over messages: count
 * consecutive messages from newest until the first one where the user is in readByUsers (stop).
 * Finally sum these per-chat unread counts into totalUnread.
 */
export function getUnreadMessagesCountPipeline(
  chatIds: Types.ObjectId[],
  userObjectId: Types.ObjectId
): PipelineStage[] {
  return [
    { $match: { chat: { $in: chatIds } } },
    { $sort: { createdAt: -1 } },
    {
      $group: {
        _id: '$chat',
        msgs: { $push: { readByUsers: '$readByUsers' } },
      },
    },
    {
      $project: {
        _id: 0,
        unreadCount: {
          $let: {
            vars: { uid: userObjectId },
            in: {
              $reduce: {
                input: '$msgs',
                initialValue: { count: 0, stop: false },
                in: {
                  $cond: [
                    '$$value.stop',
                    '$$value',
                    {
                      $cond: [
                        { $in: ['$$uid', '$$this.readByUsers'] },
                        { count: '$$value.count', stop: true },
                        { count: { $add: ['$$value.count', 1] }, stop: false },
                      ],
                    },
                  ],
                },
              },
            },
          },
        },
      },
    },
    { $group: { _id: null, totalUnread: { $sum: '$unreadCount.count' } } },
  ];
}
