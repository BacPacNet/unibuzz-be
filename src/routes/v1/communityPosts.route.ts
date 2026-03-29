import express, { Router } from 'express';
import { validate } from '../../modules/validate';
import { userIdAuth } from '../../modules/user';
import { communityPostsController, communityPostsValidation } from '../../modules/communityPosts';
import { noErrorUserIdAuth } from '../../modules/user/user.middleware';

const router: Router = express.Router();

router
  .route('/timelinePost')
  .get(userIdAuth, validate(communityPostsValidation.getAllCommunityPostV2), communityPostsController.getAllCommunityPostV2);

router
  .route('/group')
  .get(userIdAuth, validate(communityPostsValidation.getAllCommunityGroupPostV2), communityPostsController.getAllCommunityGroupPostV2);

router
  .route('/post/:postId')
  .get(
    noErrorUserIdAuth,
    validate(communityPostsValidation.getPostById),
    communityPostsController.getPostById
  )
  .put(
    userIdAuth,
    validate(communityPostsValidation.updateCommunityPostLive),
    communityPostsController.updateCommunityPostLive
  );

router
  .route('/:communityId/:communityGroupId?')
  .get(
    userIdAuth,
    validate(communityPostsValidation.getAllCommunityPost),
    communityPostsController.getAllCommunityPost
  );

router
  .route('/')
  .post(
    userIdAuth,
    validate(communityPostsValidation.createCommunityPost),
    communityPostsController.createCommunityPost
  );

router
  .route('/:postId')
  .put(
    validate(communityPostsValidation.updateCommunityPost),
    communityPostsController.updateCommunityPost
  )
  .delete(
    validate(communityPostsValidation.deleteCommunityPost),
    communityPostsController.deleteCommunityPost
  );

router.put(
  '/likeunlike/:postId',
  userIdAuth,
  validate(communityPostsValidation.likeUnlikePost),
  communityPostsController.likeUnlikePost
);

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
