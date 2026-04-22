import express, { Router } from 'express';
import { validate } from '../../modules/validate';
import { universityController, universityValidation } from '../../modules/university';

const router: Router = express.Router();

router
  .route('/')
  .get(validate(universityValidation.getAllUniversity), universityController.getAllUniversity);

router
  .route('/searched')
  .get(validate(universityValidation.searchUniversityByQuery), universityController.searchUniversityByQuery);

router
  .route('/:university_name/dashboard-stats')
  .get(
    validate(universityValidation.getUniversityDashboardStats),
    universityController.getUniversityDashboardStats
  );

router
  .route('/:university_name')
  .get(validate(universityValidation.getUniversityById), universityController.getUniversityById);

export default router;

