import express, { Router } from 'express';
import { validate } from '../../modules/validate';
import { appVersionController, appVersionValidation } from '../../modules/appVersion';

const router: Router = express.Router();

// Public helper endpoint (safe for web/app).
router.route('/required').get(validate(appVersionValidation.required), appVersionController.required);




export default router;

