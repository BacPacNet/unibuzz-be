import { userIdAuth } from '../../modules/user';
import { userProfileController } from '../../modules/userProfile';
import express, { Router } from 'express';

const router: Router = express.Router();

router.route('/').put(userIdAuth, userProfileController.toggleFollow);

router.route('/me').get(userIdAuth, userProfileController.getUserProfile);
router.route('/block').put(userIdAuth, userProfileController.toggleBlock);
router.route('/followers').get(userIdAuth, userProfileController.getAllUserFollowers);
router.route('/following').get(userIdAuth, userProfileController.getAllUserFollowing);
router.route('/mutuals').get(userIdAuth, userProfileController.getAllMututalUsers);
router.route('/following_and_followers').get(userIdAuth, userProfileController.getAllUserFollowersAndFollowing);
router.route('/blocked_users').get(userIdAuth, userProfileController.getBlockedUsers);
router.route('/addUniversityEmail').put(userIdAuth, userProfileController.addUniversityEmail);
router.route('/verifiedUniversityEmails').get(userIdAuth, userProfileController.getUserProfileVerifiedUniversityEmails);
router.route('/:userProfileId').put(userProfileController.updateUserProfile);

export default router;

/**
 * @swagger
 * tags:
 *   name: User Profiles
 *   description: API for managing user profiles
 */

/**
 * @swagger
 * /{userProfileId}:
 *   put:
 *     summary: Update a user profile
 *     tags: [User Profiles]
 *     parameters:
 *       - in: path
 *         name: userProfileId
 *         schema:
 *           type: string
 *         required: true
 *         description: The ID of the user profile
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/UserProfile'
 *     responses:
 *       200:
 *         description: The updated user profile
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/UserProfile'
 */
