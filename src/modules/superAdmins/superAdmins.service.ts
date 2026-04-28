import mongoose from 'mongoose';
import SuperAdminsModel from './superAdmins.model';
import { userService } from '../user';
import { ApiError } from '../errors';
import httpStatus from 'http-status';

export const isSuperAdmin = async (
  userId: string | mongoose.Types.ObjectId
): Promise<boolean> => {
  const normalizedUserId =
    typeof userId === 'string' ? new mongoose.Types.ObjectId(userId) : userId;

  const superAdmin = await SuperAdminsModel.exists({ user_id: normalizedUserId });
  return !!superAdmin;
};

export const isSuperAdminByEmail = async (
  email: string
): Promise<boolean> => {
  const user = await userService.getUserByEmail(email);
  if (!user) {
    throw new ApiError(httpStatus.BAD_REQUEST, 'User not found');
  }
  const superAdmin = await SuperAdminsModel.exists({ user_id: user._id });
  return !!superAdmin;
};
