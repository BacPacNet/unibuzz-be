import { userIdAuth } from '../../modules/user';
import { communityGroupController } from '../../modules/communityGroup';
import express, { Router } from 'express';

const router: Router = express.Router();

router
  .route('/:communityId')
  .get(userIdAuth, communityGroupController.getAllCommunityGroup)
  .post(userIdAuth, communityGroupController.CreateCommunityGroup);

router
  .route('/:groupId')
  .put(communityGroupController.updateCommunityGroup)
  .delete(communityGroupController.deleteCommunityGroup);

export default router;
