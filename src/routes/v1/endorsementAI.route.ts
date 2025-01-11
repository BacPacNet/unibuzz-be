import { EndorseAIController } from '@/modules/endorsementAI';
import { userIdAuth } from '../../modules/user';
import express, { Router } from 'express';

const router: Router = express.Router();

router.route('/').post(userIdAuth, EndorseAIController.CreateEndorseAI);
router.route('/:communityId').get(userIdAuth, EndorseAIController.GetEndorseAIByCommunityId);

export default router;
