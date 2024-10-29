import { userIdAuth } from '../../modules/user';
import { communityPostCommentsController } from '../../modules/communityPostsComments';
import express, { Router } from 'express';

const router: Router = express.Router();

router
  .route('/:communityPostId')
  .get(userIdAuth, communityPostCommentsController.getCommunityPostComments)
  .post(userIdAuth, communityPostCommentsController.CreateComment);

router.route('/comment/:commentId').get(userIdAuth, communityPostCommentsController.getCommentById);
router
  .route('/:commentId')
  .put(communityPostCommentsController.updateComment)
  .delete(communityPostCommentsController.deleteCommunityPost);

router.route('/:commentId/replies').post(userIdAuth, communityPostCommentsController.CommunityPostCommentReply);
router.put('/likeUnlike/:communityPostCommentId', userIdAuth, communityPostCommentsController.LikeCommunityPostComments);

export default router;

/**
 * @swagger
 * tags:
 *   name: Community Post Comments
 *   description: API for managing community post comments
 */

/**
 * @swagger
 * /{communityPostId}:
 *   get:
 *     summary: Get all comments for a community post
 *     tags: [Community Post Comments]
 *     parameters:
 *       - in: path
 *         name: communityPostId
 *         schema:
 *           type: string
 *         required: true
 *         description: The ID of the community post
 *     responses:
 *       200:
 *         description: A list of comments for the community post
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/Comment'
 */

/**
 * @swagger
 * /{communityPostId}:
 *   post:
 *     summary: Create a new comment on a community post
 *     tags: [Community Post Comments]
 *     parameters:
 *       - in: path
 *         name: communityPostId
 *         schema:
 *           type: string
 *         required: true
 *         description: The ID of the community post
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/Comment'
 *     responses:
 *       201:
 *         description: The created comment
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Comment'
 */

/**
 * @swagger
 * /{commentId}:
 *   put:
 *     summary: Update a comment on a community post
 *     tags: [Community Post Comments]
 *     parameters:
 *       - in: path
 *         name: commentId
 *         schema:
 *           type: string
 *         required: true
 *         description: The ID of the comment
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/Comment'
 *     responses:
 *       200:
 *         description: The updated comment
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Comment'
 */

/**
 * @swagger
 * /{commentId}:
 *   delete:
 *     summary: Delete a comment from a community post
 *     tags: [Community Post Comments]
 *     parameters:
 *       - in: path
 *         name: commentId
 *         schema:
 *           type: string
 *         required: true
 *         description: The ID of the comment
 *     responses:
 *       204:
 *         description: No content
 */
