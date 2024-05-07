import { userProfileController } from '../../modules/userProfile';
import express, { Router } from 'express';

const router: Router = express.Router();

router.route('/:userProfileId').put(userProfileController.updateUserProfile);

export default router;
