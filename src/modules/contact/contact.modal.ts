import { Schema, model } from 'mongoose';
import { contactInterface } from './contact.interface';

const ContactSchema = new Schema<contactInterface>({
  email: { type: String, required: true },
  firstName: { type: String, required: true },
  lastName: { type: String, required: true },
  message: { type: String, required: true },
  university: { type: String },
});

const contactModal = model<contactInterface>('contact', ContactSchema);

export default contactModal;
