// import { communityInterface } from "./community.interface";
import httpStatus from 'http-status';
import { ApiError } from '../errors';
import communityModel from './community.model';
import { User } from '../user';

export const createCommunity = async (
  name: string,
  adminId: string,
  collegeID: string,
  studentsAndFacultiesData: any,
  coverImg: any,
  logo: any
) => {
  const coverImage = coverImg[0] ? coverImg[0] : '';
  const logoImage = logo[0] ? logo[0] : '';
  const studentsAndFacultiesDataObject =
    studentsAndFacultiesData && studentsAndFacultiesData.toObject ? studentsAndFacultiesData.toObject() : [];
  const mapStudents = studentsAndFacultiesDataObject
    .map((item: { [key: string]: any }) => {
      const value = item['Total students'];
      return typeof value === 'string' ? parseInt(value.replace(/,/g, ''), 10) : value;
    })
    .filter((value: any) => typeof value === 'number');

  const mapFaculty = studentsAndFacultiesDataObject
    .map((item: { [key: string]: any }) => {
      const value = item['Total faculty staff'];
      return typeof value === 'string' ? parseInt(value.replace(/,/g, ''), 10) : value;
    })
    .filter((value: any) => typeof value === 'number');

  const data = {
    name,
    adminId,
    collegeID,
    numberOfStudent: mapStudents[0] || 0,
    numberOfFaculty: mapFaculty[0] || 0,
    numberOfUser: 0,
    communityCoverUrl: { imageUrl: coverImage },
    communityLogoUrl: { imageUrl: logoImage },
  };
  return await communityModel.create(data);
};

export const getCommunity = async (communityId: string) => {
  return await communityModel.findById(communityId);
};

export const getUserCommunitys = async (userID: string) => {
  const user: any = await User.findById(userID);
  const verifiedCommunityIds = user.userVerifiedCommunities.map((c: any) => c.communityId);
  const unverifiedCommunityIds = user.userUnVerifiedCommunities.map((c: any) => c.communityId);

  const allCommunityIds = [...verifiedCommunityIds, ...unverifiedCommunityIds];
  const communities = await communityModel
    .find({ _id: { $in: allCommunityIds } })
    .populate({ path: 'collegeID', select: 'wikiInfoBox.Address wikiInfoBox.Location collegeBoardInfo.Location' })
    .lean();

  return communities;
};

export const updateCommunity = async (id: string, community: any) => {
  let communityToUpadate;

  communityToUpadate = await communityModel.findById(id);

  if (!communityToUpadate) {
    throw new ApiError(httpStatus.NOT_FOUND, 'community not found!');
  }
  Object.assign(communityToUpadate, community);
  await communityToUpadate.save();
  return communityToUpadate;
};
