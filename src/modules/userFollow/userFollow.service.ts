import { UserProfile } from '../userProfile';
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

export const getUserFollowing = async (name: string, userId: string) => {
  let query: any;

  query = {
    user_id: userId,
  };

  if (name) {
    let nameParts = name.split(' ').filter((part) => part);
    if (nameParts.length > 1) {
      query.$and = nameParts.map((part) => ({
        $or: [{ firstName: new RegExp(part, 'i') }, { lastName: new RegExp(part, 'i') }],
      }));
    } else {
      let regName = new RegExp(name, 'i');
      query.$or = [{ firstName: regName }, { lastName: regName }];
    }
  }

  const userFollowing: any = await followingRelationship.find(query).populate('following_user_id').lean();
  const userIds = userFollowing.map((user: any) => user.following_user_id._id);
  const userProfiles = await UserProfile.find({ users_id: { $in: userIds } }).select(
    'profile_dp university_name study_year degree major users_id major occupation'
  );

  const userWithProfile = userFollowing.map((user: any) => {
    const profile = userProfiles.find((profile) => profile.users_id.toString() == user.following_user_id._id.toString());
    return {
      ...user,
      profile,
    };
  });
  return userWithProfile;
  // return userFollowing
};

export const getUserFollowers = async (name: string, userId: string) => {
  let query: any;

  query = {
    following_user_id: userId,
  };

  if (name) {
    let nameParts = name.split(' ').filter((part) => part);
    if (nameParts.length > 1) {
      query.$and = nameParts.map((part) => ({
        $or: [{ firstName: new RegExp(part, 'i') }, { lastName: new RegExp(part, 'i') }],
      }));
    } else {
      let regName = new RegExp(name, 'i');
      query.$or = [{ firstName: regName }, { lastName: regName }];
    }
  }

  const userFollowers: any = await followingRelationship.find(query).populate('user_id').lean();
  const userIds = userFollowers.map((user: any) => user.user_id._id);
  const userProfiles = await UserProfile.find({ users_id: { $in: userIds } }).select(
    'profile_dp university_name study_year degree major users_id major occupation'
  );

  const userWithProfile = userFollowers.map((user: any) => {
    const profile = userProfiles.find((profile) => profile.users_id.toString() == user.user_id._id.toString());
    return {
      ...user,
      profile,
    };
  });
  return userWithProfile;

  // return userFollowers
};
