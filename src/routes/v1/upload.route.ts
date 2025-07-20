import { upload } from '../../config/multer';
import { uploadController } from '../../modules/uploadController';
import { userIdAuth } from '../../modules/user';
import { Router } from 'express';

const router: Router = Router();

router.route('/').post(userIdAuth, upload.array('files', 4), uploadController.uploadToS3Controller);

export default router;
