import { Schema, model } from 'mongoose';
import { allowedCategories, allowedSubcategories, communityGroupInterface } from './communityGroup.interface';
import { communityGroupAccess, communityGroupType } from '../../config/community.type';

const communityGroupSchema = new Schema<communityGroupInterface>(
  {
    adminUserId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    communityId: {
      type: Schema.Types.ObjectId,
      ref: 'community',
      required: true,
    },
    communityGroupLogoUrl: { imageUrl: String, publicId: String },
    communityGroupLogoCoverUrl: { imageUrl: String, publicId: String },
    title: {
      type: String,
      required: true,
    },
    description: {
      type: String,
    },
    memberCount: {
      type: Number,
      default: 0,
    },
    communityGroupAccess: {
      type: String,
      enum: ['Private', 'Public'],
      default: communityGroupAccess.Public,
    },
    communityGroupType: {
      type: String,
      enum: ['Casual', 'Official'],
      default: communityGroupType.CASUAL,
    },

    communityGroupCategory: {
      type: Map,
      of: [String],
      required: true,
      validate: [
        {
          validator: function (value: Map<string, string[]>): boolean {
            return value.size > 0; // Allow multiple categories
          },
          message: 'At least one category must be specified.',
        },
        {
          validator: function (value: Map<string, string[]>): boolean {
            for (const key of value.keys()) {
              if (!allowedCategories.has(key)) {
                return false;
              }
            }
            return true;
          },
          message: `Invalid category key.`,
        },
        {
          validator: function (value: Map<string, string[]>): boolean {
            for (const [key, subcategories] of value.entries()) {
              const allowedSubs = allowedSubcategories[key];
              if (!allowedSubs) {
                if (subcategories.length > 0) {
                  return false;
                }
              } else {
                const subSet = new Set(allowedSubs);
                for (const sub of subcategories) {
                  if (!subSet.has(sub)) {
                    return false;
                  }
                }
              }
            }
            return true;
          },
          message: function (props: { value: Map<string, string[]> }): string {
            const invalidEntries = [];
            for (const [key] of props.value.entries()) {
              if (!allowedCategories.has(key)) {
                invalidEntries.push(`"${key}"`);
              }
            }
            return `Invalid categories: ${invalidEntries.join(', ')}.`;
          },
        },
      ],
    },
    users: [
      {
        userId: { type: Schema.Types.ObjectId, ref: 'User' },
        isRequestAccepted: { type: Boolean, default: false },
        firstName: String,
        lastName: String,
        universityName: String,
        year: String,
        degree: String,
        major: String,
        profileImageUrl: String || null,
      },
    ],
  },
  { timestamps: true }
);

const communityGroupModel = model<communityGroupInterface>('communityGroup', communityGroupSchema);

export default communityGroupModel;
