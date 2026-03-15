import mongoose from 'mongoose';

export interface media {
  imageUrl: String;
  publicId: String;
}

interface users {
  userId: mongoose.Types.ObjectId;
  isRequestAccepted: boolean;
  isStarred?: boolean;
}
interface Message {
  _id: string;
  chat: string;
  content: string;
  createdAt: Date;
  updatedAt: Date;
  sender: mongoose.Types.ObjectId;
  readByUsers: mongoose.Types.ObjectId[];
}

interface chatInterface {
  chatName: string;
  isGroupChat: boolean;
  groupLogo: media;
  groupDescription: string;
  community: { name: String; id: String };
  users: users[];
  blockedBy: mongoose.Types.ObjectId[];
  latestMessage: mongoose.Types.ObjectId | Message;
  groupAdmin: mongoose.Types.ObjectId;
  isBlock: boolean;
  isRequestAccepted: boolean;
}


/** Profile document shape used for enrichment (subset of UserProfile). Accepts lean() results. */
type ProfileForEnrichment = {
  users_id?: mongoose.Types.ObjectId | { toString(): string };
  profile_dp?: { imageUrl?: string } | null;
  university_name?: string | null;
  study_year?: number | string | null;
  degree?: string | null;
  major?: string | null;
  role?: string | null;
  affiliation?: string | null;
  occupation?: string | null;
};

type PopulatedUserId = {
  _id: mongoose.Types.ObjectId | { toString(): string };
  firstName?: string;
  lastName?: string;
  isDeleted?: boolean;
  profileDp?: string | null;
  universityName?: string | null;
  studyYear?: number | string | null;
  degree?: string | null;
  major?: string | null;
  role?: string | null;
  affiliation?: string | null;
  occupation?: string | null;
  isBlocked?: boolean;
};


/** Used when reading blockedUsers from UserProfile (lean). */
export type BlockedUser = { userId: mongoose.Types.ObjectId | string };

/** UserProfile lean result with users_id and blockedUsers. */
export type BlockProfile = {
  users_id: mongoose.Types.ObjectId | string;
  blockedUsers?: BlockedUser[];
};

/** Minimal user shape for block checks (e.g. populated userId). */
export type ChatUser = { _id?: mongoose.Types.ObjectId | string };

/** Message document shape when grouping by chat (lean). */
export type MessageWithChat = {
  chat: mongoose.Types.ObjectId | string;
  createdAt: Date;
  readByUsers: (mongoose.Types.ObjectId | string)[];
};

/** Input shape for editGroupChat (user object with profile). */
export type UsersToAdd = {
  user: { _id: string; firstName: string; lastName: string; profile: unknown };
  acceptRequest: boolean;
};

/** Group name/logo updates for edit flows. */
export type GroupMetadataUpdates = {
  groupName?: string;
  groupLogo?: { imageUrl: string; publicId: string } | null;
};

/** Community reference when creating a group chat. */
export type CommunityRef = { name: String; id: String } | null | undefined;

/** Chat list item with enrichment fields (getUserChats). */
export type UserChatListItem = {
  _id: mongoose.Types.ObjectId;
  createdAt?: Date;
  latestMessageTime: number;
  [key: string]: unknown;
};

export { chatInterface, ProfileForEnrichment, PopulatedUserId };
