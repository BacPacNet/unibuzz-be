import { NextFunction, Response } from 'express';
import httpStatus from 'http-status';
import mongoose from 'mongoose';
import { ApiError } from '../errors';
import { userIdExtend } from '../../config/userIDType';
import * as partneredUniService from './partneredUni.service';

const getIdFromRequest = (req: userIdExtend, key: 'universityId' | 'communityId'): string | undefined => {
  const fromParams = req.params?.[key];
  const fromBody = req.body?.[key];
  const fromQuery = req.query?.[key];

  if (typeof fromParams === 'string') return fromParams;
  if (typeof fromBody === 'string') return fromBody;
  if (typeof fromQuery === 'string') return fromQuery;

  return undefined;
};

export const requirePartneredUni = async (
  req: userIdExtend,
  _res: Response,
  next: NextFunction
) => {
  try {
    const universityId = getIdFromRequest(req, 'universityId');
    const communityId = getIdFromRequest(req, 'communityId');

    if (!universityId || !communityId) {
      return next(new ApiError(httpStatus.BAD_REQUEST, 'universityId and communityId are required'));
    }

    if (!mongoose.Types.ObjectId.isValid(universityId) || !mongoose.Types.ObjectId.isValid(communityId)) {
      return next(new ApiError(httpStatus.BAD_REQUEST, 'Invalid universityId or communityId format'));
    }

    const allowed = await partneredUniService.isPartneredUni(universityId, communityId);

    if (!allowed) {
      return next(new ApiError(httpStatus.FORBIDDEN, 'Feature not available for this university/community'));
    }

    next();
  } catch (_error) {
    next(new ApiError(httpStatus.INTERNAL_SERVER_ERROR, 'Error while checking partnered university access'));
  }
};
