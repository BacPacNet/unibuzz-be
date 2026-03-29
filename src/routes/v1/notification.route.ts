import express, { Router } from 'express';
import { validate } from '../../modules/validate';
import { notificationController, notificationValidation } from '../../modules/Notification';
import { userIdAuth } from '../../modules/user';

const router: Router = express.Router();

router
  .route('/')
  .get(userIdAuth, validate(notificationValidation.getGroupNotification), notificationController.getGroupNotification)
  .put(userIdAuth, validate(notificationValidation.updateGroupNotification), notificationController.updateGroupNotification);

router
  .route('/user')
  .get(userIdAuth, validate(notificationValidation.getUserNotification), notificationController.getUserNotification);

router.route('/user/total-count').get(userIdAuth, notificationController.getUserNotificationTotalCount);
router.route('/user/read-all').put(userIdAuth, notificationController.markUserNotificationsAsRead);

router
  .route('/join')
  .put(userIdAuth, validate(notificationValidation.joinGroup), notificationController.JoinGroup);

export default router;
