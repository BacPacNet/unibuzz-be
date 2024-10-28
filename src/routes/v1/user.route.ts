import express, { Router } from 'express';
import { validate } from '../../modules/validate';
// import { auth } from '../../modules/auth';
import { userController, userIdAuth, userValidation } from '../../modules/user';

const router: Router = express.Router();

router
  .route('/')
  .post(validate(userValidation.createUser), userController.createUser)
  .get(userIdAuth, userController.getUsersWithProfileData);

router.route('/connections').get(userController.getAllUser);
router.route('/checkAvailability').post(userController.checkUserEmailAndUserNameAvailability);
router
  .route('/:userId')
  .get(userIdAuth, validate(userValidation.getUser), userController.getUser)
  .patch(validate(userValidation.updateUser), userController.updateUser)
  .delete(validate(userValidation.deleteUser), userController.deleteUser);

router.route('/:communityId').put(userIdAuth, userController.joinCommunity);

router.route('/user/GroupRole').put(userIdAuth, userController.updateUserCommunityGroupRole);
router.route('/user/CommunityRole').put(userIdAuth, userController.updateUserCommunityRole);

router.route('/communityUsers/:communityId').get(userIdAuth, userController.findUsersByCommunityId);
router.route('/communityGroupUsers/:communityGroupId').get(userIdAuth, userController.findUsersByCommunityGroupId);

router.route('/leave/:communityId').put(userIdAuth, userController.leaveCommunity);

export default router;

/**
 * @swagger
 * tags:
 *   name: Users
 *   description: API for managing users
 */

/**
 * @swagger
 * /:
 *   post:
 *     summary: Create a new user
 *     tags: [Users]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/User'
 *     responses:
 *       201:
 *         description: The created user
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/User'
 */

/**
 * @swagger
 * /:
 *   get:
 *     summary: Get all users
 *     tags: [Users]
 *     responses:
 *       200:
 *         description: A list of users
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/User'
 */

/**
 * @swagger
 * /{userId}:
 *   get:
 *     summary: Get a user by ID
 *     tags: [Users]
 *     parameters:
 *       - in: path
 *         name: userId
 *         schema:
 *           type: string
 *         required: true
 *         description: The ID of the user
 *     responses:
 *       200:
 *         description: The user data
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/User'
 */

/**
 * @swagger
 * /{userId}:
 *   patch:
 *     summary: Update a user by ID
 *     tags: [Users]
 *     parameters:
 *       - in: path
 *         name: userId
 *         schema:
 *           type: string
 *         required: true
 *         description: The ID of the user
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/User'
 *     responses:
 *       200:
 *         description: The updated user data
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/User'
 */

/**
 * @swagger
 * /{userId}:
 *   delete:
 *     summary: Delete a user by ID
 *     tags: [Users]
 *     parameters:
 *       - in: path
 *         name: userId
 *         schema:
 *           type: string
 *         required: true
 *         description: The ID of the user
 *     responses:
 *       204:
 *         description: No content
 */

/**
 * @swagger
 * /{communityId}:
 *   put:
 *     summary: Join a community
 *     tags: [Users]
 *     parameters:
 *       - in: path
 *         name: communityId
 *         schema:
 *           type: string
 *         required: true
 *         description: The ID of the community
 *     responses:
 *       200:
 *         description: The user joined the community
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/User'
 */

/**
 * @swagger
 * /leave/{communityId}:
 *   put:
 *     summary: Leave a community
 *     tags: [Users]
 *     parameters:
 *       - in: path
 *         name: communityId
 *         schema:
 *           type: string
 *         required: true
 *         description: The ID of the community
 *     responses:
 *       200:
 *         description: The user left the community
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/User'
 */
