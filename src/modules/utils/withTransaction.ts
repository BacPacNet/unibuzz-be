import mongoose from "mongoose";

/**
 * Runs an async function inside a MongoDB transaction.
 * Handles commit on success, abort on error, and always ends the session.
 */
 const withTransaction = async <T>(
    fn: (session: mongoose.mongo.ClientSession) => Promise<T>
  ): Promise<T> => {
    const session = await mongoose.startSession();
    session.startTransaction();
    try {
      const result = await fn(session);
      await session.commitTransaction();
      return result;
    } catch (error) {
      await session.abortTransaction();
      throw error;
    } finally {
      session.endSession();
    }
  };

  export default withTransaction;