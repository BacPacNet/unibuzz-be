import httpStatus from 'http-status';
import { Request, Response } from 'express';
// import ApiError from '../errors/ApiError';
import * as universityService from './university.service';
import mongoose from 'mongoose';
import { ApiError } from '../errors';


// create university
export const createUniversity = async (req: Request, res: Response) => {
  let university
  try {
     university = await universityService.createUniversity(req.body);
     return res.status(httpStatus.CREATED).send(university);
  } catch (error) {
    console.log(error);
    res.status(httpStatus.INTERNAL_SERVER_ERROR).json({message:"Failed to create!"})
  }
 
  };


  // update university
  export const updateUniversity = async(req:Request, res:Response)=>{
    const {id} = req.params;
    // return console.log(id);
    
    try {
      if(typeof id == "string"){
     await universityService.updateUniversity(new mongoose.Types.ObjectId(id),req.body)
    
     return  res.status(200).json({message:"Updated Successfully"})
      }
    } catch (error:any) {
      // console.log("err",error.message);
       res.status(error.statusCode).json({message:error.message})
    }

    
}




// delete university
export const deleteUniversity=async(req:Request, res:Response)=>{
  const {id} = req.params;
  // return console.log(id);
  
  try {
    if(typeof id == "string"){
      await universityService.deleteUniversity(new mongoose.Types.ObjectId(id))

    }
    return res.status(200).json({message:"deleted"})
  } catch (error) {
    console.log(error);
    throw new ApiError(httpStatus.INTERNAL_SERVER_ERROR, 'Failed to delete');
    
  }
  
}


// get All university
export const getAllUniversity=async(req:Request, res:Response)=>{
  let allUniversity

  try {
       allUniversity = await universityService.getAllUniversity()
       return res.status(200).json({allUniversity})
  } catch (error) {
    console.log(req);
    console.log(error);
    throw new ApiError(httpStatus.INTERNAL_SERVER_ERROR, 'Failed to Get University');
  }
  
}