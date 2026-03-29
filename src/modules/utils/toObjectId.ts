import mongoose from "mongoose";

/** Normalize an id to ObjectId (handles string or ObjectId). */
const toObjectId = (id: string | mongoose.Types.ObjectId): mongoose.Types.ObjectId => {
    return id instanceof mongoose.Types.ObjectId ? id : new mongoose.Types.ObjectId(id);
  }

  export default toObjectId;