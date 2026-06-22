import httpStatus from 'http-status';
import { Request, Response } from 'express';
import mongoose from 'mongoose';
import catchAsync from '../utils/catchAsync';
import { ApiError } from '../errors';
import * as universityService from './university.service';
import universityModal from './university.model';
import * as communityPostsService from '../communityPosts/communityPosts.service';
import { userPostService } from '../userPost';

const POST_TYPE_COMMUNITY = 'Community' as const;
const POST_TYPE_TIMELINE = 'Timeline' as const;

export const getUniversityHighlights = catchAsync(async (req: Request, res: Response) => {
  const { universityId } = req.params;

  if (!universityId) {
    throw new ApiError(httpStatus.BAD_REQUEST, 'University ID is required');
  }

  const university = await universityModal.findById(new mongoose.Types.ObjectId(universityId)).lean();

  if (!university) {
    throw new ApiError(httpStatus.NOT_FOUND, 'University not found');
  }

  const sortedHighlights = [...(university.highlightPosts || [])].sort(
    (a, b) => a.position - b.position
  );

  const results = await Promise.all(
    sortedHighlights.map(async (highlight) => {
      try {
        if (highlight.postType === 'CommunityPost') {
          const result = await communityPostsService.getCommunityPostForHighlight(
            highlight.postId.toString()
          );

          return {
            highlight,
            post: result
              ? {
                  ...result,
                  postType: POST_TYPE_COMMUNITY,
                  position: highlight.position,
                }
              : null,
          };
        }

        if (highlight.postType === 'UserPost') {
          const result = await userPostService.getUserHighlightPost(highlight.postId.toString());

          return {
            highlight,
            post: result
              ? {
                  ...result,
                  postType: POST_TYPE_TIMELINE,
                  position: highlight.position,
                }
              : null,
          };
        }

        return { highlight, post: null };
      } catch {
        return { highlight, post: null };
      }
    })
  );

  const missingPostIds = results.filter((result) => !result.post).map((result) => result.highlight.postId);

  if (missingPostIds.length > 0) {
    await universityModal.findByIdAndUpdate(new mongoose.Types.ObjectId(universityId), {
      $pull: { highlightPosts: { postId: { $in: missingPostIds } } },
    });
  }

  const posts = results.map((result) => result.post).filter(Boolean);

  return res.status(httpStatus.OK).json(posts);
});

export const addUniversityHighlightPost = catchAsync(async (req: Request, res: Response) => {
  const { universityId } = req.params;
  const { postId, postType, position } = req.body;

  const university = await universityService.addUniversityHighlightPost(universityId as string, {
    postId,
    postType,
    position,
  });

  return res.status(httpStatus.CREATED).json(university);
});

export const deleteUniversityHighlightPost = catchAsync(async (req: Request, res: Response) => {
  const { universityId, postId } = req.params;

  const university = await universityService.deleteUniversityHighlightPost(
    universityId as string,
    postId as string
  );

  return res.status(httpStatus.OK).json(university);
});
