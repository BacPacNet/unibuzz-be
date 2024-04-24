
import mongoose from "mongoose";
import universityModal from "./university.model";
import { University } from "./university.interface";
import { ApiError } from "../errors";
import httpStatus from "http-status";




export const createUniversity = async (university:University ) => {
    return await universityModal.create(university)
  };

  export const updateUniversity= async(id:mongoose.Types.ObjectId,university:University)=>{
    let universityToUpadate
   
      universityToUpadate = await universityModal.findById(id)

      if(!universityToUpadate){
        throw new ApiError(httpStatus.NOT_FOUND, 'University not found!');      
      }
      Object.assign(universityToUpadate,university)
      await universityToUpadate.save()
      return universityToUpadate
    
  
  }

  export const deleteUniversity= async(id:mongoose.Types.ObjectId)=>{
    return await universityModal.findByIdAndDelete(id)
  }

  export const getAllUniversity=async()=>{
    return await universityModal.find()
  }

  