#!/usr/bin/env node

/**
 * Migration script to convert single adminId ObjectId to array format
 * This script will find all communities where adminId is a single ObjectId
 * and convert it to an array containing that ObjectId
 */

import mongoose from 'mongoose';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

// ES module fix for __dirname
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load environment variables
dotenv.config({ path: path.join(__dirname, '.env') });

// Connect to MongoDB
const connectDB = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URL);
    console.log('✅ Connected to MongoDB');
  } catch (error) {
    console.error('❌ MongoDB connection error:', error);
    process.exit(1);
  }
};

// Migration function
const migrateAdminIdToArray = async () => {
  try {
    console.log('🔄 Starting adminId migration...');

    // Get the community collection directly
    const db = mongoose.connection.db;
    const collection = db.collection('communities');

    // Find all documents where adminId is not an array (single ObjectId or null/undefined)
    const communities = await collection.find({}).toArray();

    let updatedCount = 0;
    let totalProcessed = 0;

    console.log(`📊 Found ${communities.length} communities to check`);

    for (const community of communities) {
      totalProcessed++;

      // Check if adminId exists and is not an array
      if (community.adminId !== undefined && community.adminId !== null && !Array.isArray(community.adminId)) {
        console.log(`🔄 Processing community: ${community.name} (ID: ${community._id})`);
        console.log(`   Current adminId: ${community.adminId} (type: ${typeof community.adminId})`);

        // Convert single ObjectId to array
        const newAdminIdArray = [community.adminId];

        // Update the document
        await collection.updateOne({ _id: community._id }, { $set: { adminId: newAdminIdArray } });

        console.log(`   ✅ Updated adminId to array: [${newAdminIdArray.join(', ')}]`);
        updatedCount++;
      } else if (Array.isArray(community.adminId)) {
        console.log(`⏭️  Skipping community: ${community.name} - adminId is already an array`);
      } else {
        console.log(`⏭️  Skipping community: ${community.name} - adminId is null/undefined`);
      }
    }

    console.log('\n📈 Migration Summary:');
    console.log(`   Total communities processed: ${totalProcessed}`);
    console.log(`   Communities updated: ${updatedCount}`);
    console.log(`   Communities skipped: ${totalProcessed - updatedCount}`);

    if (updatedCount > 0) {
      console.log('\n✅ Migration completed successfully!');
    } else {
      console.log('\n✅ No communities needed updating - all adminId fields are already in correct format.');
    }
  } catch (error) {
    console.error('❌ Migration error:', error);
    throw error;
  }
};

// Main execution
const main = async () => {
  try {
    await connectDB();
    await migrateAdminIdToArray();
  } catch (error) {
    console.error('❌ Script failed:', error);
    process.exit(1);
  } finally {
    await mongoose.disconnect();
    console.log('🔌 Disconnected from MongoDB');
    process.exit(0);
  }
};

// Run the migration
console.log('🚀 Starting adminId migration script...');
main();

export { migrateAdminIdToArray };
