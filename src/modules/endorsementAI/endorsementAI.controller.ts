import { Response } from 'express';
import { userIdExtend } from 'src/config/userIDType';
import EndorseAIModel from './endorsementAI.model';

export const CreateEndorseAI = async (req: userIdExtend, res: Response) => {
  try {
    const { communityId } = req.body;
    const checkEndorsement = await EndorseAIModel.find({ userId: req.userId });
    if (checkEndorsement.length > 0) {
      return res.status(400).json({ message: 'You have already endorsed this community' });
    }

    const endorsement = new EndorseAIModel({
      userId: req.userId,
      communityId,
    });
    const savedEndorsement = await endorsement.save();
    res.status(201).json(savedEndorsement);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};

export const GetEndorseAIByCommunityId = async (req: userIdExtend, res: Response) => {
  try {
    const { communityId } = req.params;
    const endorsements = await EndorseAIModel.find({ communityId }).select('totalGoal numberOfUsersEndorsed');

    const totalGoal = 100;
    const totalUsersEndorsed = endorsements.length;

    const percentage = totalGoal ? (totalUsersEndorsed / totalGoal) * 100 : 0; // Handle division by zero

    res.status(200).json({
      totalGoal,
      totalUsersEndorsed,
      percentage: percentage.toFixed(0),
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};
