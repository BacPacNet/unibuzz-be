import followingRelationship from './userFollow.model';

export const follow_unfollow_User = async (userId: string, userToFollowId: string) => {
  try {
    // Check if the user is already following the userToFollowId
    const existingFollow = await followingRelationship.findOne({
      user_id: userId,
      following_user_id: userToFollowId,
    });

    if (!existingFollow) {
      // Create a new follow relationship
      await followingRelationship.create({ user_id: userId, following_user_id: userToFollowId });
      return { message: 'Started Following' };
    }

    // If the relationship exists, remove it
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
