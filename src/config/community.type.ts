export enum CommunityType {
  PUBLIC = 'PUBLIC',
  FOLLOWER_ONLY = 'FOLLOWER_ONLY',
}
export enum CommunityGroupType {
  CASUAL = 'casual',
  OFFICIAL = 'official',
}
export enum CommunityGroupAccess {
  Public = 'Public',
  Private = 'Private',
}

export enum CommunityGroupLabel {
  Course = 'Course',
  Club = 'Club',
  Circle = 'Circle',
  Other = 'Other',
}
export enum userPostType {
  PUBLIC = 'PUBLIC',
  FOLLOWER_ONLY = 'FOLLOWER_ONLY',
  MUTUAL = 'MUTUAL',
  ONLY_ME = 'ONLY_ME',
}

export enum communityPostStatus {
  PENDING = 'PENDING',
  SUCCESS = 'SUCCESS',
  REJECTED = 'REJECTED',
  DEFAULT = 'DEFAULT',
}
export enum communityPostFilterType {
  MY_POSTS = 'myPosts',

  PENDING_POSTS = 'pendingPosts',
}
export enum communityPostUpdateStatus {
  LIVE = 'live',

  REJECTED = 'rejected',
}
