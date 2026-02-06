import { Schema, Types } from 'mongoose';

export enum Sortby {
  ASC = 'asc',
  DESC = 'desc',
}

interface Like {
  userId: string;
}
interface userPostCommentsInterface {
  userPostId: Schema.Types.ObjectId;
  commenterId: Schema.Types.ObjectId;
  commenterProfileId: Schema.Types.ObjectId;
  content: string;
  likeCount: Like[];
  imageUrl?: { imageUrl: String; publicId: String };
  replies: [Schema.Types.ObjectId];
  level: number;
}


 interface CreateCommentBody {
  content?: string;
  imageUrl?: string;
}

 interface UpdateCommentBody {
  content?: string;
  imageUrl?: string;
  imageurl?: string;
}

/** Shape of blockedUsers items from UserProfile.lean() (FlattenMaps compatible) */
interface BlockedUserRef {
  userId: unknown;
}

interface PopulatedReplyWithReplies {
  replies?: Schema.Types.ObjectId[] | PopulatedReplyWithReplies[];
  [key: string]: unknown;
}
/** Result shape of createUserPostComment (enriched comment with userPost) used in controller. */
export interface CreateUserPostCommentResult {
  _id: Types.ObjectId;
  userPostId: {
    user_id: Types.ObjectId;
    _id: Types.ObjectId;
  };
}

/** Result shape of commentReply (enriched parent comment) used in controller. */
export interface CommentReplyResult {
  _id: Types.ObjectId;
  commenterId: { _id: Types.ObjectId };
  userPostId: { _id: Types.ObjectId };
}

export { userPostCommentsInterface, CreateCommentBody, UpdateCommentBody, PopulatedReplyWithReplies, BlockedUserRef };
