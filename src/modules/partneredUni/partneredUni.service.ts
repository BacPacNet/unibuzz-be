import mongoose from 'mongoose';
import PartneredUniModel from './partneredUni.model';
import UniversityModel from '../university/university.model';
import communityModel from '../community/community.model';

const toObjectId = (value: string | mongoose.Types.ObjectId): mongoose.Types.ObjectId =>
  typeof value === 'string' ? new mongoose.Types.ObjectId(value) : value;

export const isPartneredUni = async (
  universityId: string | mongoose.Types.ObjectId,
  communityId: string | mongoose.Types.ObjectId
): Promise<boolean> => {
  const partneredUni = await PartneredUniModel.exists({
    universityId: toObjectId(universityId),
    communityId: toObjectId(communityId),
    isActive: true,
  });

  return !!partneredUni;
};

export const isPartneredUniversity = async (
  universityId: string | mongoose.Types.ObjectId
): Promise<boolean> => {
  const partneredUni = await PartneredUniModel.exists({
    universityId: toObjectId(universityId),
    isActive: true,
  });

  return !!partneredUni;
};

export const isPartneredCommunity = async (
  communityId: string | mongoose.Types.ObjectId
): Promise<boolean> => {
  const partneredUni = await PartneredUniModel.exists({
    communityId: toObjectId(communityId),
    isActive: true,
  });

  return !!partneredUni;
};

export const getPartneredUniversityIds = async () => {
  const partneredUniversityIds = await PartneredUniModel.distinct('universityId', { isActive: true });
  return partneredUniversityIds;
};

export const getPartneredUniversityAdminIds = async (
  communityId?: string | mongoose.Types.ObjectId
): Promise<string[]> => {
  const partneredUniversityIds = await getPartneredUniversityIds();
  if (partneredUniversityIds.length === 0) {
    return [];
  }

  const universities = await UniversityModel.find({ _id: { $in: partneredUniversityIds } })
    .select('_id')
    .lean();

  const universityIds = universities.map((university) => university._id);

  const communityFilter: mongoose.FilterQuery<{ university_id: mongoose.Types.ObjectId }> = {
    university_id: { $in: universityIds },
  };

  if (communityId) {
    communityFilter['_id'] = toObjectId(communityId);
  }

  const communities = await communityModel.find(communityFilter).select('adminId').lean();

  return [
    ...new Set(
      communities.flatMap((community) => (community.adminId || []).map((adminId) => adminId.toString()))
    ),
  ];
};

export const isPartneredUniversityAdmin = async (
  userId: string | mongoose.Types.ObjectId,
  communityId?: string | mongoose.Types.ObjectId
): Promise<{ isPartneredUniversityAdmin: boolean; universityId: string | null }> => {
  const partneredUniversityIds = await getPartneredUniversityIds();
  if (partneredUniversityIds.length === 0) {
    return { isPartneredUniversityAdmin: false, universityId: null };
  }

  const communityFilter: mongoose.FilterQuery<{
    university_id: mongoose.Types.ObjectId;
    adminId: mongoose.Types.ObjectId[];
  }> = {
    university_id: { $in: partneredUniversityIds },
    adminId: toObjectId(userId),
  };

  if (communityId) {
    communityFilter['_id'] = toObjectId(communityId);
  }

  const community = await communityModel.findOne(communityFilter).select('university_id').lean();

  return {
    isPartneredUniversityAdmin: !!community,
    universityId: community?.university_id?.toString() ?? null,
  };
};

export type PartneredUniversityAdminStatus = Awaited<ReturnType<typeof isPartneredUniversityAdmin>>;

export function buildPromoteIfAdmin(partneredAdminStatus: PartneredUniversityAdminStatus) {
  if (!partneredAdminStatus.isPartneredUniversityAdmin || !partneredAdminStatus.universityId) {
    return {};
  }
  return {
    promote: {
      universityId: partneredAdminStatus.universityId,
      isAdminOfUni: partneredAdminStatus.isPartneredUniversityAdmin,
    },
  };
}

export function attachPromoteToPosts<T extends object>(
  posts: T[],
  partneredAdminStatus: PartneredUniversityAdminStatus
): T[] {
  const promoteMeta = buildPromoteIfAdmin(partneredAdminStatus);
  if (!('promote' in promoteMeta)) {
    return posts;
  }
  return posts.map((post) => ({ ...post, ...promoteMeta }));
}

export function attachPromoteToPost<T extends object>(
  post: T | null | undefined,
  partneredAdminStatus: PartneredUniversityAdminStatus
): T | null | undefined {
  if (!post) return post;
  return attachPromoteToPosts([post], partneredAdminStatus)[0];
}
