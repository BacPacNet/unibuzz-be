import { CommunityGroupAccess, CommunityGroupJoinActionKey, CommunityGroupType } from '../../config/community.type';
import { UserRole } from '../userProfile/userProfile.interface';

const ALL_COMMUNITY_GROUP_ACCESS = Object.values(CommunityGroupAccess);

export function isUniversityMemberRole(role?: string | null): boolean {
  return role === UserRole.STUDENT || role === UserRole.FACULTY;
}

export function isApplicantRole(role?: string | null): boolean {
  return role === UserRole.APPLICANT;
}

export function isHiddenGroupAccess(access?: CommunityGroupAccess | string | null): boolean {
  return access === CommunityGroupAccess.Hidden;
}

export function isUniversityWideGroupAccess(access?: CommunityGroupAccess | string | null): boolean {
  return access === CommunityGroupAccess.UniversityWide;
}

export function isOpenCampusGroupAccess(access?: CommunityGroupAccess | string | null): boolean {
  return access === CommunityGroupAccess.OpenCampus;
}

/** Public and Open Campus groups allow both applicants and university members to join */
export function isOpenJoinGroupAccess(access?: CommunityGroupAccess | string | null): boolean {
  return access === CommunityGroupAccess.Public || access === CommunityGroupAccess.OpenCampus;
}

export function isJoinRequestRequired(group: {
  isRequestRequiredToJoinGroup?: boolean;
  communityGroupAccess?: CommunityGroupAccess | string | null;
}): boolean {
  if (group.isRequestRequiredToJoinGroup === true) {
    return true;
  }
  if (group.isRequestRequiredToJoinGroup === false) {
    return false;
  }
  // Backward compat: existing Private groups without the field still require a request
  return group.communityGroupAccess === CommunityGroupAccess.Private;
}

export function assertOfficialTypeAllowed(
  communityGroupAccess?: CommunityGroupAccess | string,
  communityGroupType?: CommunityGroupType | string
): void {
  if (
    isHiddenGroupAccess(communityGroupAccess) &&
    String(communityGroupType ?? '').toLowerCase() === CommunityGroupType.OFFICIAL
  ) {
    throw new Error('Hidden groups cannot be official');
  }
}

export function getJoinGroupActionKey(params: {
  communityGroupAccess: CommunityGroupAccess | string;
  userRole?: string | null | undefined;
  isMember: boolean;
  isInvited: boolean;
  isAdmin: boolean;
}): CommunityGroupJoinActionKey | null {
  const { communityGroupAccess, userRole, isMember, isInvited, isAdmin } = params;

  if (isMember || isAdmin) {
    return null;
  }

  if (isUniversityWideGroupAccess(communityGroupAccess) && isApplicantRole(userRole)) {
    return CommunityGroupJoinActionKey.UNIVERSITY_MEMBERS_ONLY;
  }

  if (isHiddenGroupAccess(communityGroupAccess) && !isInvited) {
    return CommunityGroupJoinActionKey.INVITE_ONLY;
  }

  return null;
}

export function canViewHiddenGroup(params: {
  userId: string;
  adminUserId: string;
  isCommunityAdmin: boolean;
  isInvited: boolean;
  isMember: boolean;
}): boolean {
  const { userId, adminUserId, isCommunityAdmin, isInvited, isMember } = params;
  return (
    userId === adminUserId ||
    isCommunityAdmin ||
    isInvited ||
    isMember
  );
}

export { ALL_COMMUNITY_GROUP_ACCESS };
