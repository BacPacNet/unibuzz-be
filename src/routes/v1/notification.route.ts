import { notificationController } from '../../modules/Notification';
import { userIdAuth } from '../../modules/user';
import { Router } from 'express';

const router: Router = Router();

router
  .route('/')
  .get(userIdAuth, notificationController.getGroupNotification)
  .put(userIdAuth, notificationController.updateGroupNotification);

router.route('/join').put(userIdAuth, notificationController.JoinGroup);

export default router;
