import { userIdAuth } from '../../modules/user';
import { communityPostsController } from '../../modules/communityPosts';
import express, { Router } from 'express';
import { noErrorUserIdAuth } from '../../modules/user/user.middleware';

const router: Router = express.Router();
router.route('/timelinePost').get(userIdAuth, communityPostsController.getAllCommunityPostV2);

router.route('/group').get(userIdAuth, communityPostsController.getAllCommunityGroupPostV2);

router
  .route('/post/:postId')
  .get(noErrorUserIdAuth, communityPostsController.getPostById)
  .put(userIdAuth, communityPostsController.updateCommunityPostLive);
router.route('/:communityId/:communityGroupId?').get(userIdAuth, communityPostsController.getAllCommunityPost);

router.route('/').post(userIdAuth, communityPostsController.createCommunityPost);

router
  .route('/:postId')
  .put(communityPostsController.updateCommunityPost)
  .delete(communityPostsController.deleteCommunityPost);

router.put('/likeunlike/:postId', userIdAuth, communityPostsController.likeUnlikePost);

export default router;

/**
 * @swagger
 * tags:
 *   name: Community Posts
 *   description: API for managing community posts
 */

/**
 * @swagger
 * /{communityId}:
 *   get:
 *     summary: Get all posts for a community
 *     tags: [Community Posts]
 *     parameters:
 *       - in: path
 *         name: communityId
 *         schema:
 *           type: string
 *         required: true
 *         description: The ID of the community
 *     responses:
 *       200:
 *         description: A list of community posts
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/CommunityPost'
 */

/**
 * @swagger
 * /:
 *   post:
 *     summary: Create a new community post
 *     tags: [Community Posts]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/CommunityPost'
 *     responses:
 *       201:
 *         description: The created community post
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/CommunityPost'
 */

/**
 * @swagger
 * /{postId}:
 *   put:
 *     summary: Update a community post
 *     tags: [Community Posts]
 *     parameters:
 *       - in: path
 *         name: postId
 *         schema:
 *           type: string
 *         required: true
 *         description: The ID of the post
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/CommunityPost'
 *     responses:
 *       200:
 *         description: The updated community post
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/CommunityPost'
 */

/**
 * @swagger
 * /{postId}:
 *   delete:
 *     summary: Delete a community post
 *     tags: [Community Posts]
 *     parameters:
 *       - in: path
 *         name: postId
 *         schema:
 *           type: string
 *         required: true
 *         description: The ID of the post
 *     responses:
 *       204:
 *         description: No content
 */

/**
 * @swagger
 * /likeunlike/{postId}:
 *   put:
 *     summary: Like or unlike a community post
 *     tags: [Community Posts]
 *     parameters:
 *       - in: path
 *         name: postId
 *         schema:
 *           type: string
 *         required: true
 *         description: The ID of the post
 *     responses:
 *       200:
 *         description: The updated community post with like/unlike status
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/CommunityPost'
 */
