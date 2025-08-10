import { chatController } from '../../modules/chat';
import { userIdAuth } from '../../modules/user';
import { Router } from 'express';

const router: Router = Router();

router.route('/').post(userIdAuth, chatController.Create_Get_Chat).get(userIdAuth, chatController.getUserChats);
router.route('/notification').get(userIdAuth, chatController.getUserMessageNotification);
router.route('/notification-count').get(userIdAuth, chatController.getUserMessageNotificationTotalCount);

router.route('/group').post(userIdAuth, chatController.CreateGroupChat);
// should be that group member
router.route('/group/:groupId/members').get(userIdAuth, chatController.GetGroupChatMember);
router.route('/acceptRequest').put(userIdAuth, chatController.acceptSingleRequest);
router.route('/acceptGroupRequest').put(userIdAuth, chatController.acceptGroupRequest);
router.route('/starred').put(userIdAuth, chatController.toggleStarred);

router.route('/group/:chatId').put(userIdAuth, chatController.ToggleAddToGroup);
router.route('/edit-group/:chatId').put(userIdAuth, chatController.EditGroupChat);
router.route('/leave-group/:chatId').put(userIdAuth, chatController.leaveGroup);
router.route('/group/:chatId').delete(userIdAuth, chatController.deleteChatGroup);
router.route('/block/:userIdToBlock').put(userIdAuth, chatController.toggleBlock);

export default router;
