import { chatBotController } from '../../modules/chatbot';
import { userIdAuth } from '../../modules/user';
import { Router } from 'express';

const router: Router = Router();

router.route('/thread').get(userIdAuth, chatBotController.createThread);

router.route('/message').post(userIdAuth, chatBotController.addMessage);

router.route('/check-assistant').get(userIdAuth, chatBotController.checkAssistant);

export default router;
