import { userIdAuth } from '../../modules/user';
import { communityGroupController } from '../../modules/communityGroup';
import express, { Router } from 'express';

const router: Router = express.Router();

router
  .route('/:communityId')
  .get(userIdAuth, communityGroupController.getCommunityGroupById)
  .post(userIdAuth, communityGroupController.CreateCommunityGroup);

router
  .route('/:groupId')
  .put(communityGroupController.updateCommunityGroup)
  .delete(communityGroupController.deleteCommunityGroup);

router.route('/status/:groupId').put(communityGroupController.changeCommunityGroupStatus);

router.route('/join-request/:groupId').put(communityGroupController.updateCommunityGroupJoinRequest);

router.route('/:groupId/join').put(userIdAuth, communityGroupController.joinCommunityGroup);

router.route('/:groupId/leave').delete(userIdAuth, communityGroupController.leaveCommunityGroup);

router.route('/:groupId/user/:userId').delete(userIdAuth, communityGroupController.removeUserFromCommunityGroup);

export default router;

/**
 * @swagger
 * tags:
 *   name: Community Groups
 *   description: API for managing community groups
 */

/**
 * @swagger
 * /{communityId}:
 *   get:
 *     summary: Get all community groups
 *     tags: [Community Groups]
 *     parameters:
 *       - in: path
 *         name: communityId
 *         schema:
 *           type: string
 *         required: true
 *         description: The community ID
 *     responses:
 *       200:
 *         description: A list of community groups
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/CommunityGroup'
 */

/**
 * @swagger
 * /{communityId}:
 *   post:
 *     summary: Create a new community group
 *     tags: [Community Groups]
 *     parameters:
 *       - in: path
 *         name: communityId
 *         schema:
 *           type: string
 *         required: true
 *         description: The community ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/CommunityGroup'
 *     responses:
 *       201:
 *         description: The created community group
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/CommunityGroup'
 */

/**
 * @swagger
 * /{groupId}:
 *   put:
 *     summary: Update a community group
 *     tags: [Community Groups]
 *     parameters:
 *       - in: path
 *         name: groupId
 *         schema:
 *           type: string
 *         required: true
 *         description: The group ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/CommunityGroup'
 *     responses:
 *       200:
 *         description: The updated community group
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/CommunityGroup'
 */

/**
 * @swagger
 * /{groupId}:
 *   delete:
 *     summary: Delete a community group
 *     tags: [Community Groups]
 *     parameters:
 *       - in: path
 *         name: groupId
 *         schema:
 *           type: string
 *         required: true
 *         description: The group ID
 *     responses:
 *       204:
 *         description: No content
 */
