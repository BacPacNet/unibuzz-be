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
  // const updatedCommunity = { ...community._doc, adminId: '6634c0e646b1f2b7eee2c66a' };
  // console.log(coverImg);

  const coverImage = coverImg[0] ? coverImg[0] : '';
  const logoImage = logo[0] ? logo[0] : '';
  // return console.log(coverImage,"logo",logoImage)
  const studentsAndFacultiesDataObject =
    studentsAndFacultiesData && studentsAndFacultiesData.toObject ? studentsAndFacultiesData.toObject() : [];
  const totalStudents =
    studentsAndFacultiesData && studentsAndFacultiesDataObject[0]['Total students']
      ? parseInt(studentsAndFacultiesDataObject[0]['Total students'].replace(/,/g, ''), 10)
      : 0;
  const totalFaculty =
    studentsAndFacultiesData && studentsAndFacultiesDataObject[2]['Total faculty staff']
      ? parseInt(studentsAndFacultiesDataObject[2]['Total faculty staff'].replace(/,/g, ''), 10)
      : 0;

  const data = {
    name,
    adminId,
    collegeID,
    numberOfStudent: Number(totalStudents),
    numberOfFaculty: Number(totalFaculty),
    numberOfUser: 0,
    communityCoverUrl: { imageUrl: coverImage },
    communityLogoUrl: { imageUrl: logoImage },
  };
  // return console.log(data);
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
