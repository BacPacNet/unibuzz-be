import followingRelationship from './userFollow.model';

export const follow_unfollow_User = async (userId: string, userToFollowId: string) => {
  try {
    const existingFollow = await followingRelationship.findOne({
      user_id: userId,
      following_user_id: userToFollowId,
    });

    if (!existingFollow) {
      await followingRelationship.create({ user_id: userId, following_user_id: userToFollowId });
      return { message: 'Started Following' };
    }

    await existingFollow.deleteOne();
    return { message: 'Unfollowed' };
  } catch (error) {
    throw new Error('Error in follow_unfollow_User: ' + error);
  }
};

export const getFollowCounts = async (userId: string) => {
  try {
    // Count the number of users that the user is following
    const followingCount = await followingRelationship.countDocuments({ user_id: userId });

    // Count the number of users that are following the user
    const followerCount = await followingRelationship.countDocuments({ following_user_id: userId });

    return {
      followingCount,
      followerCount,
    };
  } catch (error) {
    throw new Error('Error in getFollowCounts: ' + error);
  }
};
