// import { communityInterface } from "./community.interface";
import communityModel from './community.model';

export const createCommunity = async (community: any) => {
  const updatedCommunity = { ...community._doc, adminId: '6634c0e646b1f2b7eee2c66a' };
  // console.log(updatedCommunity);
  return await communityModel.create(updatedCommunity);
};
