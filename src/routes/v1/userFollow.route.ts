import { userIdAuth } from '../../modules/user';
import { userFollowController } from '../../modules/userFollow';
import { Router } from 'express';

const router: Router = Router();

router.route('/').get(userIdAuth, userFollowController.getFollowCounts);

router.get('/following', userIdAuth, userFollowController.getUserFollowing);
router.get('/followers', userIdAuth, userFollowController.getUserFollowers);

router.route('/:userToFollowId').put(userIdAuth, userFollowController.toggleFollow);

export default router;
