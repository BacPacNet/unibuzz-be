import { reportContentController } from '../../modules/reportContent';
import { userIdAuth } from '../../modules/user';
import { Router } from 'express';

const router: Router = Router();

router.route('/').post(userIdAuth, reportContentController.createReportContent);

export default router;
