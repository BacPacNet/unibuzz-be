import { userIdAuth } from '../../modules/user';
import { communityPostCommentsController } from '../../modules/communityPostsComments';
import express, { Router } from 'express';

const router: Router = express.Router();

router
  .route('/:communityPostId')
  .get(userIdAuth, communityPostCommentsController.getAllCommunityPostComments)
  .post(userIdAuth, communityPostCommentsController.CreateComment);

router
  .route('/:commentId')
  .put(communityPostCommentsController.updateComment)
  .delete(communityPostCommentsController.deleteCommunityPost);

export default router;
