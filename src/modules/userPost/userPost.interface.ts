import mongoose, { Schema } from 'mongoose';
import { userPostType } from '../../config/community.type';
import { UserCommunities } from '../userProfile/userProfile.interface';
import { getUserPostCommentCountBySubpipelineStages, ProfileAlias, UserAlias } from './userPost.pipeline';

interface Like {
  userId: string;
}

interface userPostInterface {
  user_id: Schema.Types.ObjectId;
  content: string;
  imageUrl?: { imageUrl: String; publicId: String }[];
  likeCount: Like[];
  PostType: userPostType;
}



const POST_RELATIONSHIP_TYPE_USER = 'user';
const POST_RELATIONSHIP_TYPE_COMMUNITY = 'community';
const POST_RELATIONSHIP_TYPE_GROUP = 'group';
const NOTIFICATION_MESSAGE_REACTED_TO_POST = 'Reacted to your Post.';


interface BlockedUserRef {
  userId: mongoose.Types.ObjectId;
}

interface FollowingOrFollowerRef {
  userId: mongoose.Types.ObjectId;
}

interface TimelineProfileLean {
  following: FollowingOrFollowerRef[];
  communities: UserCommunities[];
  blockedUsers?: BlockedUserRef[];
}

interface PostRelationshipLean {
  type: string;
  userPostId?: mongoose.Types.ObjectId;
  communityPostId?: mongoose.Types.ObjectId;
}

type RelationshipOrQueryItem =
  | { type: string; userId: { $in: string[] } }
  | { type: string; communityId: { $in: string[] } }
  | { type: string; communityGroupId: { $in: mongoose.Types.ObjectId[] } };

interface TimelinePostItem {
  createdAt?: Date;
}

type UserPostCommentStageOptions = Parameters<typeof getUserPostCommentCountBySubpipelineStages>[0];

interface UserPostLookupStageOptions {
  viewerUserId?: string | null;
  blockedUserIds: mongoose.Types.ObjectId[];
  commentStageOptions: UserPostCommentStageOptions;
  aliases?: {
    user: UserAlias;
    profile: ProfileAlias;
  };
  lookupPreserveNull?: {
    user?: boolean;
    profile?: boolean;
  };
  userRefForVerified?: string;
  profileCommunitiesPosition?: 'beforeFilters' | 'afterFilters';
}

/** Profile shape needed to compute following/followers/mutual IDs. */
interface ProfileFollowingFollowers {
  following?: Array<{ userId: unknown }>;
  followers?: Array<{ userId: unknown }>;
}


type PaginationQuery = {
  page?: string;
  limit?: string;
};

type GetAllUserPostsQuery = PaginationQuery & {
  userId?: string;
};

export { userPostInterface, POST_RELATIONSHIP_TYPE_USER, POST_RELATIONSHIP_TYPE_COMMUNITY,
   POST_RELATIONSHIP_TYPE_GROUP, NOTIFICATION_MESSAGE_REACTED_TO_POST, BlockedUserRef, FollowingOrFollowerRef,
    TimelineProfileLean, PostRelationshipLean, RelationshipOrQueryItem, TimelinePostItem, UserPostLookupStageOptions,
     ProfileFollowingFollowers ,GetAllUserPostsQuery};
