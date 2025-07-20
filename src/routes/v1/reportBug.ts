import { validate } from '../../modules/validate';
import { upload } from '../../config/multer';
import { Router } from 'express';
import { reportBugController, reportBugValidation } from '../../modules/reportBug';

const router: Router = Router();

router.route('/').post( upload.single('screenshot'),validate(reportBugValidation.bugReportSchema), reportBugController.submitBugReport);

export default router;
