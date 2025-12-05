/**
 * University Users Service
 *
 * This service handles operations related to finding and verifying university users.
 * It provides functionality to search for users in university databases using various
 * matching criteria (email, name, date of birth) and validates university email domains.
 */

import mongoose from 'mongoose';
import universityUsersModel from './universityUsers.model';
import { universityVerificationEmailService } from '../universityVerificationEmail';

/**
 * Finds university users using MongoDB aggregation pipeline
 *
 * This function searches for users in the university users collection by matching:
 * - Email address (exact match)
 * - OR First name + Date of Birth (case-insensitive name match)
 *
 * @param {string} email - User's email address
 * @param {string} universityId - MongoDB ObjectId of the university
 * @param {string} name - User's full name (only first name is used for matching)
 * @param {string} dob - Date of birth (formatted as string, slashes are normalized to hyphens)
 * @returns {Promise<Object|null>} - Returns the matched university user document or null if not found
 */
export const findUniversityUsersAgg = async (email: string, universityId: string, name: string, dob: string) => {
  // Normalize date format: convert slashes to hyphens for consistent matching
  // e.g., "01/15/1990" becomes "01-15-1990"
  const normalizedDob = dob.replace(/\//g, '-');

  // MongoDB aggregation pipeline to find matching users
  const pipeline = [
    // Stage 1: Filter documents by university ID
    { $match: { universityId: new mongoose.Types.ObjectId(universityId) } },
    {
      // Stage 2: Project and filter the details array to find matching user entries
      $project: {
        details: {
          $filter: {
            input: '$details', // Array of user details within the university document
            as: 'd', // Alias for each detail item
            cond: {
              // Match if either condition is true:
              $or: [
                // Condition 1: Exact email match
                { $eq: ['$$d.email', email] },
                {
                  // Condition 2: First name (case-insensitive) AND date of birth match
                  $and: [
                    {
                      // Extract first name from full name, convert to lowercase, and compare
                      $eq: [{ $toLower: { $arrayElemAt: [{ $split: ['$$d.name', ' '] }, 0] } }, { $toLower: name }],
                    },
                    // Date of birth must match exactly
                    { $eq: ['$$d.dob', normalizedDob] },
                  ],
                },
              ],
            },
          },
        },
      },
    },
    // Stage 3: Only return documents that have at least one matching detail
    // This ensures we only return results where a user was actually found
    { $match: { 'details.0': { $exists: true } } },
  ];

  const result = await universityUsersModel.aggregate(pipeline);
  // Return the first matching document, or null if no matches found
  return result.length ? result[0] : null;
};

/**
 * Finds university users by user details with fallback domain validation
 *
 * This function attempts to find a user in the university database. If the user is not found
 * in the database, it falls back to checking if the email domain is valid for the university.
 *
 * @param {string} email - User's email address
 * @param {string} universityId - MongoDB ObjectId of the university
 * @param {string} name - User's full name
 * @param {string} dob - Date of birth
 * @returns {Promise<Object>} - Returns an object with:
 *   - universityUsers: The matched user document (if found)
 *   - message: Status message describing the result
 *   - isDomainValid: Boolean indicating if the email domain is valid for the university
 */
export const findUniversityUsersByUserDetails = async (email: string, universityId: string, name: string, dob: string) => {
  // Validate that university ID is provided
  if (universityId.toString().trim() === '') {
    return { message: 'University ID is required', isDomainValid: false };
  }

  // Attempt to find user in university database using aggregation
  const universityUsers = await findUniversityUsersAgg(email, universityId, name, dob);

  // If user is found in the database, return success
  if (universityUsers) {
    return { universityUsers, message: 'User found', isDomainValid: true };
  }

  // If user not found in database, check if email domain is valid for the university
  // This allows users with valid university email domains to proceed even if not in the database
  const isDomainValid = await universityVerificationEmailService.universityEmailDomainCheck(email, universityId);
  if (isDomainValid) {
    return { message: 'User is university user', isDomainValid };
  }

  // User not found and domain is not valid
  return { message: 'User not found', isDomainValid: false };
};
