import { Schema } from 'mongoose';

interface Like {
  userId: string;
}
interface communityPostCommentsInterface {
  postId: Schema.Types.ObjectId;
  commenterId: Schema.Types.ObjectId;
  commenterProfileId: Schema.Types.ObjectId;
  content: string;
  likeCount: Like[];
  imageUrl?: { imageUrl: String; publicId: String };
  replies: [Schema.Types.ObjectId];
  level: number;
  isCommentVerified: boolean;
}

/** Request body for creating a top-level community post comment */
export interface CreateCommentBody {
  commenterProfileId: string;
  adminId: string;
  content?: string;
  imageUrl?: Array<{ imageUrl?: string; publicId?: string }>;
}

/** Payload for updating a community post comment (supports imageurl for API backward compatibility) */
export interface UpdateCommentPayload {
  content?: string;
  imageUrl?: Array<{ imageUrl?: string; publicId?: string }>;
  imageurl?: Array<{ imageUrl?: string; publicId?: string }>;
}

/** Request body for replying to a community post comment */
export interface CommentReplyBody {
  postID: string;
  commenterProfileId: string;
  content?: string;
  imageUrl?: Array<{ imageUrl?: string; publicId?: string }>;
}

/** Reply document shape when populated (e.g. in getPostCommentById nested replies) */
export interface PopulatedCommentReply {
  _id?: unknown;
  replies?: PopulatedCommentReply[];
  [key: string]: unknown;
}

/** Result of populateNestedReplies */
export interface PopulatedRepliesResult {
  populatedReplies: PopulatedCommentReply[];
  totalCount: number;
}

export { communityPostCommentsInterface };
