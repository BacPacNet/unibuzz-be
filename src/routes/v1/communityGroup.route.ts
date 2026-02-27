import express, { Router } from 'express';
import { validate } from '../../modules/validate';
import { userIdAuth } from '../../modules/user';
import { communityGroupController, communityGroupValidation } from '../../modules/communityGroup';

const router: Router = express.Router();

// query-params:
// communityGroupId:string, userStatus: string,page: number,limit: number,
router
  .route('/members')
  .get(userIdAuth, validate(communityGroupValidation.getCommunityGroupMembers), communityGroupController.getCommunityGroupMembers);

router
  .route('/:communityId')
  .get(
    userIdAuth,
    validate(communityGroupValidation.getCommunityGroupById),
    communityGroupController.getCommunityGroupById
  )
  .post(
    userIdAuth,
    validate(communityGroupValidation.createCommunityGroup),
    communityGroupController.CreateCommunityGroup
  );

router
  .route('/:groupId')
  .put(validate(communityGroupValidation.updateCommunityGroup), communityGroupController.updateCommunityGroup)
  .delete(validate(communityGroupValidation.deleteCommunityGroup), communityGroupController.deleteCommunityGroup);

router
  .route('/status/:groupId')
  .put(
    userIdAuth,
    validate(communityGroupValidation.changeCommunityGroupStatus),
    communityGroupController.changeCommunityGroupStatus
  );

router
  .route('/join-request/:groupId')
  .put(
    userIdAuth,
    validate(communityGroupValidation.updateCommunityGroupJoinRequest),
    communityGroupController.updateCommunityGroupJoinRequest
  );

router
  .route('/:groupId/join')
  .put(userIdAuth, validate(communityGroupValidation.joinCommunityGroup), communityGroupController.joinCommunityGroup);

router
  .route('/:groupId/leave')
  .delete(
    userIdAuth,
    validate(communityGroupValidation.leaveCommunityGroup),
    communityGroupController.leaveCommunityGroup
  );

router
  .route('/:groupId/user/:userId')
  .delete(
    userIdAuth,
    validate(communityGroupValidation.removeUserFromCommunityGroup),
    communityGroupController.removeUserFromCommunityGroup
  );

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
