import express, { Router } from 'express';
import { validate } from '../../modules/validate';
import { universityController, universityHighlightsController, universityValidation } from '../../modules/university';
import { userIdAuth } from '../../modules/user';
import { requireSuperAdmin } from '../../modules/superAdmins';

const router: Router = express.Router();

router
  .route('/')
  .get(validate(universityValidation.getAllUniversity), universityController.getAllUniversity);

router
  .route('/partnered')
  .get(universityController.getPartneredUniversities);

router
  .route('/searched')
  .get(validate(universityValidation.searchUniversityByQuery), universityController.searchUniversityByQuery);


router
  .route('/highlights/:universityId')
  .get(universityHighlightsController.getUniversityHighlights)
  .post(
    userIdAuth,
    validate(universityValidation.addUniversityHighlightPost),
    universityHighlightsController.addUniversityHighlightPost
  )
  .put(
    userIdAuth,
    validate(universityValidation.updateUniversityHighlightPostPositions),
    universityHighlightsController.updateUniversityHighlightPostPositions
  );

router
  .route('/highlights/:universityId/:postId')
  .delete(
    userIdAuth,
    requireSuperAdmin,
    validate(universityValidation.deleteUniversityHighlightPost),
    universityHighlightsController.deleteUniversityHighlightPost
  );


  router
  .route('/id/:universityId')
  .get(
    validate(universityValidation.getUniversityByUniversityId),
    universityController.getUniversityByUniversityId
  );

router
  .route('/:university_name/dashboard-stats')
  .get(
    validate(universityValidation.getUniversityDashboardStats),
    universityController.getUniversityDashboardStats
  );

router
  .route('/:university_name/semester-start')
  .put(
    userIdAuth,
    requireSuperAdmin,
    validate(universityValidation.setSemesterStart),
    universityController.setSemesterStart
  );

router
  .route('/:universityId/profile')
  .put(
    userIdAuth,
    requireSuperAdmin,
    validate(universityValidation.updateUniversityProfile),
    universityController.updateUniversityProfile
  );



router
  .route('/:university_name')
  .get(validate(universityValidation.getUniversityByName), universityController.getUniversityByName);

export default router;

