import { userIdAuth } from '../../modules/user';
import { communityController } from '../../modules/community';
import { Router } from 'express';

const router: Router = Router();

router
  .route('/')
  .get(userIdAuth, communityController.getAllUserCommunity)
  .post(userIdAuth, communityController.CreateCommunity);
router.route('/:communityId').get(communityController.getCommunity).put(communityController.updateCommunity);

export default router;
