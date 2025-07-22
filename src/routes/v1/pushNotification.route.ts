import { userIdAuth } from '../../modules/user';
import { Router } from 'express';
import { pushNotificationController } from '../../modules/pushNotification';

const router: Router = Router();

router.route('/').post(userIdAuth, pushNotificationController.CreatePushNotificationToken);

router.route('/:userID').put(pushNotificationController.sendNotification);

export default router;
