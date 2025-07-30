import { NextFunction, Response } from 'express';
import httpStatus from 'http-status';
import { ApiError } from '../errors';
import { userIdExtend } from '../../config/userIDType';
import { userProfileService } from '../userProfile';
import mongoose from 'mongoose';

interface CommunityVerificationOptions {
  requireVerification?: boolean;
  allowUnverified?: boolean;
}

/**
 * Middleware to check if user is part of a community and optionally verified
 * @param options - Configuration options for verification requirements
 * @returns Express middleware function
 */
export const checkUserCommunityMembership = (options: CommunityVerificationOptions = {}) => {
  const { requireVerification = false, allowUnverified = true } = options;

  return async (req: userIdExtend, _res: Response, next: NextFunction) => {
    try {
      const userId = req.userId as string;
      const { communityId } = req.params;

      if (!userId) {
        return next(new ApiError(httpStatus.UNAUTHORIZED, 'User ID not found'));
      }

      if (!communityId) {
        return next(new ApiError(httpStatus.BAD_REQUEST, 'Community ID is required'));
      }

      if (!mongoose.Types.ObjectId.isValid(communityId)) {
        return next(new ApiError(httpStatus.BAD_REQUEST, 'Invalid community ID format'));
      }

      // Get user profile to check community membership
      const userProfile = await userProfileService.getUserProfileById(userId);

      if (!userProfile) {
        return next(new ApiError(httpStatus.NOT_FOUND, 'User profile not found'));
      }

      // Find the community in user's communities array
      const userCommunity = userProfile.communities.find(
        (community: { communityId: string }) => community.communityId.toString() === communityId
      );

      if (!userCommunity) {
        return next(new ApiError(httpStatus.FORBIDDEN, 'User is not a member of this community'));
      }

      // Check verification status if required
      if (requireVerification && !userCommunity.isVerified) {
        return next(new ApiError(httpStatus.FORBIDDEN, 'User must be verified to access this resource'));
      }

      // If allowUnverified is false and user is not verified, deny access
      if (!allowUnverified && !userCommunity.isVerified) {
        return next(new ApiError(httpStatus.FORBIDDEN, 'Only verified users can access this resource'));
      }

      // Add community info to request for use in controllers
      req.userCommunity = {
        communityId: userCommunity.communityId.toString(),
        isVerified: userCommunity.isVerified,
        communityGroups: userCommunity.communityGroups,
      };

      next();
    } catch (error) {
      console.error('Error in checkUserCommunityMembership middleware:', error);
      next(new ApiError(httpStatus.INTERNAL_SERVER_ERROR, 'Internal server error'));
    }
  };
};

/**
 * Middleware to check if user is verified in a specific community
 * This is a convenience wrapper around checkUserCommunityMembership
 */
export const requireVerifiedCommunityMember = checkUserCommunityMembership({
  requireVerification: true,
  allowUnverified: false,
});

/**
 * Middleware to check if user is a member of a community (verified or unverified)
 * This is a convenience wrapper around checkUserCommunityMembership
 */
export const requireCommunityMember = checkUserCommunityMembership({
  requireVerification: false,
  allowUnverified: true,
});

/**
 * Middleware to check if user is verified in a community but allow unverified access
 * This is useful for features that work for both verified and unverified users
 * but need to know the verification status
 */
export const checkCommunityVerificationStatus = checkUserCommunityMembership({
  requireVerification: false,
  allowUnverified: true,
});
