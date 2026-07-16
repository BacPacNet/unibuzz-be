import UserProfile from './userProfile.model';
import { UserRole } from './userProfile.interface';

export function shouldShowCommunitiesForViewer(viewerRole?: string): boolean {
  return viewerRole === UserRole.APPLICANT;
}

export async function getViewerProfileRole(userId: string): Promise<string | undefined> {
  if (!userId) return undefined;
  const profile = await UserProfile.findOne({ users_id: userId }).select('role').lean();
  return profile?.role;
}

function clearProfileCommunities<T extends { communities?: unknown[] }>(profile: T): T {
  return { ...profile, communities: [] };
}

type PostProfileFields = {
  userProfile?: { communities?: unknown[] };
  profile?: { communities?: unknown[] };
};

export type MaskPostProfilesOptions = {
  /** Bypass role-based hiding (e.g. community admin moderation endpoints). */
  showCommunities?: boolean;
};

export function maskPostProfilesForViewer<T extends PostProfileFields>(
  posts: T[],
  viewerRole?: string,
  options?: MaskPostProfilesOptions
): T[] {
  if (options?.showCommunities || shouldShowCommunitiesForViewer(viewerRole)) return posts;
  return posts.map((post) => {
    if (post.userProfile) {
      return { ...post, userProfile: clearProfileCommunities(post.userProfile) };
    }
    if (post.profile) {
      return { ...post, profile: clearProfileCommunities(post.profile) };
    }
    return post;
  });
}

export type CommentWithProfileCommunities = {
  commenterProfileId?: { communities?: unknown[] };
  replies?: CommentWithProfileCommunities[];
};

export function maskCommentProfileForViewer<T extends CommentWithProfileCommunities>(
  comment: T,
  viewerRole?: string
): T {
  if (shouldShowCommunitiesForViewer(viewerRole)) return comment;
  return {
    ...comment,
    ...(comment.commenterProfileId
      ? { commenterProfileId: clearProfileCommunities(comment.commenterProfileId) }
      : {}),
    ...(comment.replies
      ? { replies: comment.replies.map((reply) => maskCommentProfileForViewer(reply, viewerRole)) }
      : {}),
  };
}

export function maskCommentsForViewer<T extends CommentWithProfileCommunities>(
  comments: T[],
  viewerRole?: string
): T[] {
  return comments.map((comment) => maskCommentProfileForViewer(comment, viewerRole));
}
