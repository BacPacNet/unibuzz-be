import express, { Router } from 'express';
import authRoute from './auth.route';
import docsRoute from './swagger.route';
import userRoute from './user.route';
import universityRoute from './university.route';
import userProfileRoute from './userProfile.route';
import communityPostsRoute from './communityPosts.route';
import userPostRoute from './userPost.route';
import communityPostCommentRoute from './communityPostComment.route';
import communityGroup from './communityGroup.route';
import community from './community.route';
import userFollowRoute from './userFollow.route';
import notificationRoute from './notification.route';
import config from '../../config/config';
import userPostCommentsRoute from './userPostComment.route';
import chatRoute from './chat.route';
import messageRoute from './message.route';
import loginEmailVerificationRoute from './loginEmailVerification.route';
import universityEmailVerificationRoute from './universityVerificationEmail.route';
import eventRoute from './events.route';
import endorseRoute from './endorsementAI.route';
import chatbotRoute from './chatbot.route';
import contactRoute from './contact.route';
import uploadRoute from './upload.route';
import reportBug from './reportBug';
import pushNotification from './pushNotification.route';

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
    path: '/useremailverification',
    route: loginEmailVerificationRoute,
  },
  {
    path: '/universityemailverification',
    route: universityEmailVerificationRoute,
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
  {
    path: '/notification',
    route: notificationRoute,
  },
  {
    path: '/userpost',
    route: userPostRoute,
  },
  {
    path: '/userpostcomment',
    route: userPostCommentsRoute,
  },
  {
    path: '/chat',
    route: chatRoute,
  },
  {
    path: '/message',
    route: messageRoute,
  },
  {
    path: '/eventpost',
    route: eventRoute,
  },
  {
    path: '/endorsementAI',
    route: endorseRoute,
  },
  {
    path: '/chatbot',
    route: chatbotRoute,
  },
  {
    path: '/contact',
    route: contactRoute,
  },
  {
    path: '/upload',
    route: uploadRoute,
  },
  {
    path: '/report-bug',
    route: reportBug,
  },
  {
    path: '/push-notification',
    route: pushNotification,
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
