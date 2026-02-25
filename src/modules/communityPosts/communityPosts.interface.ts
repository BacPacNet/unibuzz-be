import mongoose, { Schema } from 'mongoose';
import { communityPostStatus, CommunityType } from '../../config/community.type';
import { communityGroupInterface } from '../communityGroup/communityGroup.interface';
import { BlockedUserEntry } from '../userProfile/userProfile.interface';

interface Like {
  userId: string;
}
interface image {
  imageUrl: String;
  publicId: String;
}

interface communityPostsInterface {
  communityId: Schema.Types.ObjectId;
  communityGroupId: Schema.Types.ObjectId;
  content: string;
  user_id: Schema.Types.ObjectId;
  imageUrl?: image[];
  likeCount: Like[];
  communityPostsType: CommunityType;
  isPostVerified: boolean;
  communityName: string;
  communityGroupName: string;
  isPostLive: boolean;
  postStatus: communityPostStatus;
}
/** Community group with only title and adminUserId (from findOne select) */
type CommunityGroupTitleAdmin = Pick<communityGroupInterface, 'title' | 'adminUserId'>;

/** Notification document with communityGroupId populated (has title) */
interface NotificationWithPopulatedCommunityGroup {
  communityGroupId: { _id: mongoose.Types.ObjectId; title: string };
}

/** User profile lean result when only blockedUsers is selected */
type UserProfileBlockedUsers = { blockedUsers?: BlockedUserEntry[] } | null;


export { communityPostsInterface, CommunityGroupTitleAdmin, NotificationWithPopulatedCommunityGroup, UserProfileBlockedUsers };
