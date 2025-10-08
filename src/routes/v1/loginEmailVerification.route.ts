import { loginEmailVerificationController } from '../../modules/loginEmailVerification';

import { Router } from 'express';

const router: Router = Router();

router
  .route('/')
  .post(loginEmailVerificationController.createLoginEmailOtp)
  .put(loginEmailVerificationController.checkLoginEmailOtpV2);
export default router;
