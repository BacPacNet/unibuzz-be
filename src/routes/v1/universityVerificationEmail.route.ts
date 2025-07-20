import { universityVerificationEmailController } from '../../modules/universityVerificationEmail';

import { Router } from 'express';

const router: Router = Router();

router
  .route('/')
  .post(universityVerificationEmailController.createUniversityEmailOtp)
  .put(universityVerificationEmailController.checkUniversityEmailOtp);

export default router;
