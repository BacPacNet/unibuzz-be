import { Request, Response } from 'express';
import { contactService } from '.';

export const createContactMessage = async (req: Request, res: Response) => {
  const { email, firstName, lastName, message, university } = req.body;

  try {
    await contactService.createContactMessage(email, firstName, lastName, university, message);
    return res.status(200).json({ message: 'Your Message has been sent' });
  } catch (error: any) {
    return res.status(error.statusCode).json({ message: error.message });
  }
};
