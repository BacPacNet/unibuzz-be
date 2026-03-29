import express, { Router } from 'express';
import { validate } from '../../modules/validate';
import { chatController, chatValidation } from '../../modules/chat';
import { userIdAuth } from '../../modules/user';

const router: Router = express.Router();

router
  .route('/')
  .post(userIdAuth, validate(chatValidation.createGetChat), chatController.Create_Get_Chat)
  .get(userIdAuth, chatController.getUserChats);

router
  .route('/notification')
  .get(userIdAuth, validate(chatValidation.getUserMessageNotification), chatController.getUserMessageNotification);

router.route('/notification-count').get(userIdAuth, chatController.getUserMessageNotificationTotalCount);

router
  .route('/group')
  .post(userIdAuth, validate(chatValidation.createGroupChat), chatController.CreateGroupChat);

router
  .route('/group/:groupId/members')
  .get(userIdAuth, validate(chatValidation.getGroupChatMember), chatController.GetGroupChatMember);

router
  .route('/acceptRequest')
  .put(userIdAuth, validate(chatValidation.acceptSingleRequest), chatController.acceptSingleRequest);

router
  .route('/acceptGroupRequest')
  .put(userIdAuth, validate(chatValidation.acceptGroupRequest), chatController.acceptGroupRequest);

router.route('/starred').put(userIdAuth, validate(chatValidation.toggleStarred), chatController.toggleStarred);

router
  .route('/group/:chatId')
  .put(userIdAuth, validate(chatValidation.toggleAddToGroup), chatController.ToggleAddToGroup)
  .delete(userIdAuth, validate(chatValidation.deleteChatGroup), chatController.deleteChatGroup);

router
  .route('/edit-group/:chatId')
  .put(userIdAuth, validate(chatValidation.editGroupChat), chatController.EditGroupChat);

router
  .route('/leave-group/:chatId')
  .put(userIdAuth, validate(chatValidation.leaveGroup), chatController.leaveGroup);



export default router;
