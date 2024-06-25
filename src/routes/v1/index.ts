import express, { Router } from 'express';
import authRoute from './auth.route';
import docsRoute from './swagger.route';
import userRoute from './user.route';
import universityRoute from './university.route';
import userProfileRoute from './userProfile.route';
import communityPostsRoute from './communityPosts.route';
import communityPostCommentRoute from './communityPostComment.route';
import communityGroup from './communityGroup.route';
import community from './community.route';
import userFollowRoute from './userFollow.route';
import config from '../../config/config';

const router = express.Router();

interface IRoute {
  path: string;
  route: Router;
}

const defaultIRoute: IRoute[] = [
  {
    path: '/auth',
    route: authRoute,
  },
  {
    path: '/users',
    route: userRoute,
  },
  {
    path: '/university',
    route: universityRoute,
  },
  {
    path: '/userprofile',
    route: userProfileRoute,
  },
  {
    path: '/community',
    route: community,
  },
  {
    path: '/communitypost',
    route: communityPostsRoute,
  },
  {
    path: '/communitypostcomment',
    route: communityPostCommentRoute,
  },
  {
    path: '/communitygroup',
    route: communityGroup,
  },
  {
    path: '/follow',
    route: userFollowRoute,
  },
];

const devIRoute: IRoute[] = [
  // IRoute available only in development mode
  {
    path: '/docs',
    route: docsRoute,
  },
];

defaultIRoute.forEach((route) => {
  router.use(route.path, route.route);
});

/* istanbul ignore next */
if (config.env === 'development') {
  devIRoute.forEach((route) => {
    router.use(route.path, route.route);
  });
}

export default router;
