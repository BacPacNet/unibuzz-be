import {
  createEventPost,
  deleteEventPost,
  filterEventPosts,
  getAllEventPosts,
  getEventPostBycommunityId,
  updateEventPost,
} from '../../modules/event/event.controller';
import { userIdAuth } from '../../modules/user';
import { Router } from 'express';

const router: Router = Router();

router.route('/').post(userIdAuth, createEventPost);
router.route('/').get(userIdAuth, getAllEventPosts);
router.route('/:communityId').get(userIdAuth, getEventPostBycommunityId);
router.route('/:id').put(userIdAuth, updateEventPost);
router.route('/:id').delete(userIdAuth, deleteEventPost);
router.route('/filter').get(userIdAuth, filterEventPosts);
export default router;
