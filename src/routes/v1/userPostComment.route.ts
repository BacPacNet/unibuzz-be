import { userIdAuth } from '../../modules/user';
import { userPostCommentsController } from '../../modules/userPostComments';
import express, { Router } from 'express';

const router: Router = express.Router();

router
  .route('/:userPostId')
  .get(userIdAuth, userPostCommentsController.getUserPostComments)
  .post(userIdAuth, userPostCommentsController.CreateComment);

router.route('/comment/:commentId').get(userIdAuth, userPostCommentsController.getCommentById);
router.route('/:commentId').put(userPostCommentsController.updateComment).delete(userPostCommentsController.deleteComment);
router.route('/:commentId/replies').post(userIdAuth, userPostCommentsController.UserPostCommentReply);

router.put('/likeUnlike/:userPostCommentId', userIdAuth, userPostCommentsController.LikeUserPostComment);

export default router;

/**
 * @swagger
 * tags:
 *   name: User Post Comments
 *   description: API for managing community user comments
 */

/**
 * @swagger
 * /{userPostId}:
 *   get:
 *     summary: Get all comments for a community post
 *     tags: [User Post Comments]
 *     parameters:
 *       - in: path
 *         name: userPostId
 *         schema:
 *           type: string
 *         required: true
 *         description: The ID of the user post
 *     responses:
 *       200:
 *         description: A list of comments for the user post
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/Comment'
 */

/**
 * @swagger
 * /{userPostId}:
 *   post:
 *     summary: Create a new comment on a user post
 *     tags: [User Post Comments]
 *     parameters:
 *       - in: path
 *         name: userPostId
 *         schema:
 *           type: string
 *         required: true
 *         description: The ID of the user post
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
 *     summary: Update a comment on a user post
 *     tags: [User Post Comments]
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
 *     summary: Delete a comment from a user post
 *     tags: [User Post Comments]
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
