import mongoose from "mongoose";

/** Normalize an id to string (handles string or ObjectId). */
 const toIdString = (id: string | mongoose.Types.ObjectId): string => {
    return typeof id === 'string' ? id : id.toString();
  }

  export default toIdString;