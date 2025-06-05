import { communityGroupModel } from '../modules/communityGroup';
import mongoose from 'mongoose';

/**
 * Deletes all community groups created by the user,
 * and removes the user from all other community groups they are a member of.
 *
 * @param userId - The ID of the user to remove.
 */
const cleanUpUserFromCommunityGroups = async (userId: mongoose.Types.ObjectId | string) => {
  const session = await mongoose.startSession();
  session.startTransaction();
  try {
    // 1️⃣ Delete all community groups created by the user
    await communityGroupModel.deleteMany({ adminUserId: userId }).session(session);

    // 2️⃣ Remove user from all community groups' users array
    await communityGroupModel.updateMany({ 'users._id': userId }, { $pull: { users: { _id: userId } } }).session(session);

    await session.commitTransaction();
    session.endSession();
    console.log(`✅ Successfully cleaned up user ${userId} from community groups.`);
  } catch (error) {
    await session.abortTransaction();
    session.endSession();
    console.error(`❌ Error cleaning up user ${userId}:`, error);
    throw error;
  }
};

export default cleanUpUserFromCommunityGroups;
