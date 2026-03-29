import * as communityController from './community.controller';
import * as communityService from './community.service';
import communityModel from './community.model';
import { communityInterface } from './community.interface';
import * as communityValidation from './community.validation';
import {
  checkUserCommunityMembership,
  requireVerifiedCommunityMember,
  requireCommunityMember,
  checkCommunityVerificationStatus,
} from './community.middleware';

export {
  communityController,
  communityService,
  communityModel,
  communityInterface,
  communityValidation,
  checkUserCommunityMembership,
  requireVerifiedCommunityMember,
  requireCommunityMember,
  checkCommunityVerificationStatus,
};
