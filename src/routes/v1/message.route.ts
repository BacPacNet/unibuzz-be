import { messageController } from '../../modules/message';
import { userIdAuth } from '../../modules/user';
import { Router } from 'express';

const router: Router = Router();

router.route('/').post(userIdAuth, messageController.sendMessge);
router.route('/react').put(userIdAuth, messageController.reactToMessage);
router.route('/:chatId').get(userIdAuth, messageController.getUserMessages);
router.route('/:messageId').put(userIdAuth, messageController.UpdateMessageIsSeen);

export default router;
