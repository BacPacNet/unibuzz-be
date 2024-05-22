import { userProfileController } from '../../modules/userProfile';
import express, { Router } from 'express';

const router: Router = express.Router();

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