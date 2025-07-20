import { contactController } from '../../modules/contact';

import { Router } from 'express';

const router: Router = Router();

router.route('/').post(contactController.createContactMessage);

export default router;
