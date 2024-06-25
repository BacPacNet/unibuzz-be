import { communityController } from '../../modules/community';
import { Router } from 'express';

const router: Router = Router();

router.route('/:communityId').get(communityController.getCommunity).put(communityController.updateCommunity);

export default router;
