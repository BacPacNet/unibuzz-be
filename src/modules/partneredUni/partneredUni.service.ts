import mongoose from 'mongoose';
import PartneredUniModel from './partneredUni.model';

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
