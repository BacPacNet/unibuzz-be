import { NextFunction, Response } from 'express';
import httpStatus from 'http-status';
import mongoose from 'mongoose';
import { ApiError } from '../errors';
import { userIdExtend } from '../../config/userIDType';
import * as superAdminsService from './superAdmins.service';

export const requireSuperAdmin = async (
  req: userIdExtend,
  _res: Response,
  next: NextFunction
) => {
  try {
    const userId = req.userId;
    if (!userId) {
      return next(new ApiError(httpStatus.UNAUTHORIZED, 'User ID not found'));
    }

    if (!mongoose.Types.ObjectId.isValid(userId)) {
      return next(new ApiError(httpStatus.BAD_REQUEST, 'Invalid user ID format'));
    }

    const allowed = await superAdminsService.isSuperAdmin(userId);

    if (!allowed) {
      return next(new ApiError(httpStatus.FORBIDDEN, 'Only super admins can access this resource'));
    }

    next();
  } catch (error) {
    next(new ApiError(httpStatus.INTERNAL_SERVER_ERROR, 'Error while checking super admin access'));
  }
};
