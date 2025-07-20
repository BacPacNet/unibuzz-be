import mongoose from 'mongoose';
import validator from 'validator';
import bcrypt from 'bcryptjs';
import toJSON from '../toJSON/toJSON';
import paginate from '../paginate/paginate';
import { communityGroupRole, communityGroupRoleAccess, IUserDoc, IUserModel } from './user.interfaces';
import { roles } from '../../config/roles';

const userSchema = new mongoose.Schema<IUserDoc, IUserModel>(
  {
    firstName: {
      type: String,
      required: true,
      trim: true,
    },
    lastName: {
      type: String,
      required: true,
      trim: true,
    },
    userName: {
      type: String,
      required: true,
      trim: true,
      index: true,
    },
    email: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      lowercase: true,
      validate(value: string) {
        if (!validator.isEmail(value)) {
          throw new Error('Invalid email');
        }
      },
      index: true,
    },
    password: {
      type: String,
      required: true,
      trim: true,
      minlength: 8,

      validate: {
        validator: function (value: string) {
          const pattern = /^(?=.*\d)(?=.*[a-z])(?=.*[A-Z])(?=.*[a-zA-Z])(?=.*[!@#$%^&*(),.?":{}|<>]).{8,}$/;
          return pattern.test(value);
        },
        message:
          'Password must contain at least one uppercase letter, one lowercase letter, one number, and one special character',
      },
      private: true, // used by the toJSON plugin
    },

    gender: {
      type: String,
      // required: true,
      trim: true,
    },

    role: {
      type: String,
      enum: roles,
      default: 'user',
    },

    isEmailVerified: {
      type: Boolean,
      default: true,
    },
    isUserDeactive: {
      type: Boolean,
      default: false,
    },
    userVerifiedCommunities: [
      {
        communityId: String,
        communityName: String,
        role: { type: String, enum: communityGroupRole, default: communityGroupRoleAccess.Member },
        communityGroups: [
          {
            communityGroupName: String,
            communityGroupId: String,
            role: { type: String, enum: communityGroupRole, default: communityGroupRoleAccess.Member },
          },
        ],
      },
    ],
    userUnVerifiedCommunities: [
      {
        communityId: String,
        communityName: String,
        communityGroups: [
          {
            communityGroupName: String,
            communityGroupId: String,
            role: { type: String, enum: communityGroupRole, default: communityGroupRoleAccess.Member },
          },
        ],
      },
    ],
  },
  {
    timestamps: true,
  }
);

// add plugin that converts mongoose to json
userSchema.plugin(toJSON);
userSchema.plugin(paginate);

/**
 * Check if email is taken
 * @param {string} email - The user's email
 * @param {ObjectId} [excludeUserId] - The id of the user to be excluded
 * @returns {Promise<boolean>}
 */
userSchema.static('isEmailTaken', async function (email: string, excludeUserId: mongoose.ObjectId): Promise<boolean> {
  const user = await this.findOne({ email, _id: { $ne: excludeUserId } });
  return !!user;
});

/**
 * Check if password matches the user's password
 * @param {string} password
 * @returns {Promise<boolean>}
 */
userSchema.method('isPasswordMatch', async function (password: string): Promise<boolean> {
  const user = this;
  return bcrypt.compare(password, user.password);
});

userSchema.pre('save', async function (next) {
  const user = this;
  if (user.isModified('password')) {
    user.password = await bcrypt.hash(user.password, 8);
  }
  next();
});

const User = mongoose.model<IUserDoc, IUserModel>('User', userSchema);

export default User;
