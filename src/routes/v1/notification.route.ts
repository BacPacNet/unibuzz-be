import { notificationController } from '../../modules/Notification';
import { userIdAuth } from '../../modules/user';
import { Router } from 'express';

const router: Router = Router();

router
  .route('/')
  .get(userIdAuth, notificationController.getGroupNotification)
  .put(userIdAuth, notificationController.updateGroupNotification);

router.route('/user').get(userIdAuth, notificationController.getUserNotification);
router.route('/user/total-count').get(userIdAuth, notificationController.getUserNotificationTotalCount);
router.route('/user/read-all').put(userIdAuth, notificationController.markUserNotificationsAsRead);

router.route('/join').put(userIdAuth, notificationController.JoinGroup);

export default router;
