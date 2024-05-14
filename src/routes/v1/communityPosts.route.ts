import { userIdAuth } from '../../modules/user';
import { communityPostsController } from '../../modules/communityPosts';
import express, { Router } from 'express';

const router: Router = express.Router();

router.route('/:communityId').get(userIdAuth, communityPostsController.getAllCommunityPost);

router.route('/').post(userIdAuth, communityPostsController.createCommunityPost);

router
  .route('/:postId')
  .put(communityPostsController.updateCommunityPost)
  .delete(communityPostsController.deleteCommunityPost);

router.put('/likeunlike/:postId', userIdAuth, communityPostsController.likeUnlikePost);

export default router;
