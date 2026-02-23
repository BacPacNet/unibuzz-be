import { validate } from '../../modules/validate';
import { Router } from 'express';
import { captchaController, captchaValidation } from '../../modules/captcha';

const router: Router = Router();

router.route('/submit').post(validate(captchaValidation.verifyCaptchaSchema), captchaController.submitCaptcha);

export default router;
