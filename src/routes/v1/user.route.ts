import express, { Router } from 'express';
import { validate } from '../../modules/validate';
import { userController, userIdAuth, userValidation } from '../../modules/user';
import { rewardRedemptionController, rewardRedemptionValidation } from '../../modules/rewardRedemption';

const router: Router = express.Router();

router
  .route('/')
  .post(validate(userValidation.createUser), userController.createUser)
  .delete(userIdAuth, validate(userValidation.softDeleteUser), userController.softDeleteUser);

router
  .route('/connections')
  .get(userIdAuth, validate(userValidation.getAllUser), userController.getAllUser);

router
  .route('/checkAvailability')
  .post(validate(userValidation.checkUserEmailAndUserNameAvailability), userController.checkUserEmailAndUserNameAvailability);

router
  .route('/check-email-availability')
  .post(validate(userValidation.checkUserEmailAvailability), userController.checkUserEmailAvailability);

router
  .route('/changeUserPassword')
  .put(userIdAuth, validate(userValidation.changeUserPassword), userController.changeUserPassword);

router
  .route('/changeUserName')
  .put(userIdAuth, validate(userValidation.changeUserName), userController.changeUserName);



router
  .route('/deActivateUserAccount')
  .put(userIdAuth, validate(userValidation.deActivateUserAccount), userController.deActivateUserAccount);

router.route('/new-user').put(userIdAuth, userController.IsNewUserToggle);

router
  .route('/referrals')
  .get(userIdAuth, validate(userValidation.getReferredUsers), userController.getReferredUsers);



  router
  .route('/eligible')
  .get(userIdAuth, userController.isUserEligibleForRewards);

router
  .route('/rewards')
  .get(userIdAuth, validate(userValidation.getReferredUsers), userController.getRewards);

router
  .route('/rewards/docs')
  .get(
    validate(rewardRedemptionValidation.getAllRewardRedemptions),
    rewardRedemptionController.getAllRewardRedemptions
  );


router
  .route('/rewards/latest/upi-id')
  .put(
    userIdAuth,
    validate(rewardRedemptionValidation.updateLatestRewardRedemptionUpiId),
    rewardRedemptionController.updateLatestRewardRedemptionUpiId
  );

router
  .route('/rewards/:redemptionId/complete')
  .put(
    validate(rewardRedemptionValidation.markRewardRedemptionCompleted),
    rewardRedemptionController.markRewardRedemptionCompleted
  );


router
  .route('/:userId')
  .get(userIdAuth, validate(userValidation.getUser), userController.getUser)
  // .delete(validate(userValidation.deleteUser), userController.deleteUser);


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
