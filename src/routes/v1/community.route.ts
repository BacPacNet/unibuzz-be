import { userIdAuth } from '../../modules/user';
import { communityController } from '../../modules/community';
import { Router } from 'express';
import { getCommunityUsersController } from '../../modules/community/community.controller';

const router: Router = Router();

router
  .route('/')
  .get(userIdAuth, communityController.getAllUserCommunity)
  .post(userIdAuth, communityController.CreateCommunity);

  router.route('/:communityId/users').get(getCommunityUsersController);

router.route('/filtered/:communityId').post(userIdAuth, communityController.getFilteredUserCommunity);
router.route('/:communityId').get(communityController.getCommunity).put(communityController.updateCommunity);

router.route('/uni/:universityId').get(communityController.getCommunityFromUniversityID);

router.route('/:communityId/join').put(userIdAuth, communityController.joinCommunity);
router.route('/join').post(userIdAuth, communityController.joinCommunityFromUniversity);

router.route('/:communityId/leave').delete(userIdAuth, communityController.leaveCommunity);

export default router;
