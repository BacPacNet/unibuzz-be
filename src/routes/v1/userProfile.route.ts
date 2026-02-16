import express, { Router } from 'express';
import { validate } from '../../modules/validate';
import { userIdAuth } from '../../modules/user';
import { userProfileController, userProfileValidation } from '../../modules/userProfile';

const router: Router = express.Router();

router.route('/').put(userIdAuth, validate(userProfileValidation.toggleFollow), userProfileController.toggleFollow);

router.route('/me').get(userIdAuth, userProfileController.getUserProfile);
router.route('/block').put(userIdAuth, validate(userProfileValidation.toggleBlock), userProfileController.toggleBlock);
router.route('/followers').get(userIdAuth, validate(userProfileValidation.getAllUserFollowers), userProfileController.getAllUserFollowers);
router.route('/following').get(userIdAuth, validate(userProfileValidation.getAllUserFollowing), userProfileController.getAllUserFollowing);
router.route('/mutuals').get(userIdAuth, validate(userProfileValidation.getAllMutualUsers), userProfileController.getAllMutualUsers);

// not being used
router.route('/following_and_followers').get(userIdAuth, validate(userProfileValidation.getAllUserFollowersAndFollowing), userProfileController.getAllUserFollowersAndFollowing);

router.route('/blocked_users').get(userIdAuth, userProfileController.getBlockedUsers);
router.route('/addUniversityEmail').put(userIdAuth, validate(userProfileValidation.addUniversityEmail), userProfileController.addUniversityEmail);
router.route('/verifiedUniversityEmails').get(userIdAuth, userProfileController.getUserProfileVerifiedUniversityEmails);
router.route('/:userProfileId').put(validate(userProfileValidation.updateUserProfile), userProfileController.updateUserProfile);

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
