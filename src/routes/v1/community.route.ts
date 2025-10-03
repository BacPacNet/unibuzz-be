import { userIdAuth } from '../../modules/user';
import { communityController } from '../../modules/community';
import { Router } from 'express';
import { getCommunityUsersController } from '../../modules/community/community.controller';
import { requireCommunityMember } from '../../modules/community';

const router: Router = Router();

router.route('/').get(userIdAuth, communityController.getAllUserCommunity);

// query-params:
// isVerified: boolean,searchQuery: string,page: number,limit: number,
router.route('/:communityId/users').get(userIdAuth, requireCommunityMember, getCommunityUsersController);

router
  .route('/filtered/:communityId')
  .post(userIdAuth, requireCommunityMember, communityController.getFilteredUserCommunity);

router.route('/:communityId').get(communityController.getCommunity);

// router.route('/:communityId').put(userIdAuth, requireVerifiedCommunityMember, communityController.updateCommunity);

router.route('/uni/:universityId').get(userIdAuth, communityController.getCommunityFromUniversityID);

router.route('/:communityId/join').put(userIdAuth, communityController.joinCommunity);

router.route('/join').post(userIdAuth, communityController.joinCommunityFromUniversity);

router.route('/:communityId/leave').delete(userIdAuth, requireCommunityMember, communityController.leaveCommunity);

export default router;
