import { NextFunction, Request, Response } from 'express';
import httpStatus from 'http-status';
import { userPostCommentsService } from '.';
import mongoose from 'mongoose';
import { ApiError } from '../errors';
import { notificationRoleAccess } from '../Notification/notification.interface';
import { notificationService } from '../Notification';
import { io } from '../../index';

interface extendedRequest extends Request {
  userId?: string;
}

export const CreateComment = async (req: extendedRequest, res: Response, next: NextFunction) => {
  const userID = req.userId;
  const { userPostId } = req.params;

  
  if (!req.body.content) {
    return next(new ApiError(httpStatus.NOT_FOUND, 'Content required!'));
  }
  try {
    if (userID && userPostId) {
     const comment:any = await userPostCommentsService.createUserPostComment(userID, userPostId, req.body);
   
      
        const notifications = {
            sender_id: userID,
            receiverId: comment.userPostId.user_id,
            userPostId:comment.userPostId._id,
            type: notificationRoleAccess.COMMENT,
            message: 'Commented at your Post.',
          };
          if(userID !== comment.userPostId.user_id){
            await notificationService.CreateNotification(notifications);
            io.emit(`notification_${comment.userPostId.user_id}`, { type: notificationRoleAccess.COMMENT });
          }

        

        return res.status(httpStatus.CREATED).json({ comment });
    }

  } catch (error: any) {
    res.status(httpStatus.INTERNAL_SERVER_ERROR).json({ message: error.message });
  }
};

export const updateComment = async (req: Request, res: Response, next: NextFunction) => {
  const { commentId } = req.params;
  try {
    if (typeof commentId == 'string') {
      if (!mongoose.Types.ObjectId.isValid(commentId)) {
        return next(new ApiError(httpStatus.BAD_REQUEST, 'Invalid comment Id'));
      }
      await userPostCommentsService.updateUserPostComment(new mongoose.Types.ObjectId(commentId), req.body);
      return res.status(200).json({ message: 'Updated Successfully' });
    }
  } catch (error: any) {
    res.status(error.statusCode).json({ message: error.message });
  }
};

export const deleteComment = async (req: Request, res: Response, next: NextFunction) => {
  const { commentId } = req.params;
  try {
    if (typeof commentId == 'string') {
      if (!mongoose.Types.ObjectId.isValid(commentId)) {
        return next(new ApiError(httpStatus.BAD_REQUEST, 'Invalid comment ID'));
      }
      await userPostCommentsService.deleteUserPostComment(new mongoose.Types.ObjectId(commentId));
    }
    return res.status(200).json({ message: 'deleted' });
  } catch (error) {
    // console.log(error);
    next(new ApiError(httpStatus.INTERNAL_SERVER_ERROR, 'Failed to delete'));
  }
};

export const getAllUserPostComments = async (req: Request, res: Response, next: NextFunction) => {
  const { userPostId } = req.params;
  let allComments;

  try {
    if (userPostId) {
      allComments = await userPostCommentsService.getAllUserPostComment(userPostId);
      return res.status(200).json({ allComments });
    }
  } catch (error) {
    console.log(req);
    console.log(error);
    next(new ApiError(httpStatus.INTERNAL_SERVER_ERROR, 'Failed to Get post Comments'));
  }
};

export const LikeUserPostComment = async (req: extendedRequest, res: Response) => {
  const { userPostCommentId } = req.params;

  try {
    if (userPostCommentId && req.userId) {
      let likeCount = await userPostCommentsService.likeUnlikeComment(userPostCommentId, req.userId);
      return res.status(200).json({ likeCount });
    }
  } catch (error: any) {
    res.status(httpStatus.INTERNAL_SERVER_ERROR).json({ message: error.message });
  }
};

export const getUserPostComments = async (req: extendedRequest, res: Response) => {
  const { userPostId } = req.params;
  const { page, limit } = req.query;
  try {
    if (userPostId) {
      let comments = await userPostCommentsService.getUserPostComments(userPostId, Number(page), Number(limit));
      return res.status(200).json(comments);
    }
  } catch (error: any) {
    res.status(httpStatus.INTERNAL_SERVER_ERROR).json({ message: error.message });
  }
};

export const getCommentById = async (req: extendedRequest, res: Response) => {
  const { commentId } = req.params;

  try {
    if (commentId) {
      let comments = await userPostCommentsService.getPostCommentById(commentId);
      return res.status(200).json(comments);
    }
  } catch (error: any) {
    res.status(httpStatus.INTERNAL_SERVER_ERROR).json({ message: error.message });
  }
};

export const UserPostCommentReply = async (req: extendedRequest, res: Response) => {
  const { commentId } = req.params;
  const { level, ...body } = req.body;

  try {
    if (commentId && req.userId) {
      let commentReply = await userPostCommentsService.commentReply(commentId, req.userId, body, Number(level));
      return res.status(200).json({ commentReply });
    }
  } catch (error: any) {
    res.status(httpStatus.INTERNAL_SERVER_ERROR).json({ message: error.message });
  }
};
