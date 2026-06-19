export enum CommunityType {
  PUBLIC = 'PUBLIC',
  UNIVERSITY_WIDE = 'UNIVERSITY_WIDE',
}
export enum CommunityGroupType {
  CASUAL = 'casual',
  OFFICIAL = 'official',
}
export enum CommunityGroupAccess {
  Public = 'Public',
  OpenCampus = 'Open-campus',
  Private = 'Private',
  UniversityWide = 'University-wide',
  Hidden = 'Hidden',
}

/** Keys returned to the frontend for disabled join-button states */
export enum CommunityGroupJoinActionKey {
  UNIVERSITY_MEMBERS_ONLY = 'UNIVERSITY_MEMBERS_ONLY',
  INVITE_ONLY = 'INVITE_ONLY',
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
  UNIVERSITY_WIDE = 'UNIVERSITY_WIDE',
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
