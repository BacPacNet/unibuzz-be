import express, { Router } from 'express';
import { validate } from '../../modules/validate';
import { userIdAuth } from '../../modules/user';
import { communityController, communityValidation, requireCommunityMember } from '../../modules/community';
import { noErrorUserIdAuth } from '../../modules/user/user.middleware';

const router: Router = express.Router();

router.route('/').get(userIdAuth, communityController.getAllUserCommunity);

// query-params:
// isVerified: boolean,searchQuery: string,page: number,limit: number,
router
  .route('/:communityId/users')
  .get(
    userIdAuth,
    validate(communityValidation.getCommunityUsers),
    requireCommunityMember,
    communityController.getCommunityUsersController
  );

// query-params:
// isVerified: boolean,searchQuery: string,page: number,limit: number,
router
  .route('/:communityId/filteredusers')
  .get(
    userIdAuth,
    validate(communityValidation.getCommunityUsersWithFilter),
    requireCommunityMember,
    communityController.getCommunityUsersWithfilterController
  );

router
  .route('/filtered/:communityId')
  .post(
    userIdAuth,
    validate(communityValidation.getFilteredUserCommunity),
    requireCommunityMember,
    communityController.getFilteredUserCommunity
  );

router
  .route('/:communityId')
  .get(noErrorUserIdAuth, validate(communityValidation.getCommunity), communityController.getCommunity);


router
  .route('/:communityId/join')
  .put(userIdAuth, validate(communityValidation.joinCommunity), communityController.joinCommunity);

router
  .route('/join')
  .post(userIdAuth, validate(communityValidation.joinCommunityFromUniversity), communityController.joinCommunityFromUniversity);

router
  .route('/:communityId/leave')
  .delete(
    userIdAuth,
    validate(communityValidation.leaveCommunity),
    requireCommunityMember,
    communityController.leaveCommunity
  );

export default router;
