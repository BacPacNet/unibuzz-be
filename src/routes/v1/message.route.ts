import express, { Router } from 'express';
import { validate } from '../../modules/validate';
import { messageController, messageValidation } from '../../modules/message';
import { userIdAuth } from '../../modules/user';

const router: Router = express.Router();

router
  .route('/')
  .post(userIdAuth, validate(messageValidation.sendMessage), messageController.sendMessge);

router
  .route('/react')
  .put(userIdAuth, validate(messageValidation.reactToMessage), messageController.reactToMessage);

router
  .route('/:chatId')
  .get(userIdAuth, validate(messageValidation.getUserMessages), messageController.getUserMessages);

router
  .route('/:messageId')
  .put(userIdAuth, validate(messageValidation.updateMessageIsSeen), messageController.UpdateMessageIsSeen);

export default router;
