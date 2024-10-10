import { chatController } from '../../modules/chat';
import { userIdAuth } from '../../modules/user';
import { Router } from 'express';

const router: Router = Router();

router.route('/').post(userIdAuth, chatController.Create_Get_Chat).get(userIdAuth, chatController.getUserChats);
router.route('/notification').get(userIdAuth, chatController.getUserMessageNotification);

router.route('/group').post(userIdAuth, chatController.CreateGroupChat);
router.route('/acceptRequest').put(userIdAuth, chatController.acceptSingleRequest);
router.route('/acceptGroupRequest').put(userIdAuth, chatController.acceptGroupRequest);

router.route('/group/:chatId').put(userIdAuth, chatController.ToggleAddToGroup);
router.route('/block/:userIdToBlock').put(userIdAuth, chatController.toggleBlock);

export default router;
