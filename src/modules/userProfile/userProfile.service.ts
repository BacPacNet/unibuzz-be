import httpStatus from "http-status";
import { ApiError } from "../errors";
import { UserProfileDocument } from "./userProfile.interface";
import UserProfile from "./userProfile.model";
import mongoose from "mongoose";


export const createUserProfile = async (user:any ) => {
    return await UserProfile.create({users_id:user._id})
  };

  export const getUserProfile= async(id:string)=>{
      const userProfile = await UserProfile.findOne({users_id:id})
      return userProfile
  }


  export const updateUserProfile= async(id:mongoose.Types.ObjectId,userProfileBody:UserProfileDocument)=>{
 
      let userProfileToUpdate

      userProfileToUpdate = await UserProfile.findById(id)

      if(!userProfileToUpdate){
        throw new ApiError(httpStatus.NOT_FOUND, 'User Profile not found!');      
      }
      Object.assign(userProfileToUpdate,userProfileBody)
      let filledPropertiesCount = Object.entries(userProfileToUpdate.toObject())
      .filter(([key, value]) => key !== '_id' && key !== "__v" && key !== "users_id" && key !== "totalFilled" && value !== null && value !== undefined)
      .length;

      let ProfilePercentage = Math.ceil(filledPropertiesCount/13 * 100)
      // console.log(ProfilePercentage);
      


      userProfileToUpdate.totalFilled = ProfilePercentage;


      
      await userProfileToUpdate.save()


      return userProfileToUpdate
    
  
  }