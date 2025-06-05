import { cacheMiddleware } from '../../config/redis';
import { userIdAuth } from '../../modules/user';
import { userPostController } from '../../modules/userPost';
import express, { Router } from 'express';

const router: Router = express.Router();

router.route('/').get(userIdAuth, userPostController.getAllUserPosts);

router.route('/').post(userIdAuth, userPostController.createUserPost);

router.route('/timeline').get(userIdAuth, cacheMiddleware(), userPostController.getAllTimelinePosts);

router.route('/:postId').put(userPostController.updateUserPost).delete(userPostController.deleteUserPost);

router.put('/likes/:postId', userIdAuth, userPostController.updateLikeStatus);

export default router;

/**
 * @swagger
 * tags:
 *   name: User Posts
 *   description: API for managing user's timeline posts
 */

/**
 * @swagger
 * /:
 *   post:
 *     summary: Create a new user post
 *     tags: [User Posts]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/userPost'
 *     responses:
 *       201:
 *         description: The created user post
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/userPost'
 *   get:
 *    summary: Get all user posts
 *    tags: [User Posts]
 *    requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/userPost'
 *   responses:
 *       200:
 *         description: A list of user posts
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/userPost'
 */

/**
 * @swagger
 * /{postId}:
 *   put:
 *     summary: Update a User post
 *     tags: [User Posts]
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
 *             $ref: '#/components/schemas/UserPost'
 *     responses:
 *       200:
 *         description: The updated User post
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/UserPost'
 */

/**
 * @swagger
 * /{postId}:
 *   delete:
 *     summary: Delete a User post
 *     tags: [User Posts]
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
 *     summary: Like or unlike a User post
 *     tags: [User Posts]
 *     parameters:
 *       - in: path
 *         name: postId
 *         schema:
 *           type: string
 *         required: true
 *         description: The ID of the post
 *     responses:
 *       200:
 *         description: The updated User post with like/unlike status
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/UserPost'
 */
