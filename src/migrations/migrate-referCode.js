// #!/usr/bin/env node

// /**
//  * Migration script to add referCode to existing users
//  * This script will find all users without a referCode
//  * and generate a unique referCode for each user
//  * Format: CAPITAL_FIRSTNAME + random 4 digit number
//  */

// import mongoose from 'mongoose';
// import path from 'path';
// import { fileURLToPath } from 'url';
// import dotenv from 'dotenv';

// // ES module fix for __dirname
// const __filename = fileURLToPath(import.meta.url);
// const __dirname = path.dirname(__filename);

// // Load environment variables
// dotenv.config({ path: path.join(__dirname, '.env') });

// // Connect to MongoDB
// const connectDB = async () => {
//   try {
//     await mongoose.connect(process.env.MONGODB_URL);
//     console.log('✅ Connected to MongoDB');
//   } catch (error) {
//     console.error('❌ MongoDB connection error:', error);
//     process.exit(1);
//   }
// };

// /**
//  * Generate a unique refer code for a user
//  * Format: CAPITAL_FIRSTNAME + random 4 digit number
//  * @param {string} firstName
//  * @param {mongoose.Db} db
//  * @returns {Promise<string>}
//  */
// const generateReferCode = async (firstName, db) => {
//   const capitalFirstName = firstName.toUpperCase();
//   let referCode;
//   let isUnique = false;
//   const maxAttempts = 100; // Prevent infinite loop
//   let attempts = 0;

//   while (!isUnique && attempts < maxAttempts) {
//     const randomDigits = Math.floor(1000 + Math.random() * 9000); // Generate 4-digit number (1000-9999)
//     referCode = `${capitalFirstName}${randomDigits}`;

//     const existingUser = await db.collection('users').findOne({ referCode });
//     if (!existingUser) {
//       isUnique = true;
//     }
//     attempts++;
//   }

//   if (!isUnique) {
//     // Fallback: add timestamp to ensure uniqueness
//     const timestamp = Date.now().toString().slice(-4);
//     referCode = `${capitalFirstName}${timestamp}`;
//   }

//   return referCode;
// };

// // Migration function
// const migrateReferCodes = async () => {
//   try {
//     console.log('🔄 Starting referCode migration...');

//     const db = mongoose.connection.db;
//     const collection = db.collection('users');

//     // Find all users without a referCode or with null/empty referCode
//     const users = await collection
//       .find({
//         $or: [{ referCode: { $exists: false } }, { referCode: null }, { referCode: '' }],
//       })
//       .toArray();

//     console.log(`📊 Found ${users.length} users without referCode`);

//     if (users.length === 0) {
//       console.log('✅ All users already have referCodes!');
//       return;
//     }

//     let updatedCount = 0;
//     let errorCount = 0;
//     const errors = [];

//     // Process users in batches to avoid overwhelming the database
//     const batchSize = 100;
//     for (let i = 0; i < users.length; i += batchSize) {
//       const batch = users.slice(i, i + batchSize);
//       console.log(`\n📦 Processing batch ${Math.floor(i / batchSize) + 1} (${batch.length} users)...`);

//       for (const user of batch) {
//         try {
//           // Skip if firstName is missing or empty
//           if (!user.firstName || user.firstName.trim() === '') {
//             console.log(`⏭️  Skipping user ${user._id} - firstName is missing or empty`);
//             continue;
//           }

//           // Generate unique refer code
//           const referCode = await generateReferCode(user.firstName, db);

//           // Update the user
//           await collection.updateOne({ _id: user._id }, { $set: { referCode } });

//           console.log(`   ✅ Updated user ${user.firstName} ${user.lastName} (${user.email}) - ReferCode: ${referCode}`);
//           updatedCount++;
//         } catch (error) {
//           errorCount++;
//           const errorMsg = `Error updating user ${user._id}: ${error.message}`;
//           errors.push(errorMsg);
//           console.error(`   ❌ ${errorMsg}`);
//         }
//       }
//     }

//     console.log('\n📈 Migration Summary:');
//     console.log(`   Total users processed: ${users.length}`);
//     console.log(`   Users updated: ${updatedCount}`);
//     console.log(`   Users skipped: ${users.length - updatedCount - errorCount}`);
//     console.log(`   Errors: ${errorCount}`);

//     if (errors.length > 0) {
//       console.log('\n⚠️  Errors encountered:');
//       errors.forEach((error) => console.log(`   - ${error}`));
//     }

//     if (updatedCount > 0) {
//       console.log('\n✅ Migration completed successfully!');
//     } else {
//       console.log('\n✅ No users needed updating.');
//     }
//   } catch (error) {
//     console.error('❌ Migration error:', error);
//     throw error;
//   }
// };

// // Main execution
// const main = async () => {
//   try {
//     await connectDB();
//     await migrateReferCodes();
//   } catch (error) {
//     console.error('❌ Script failed:', error);
//     process.exit(1);
//   } finally {
//     await mongoose.disconnect();
//     console.log('🔌 Disconnected from MongoDB');
//     process.exit(0);
//   }
// };

// // Run the migration
// console.log('🚀 Starting referCode migration script...');
// main();

// export { migrateReferCodes };
