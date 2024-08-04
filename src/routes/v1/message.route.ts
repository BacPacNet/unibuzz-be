import { messageController } from '../../modules/message';
import { userIdAuth } from '../../modules/user';
import { Router } from 'express';

const router: Router = Router();

router.route('/').post(userIdAuth, messageController.sendMessge);

router.route('/:chatId').get(userIdAuth, messageController.getUserMessages);

export default router;
