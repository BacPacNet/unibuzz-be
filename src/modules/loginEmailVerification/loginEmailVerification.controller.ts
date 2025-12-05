import { Request, Response } from 'express';
import { loginEmailVerificationService } from '.';
import { universityUsersService } from '../universityUsers';

export const createLoginEmailOtp = async (req: Request, res: Response) => {
  const { email } = req.body;

  try {
    await loginEmailVerificationService.createloginEmailVerificationOtp(email);
    return res.status(200).json({ message: 'created', isAvailable: true });
  } catch (error: any) {
    console.log('err', error.message);
    return res.status(error.statusCode).json({ message: error.message, isAvailable: false });
  }
};

export const checkLoginEmailOtp = async (req: Request, res: Response) => {
  const { verificationOtp, email } = req.body;

  try {
    await loginEmailVerificationService.checkloginEmailVerificationOtp(verificationOtp, email);
    return res.status(200).json({ message: 'created', isAvailable: true });
  } catch (error: any) {
    console.log('err', error.message);
    return res.status(error.statusCode).json({ message: error.message, isAvailable: false });
  }
};
export const checkLoginEmailOtpV2 = async (req: Request, res: Response) => {
  const { verificationOtp, email, universityId, name, dob } = req.body;

  try {
    // first check the otp
    const isOtpValid = await loginEmailVerificationService.checkloginEmailVerificationOtpV2(verificationOtp, email);
    // if the otp is valid, then check the user details
    if (isOtpValid.nextCheck) {
      // check the user details from universityUsers collection
      const universityUsers = await universityUsersService.findUniversityUsersByUserDetails(email, universityId, name, dob);
      if (universityUsers.isDomainValid) {
        // if the user details are valid, then return true
        return res.status(200).json({ message: 'User is university user', isAvailable: true, isUniversityDomain: true });
      } else {
        // if the user details are not valid, then return false
        return res
          .status(200)
          .json({ message: 'User is not university user', isAvailable: false, isUniversityDomain: false });
      }
    }
  } catch (error: any) {
    console.log('err', error.message);
    return res.status(error.statusCode).json({ message: error.message, isAvailable: false });
  }
};
