# AdminId Migration Script

This migration script converts single `adminId` ObjectId fields to array format in the communities collection.

## Problem

Some communities in the database might have `adminId` stored as a single ObjectId instead of an array of ObjectIds, which can cause issues when the code expects an array and calls `.map()` on it.

## Solution

The migration script will:

1. Find all communities where `adminId` is not an array
2. Convert single ObjectId values to arrays containing that ObjectId
3. Update the database with the corrected format

## How to Run

### Option 1: Using npm/yarn script (Recommended)

```bash
yarn migrate:adminId
# or
npm run migrate:adminId
```

### Option 2: Direct execution

```bash
# JavaScript version
node migrate-adminId.js

# TypeScript version (if ts-node is available)
ts-node src/scripts/migrateAdminId.ts
```

## What the Script Does

1. **Connects to MongoDB** using your existing configuration
2. **Finds all communities** in the database
3. **Checks each community** for `adminId` field format:
   - ✅ **Skips** if already an array
   - ✅ **Skips** if null/undefined
   - 🔄 **Converts** if single ObjectId to array format
4. **Updates the database** with the corrected format
5. **Provides detailed logging** of the migration process

## Example Output

```
🚀 Starting adminId migration script...
✅ Connected to MongoDB
🔄 Starting adminId migration...
📊 Found 25 communities to check
🔄 Processing community: CS Club (ID: 507f1f77bcf86cd799439011)
   Current adminId: 507f1f77bcf86cd799439012 (type: string)
   ✅ Updated adminId to array: [507f1f77bcf86cd799439012]
⏭️  Skipping community: Math Society - adminId is already an array

📈 Migration Summary:
   Total communities processed: 25
   Communities updated: 3
   Communities skipped: 22

✅ Migration completed successfully!
💡 All adminId fields have been converted to array format.
🔌 Disconnected from MongoDB
```

## Safety Features

- **Non-destructive**: Only converts single ObjectIds to arrays, doesn't modify existing arrays
- **Validation**: Checks ObjectId validity before conversion
- **Detailed logging**: Shows exactly what was changed
- **Error handling**: Gracefully handles invalid data and connection issues

## Files Created

- `migrate-adminId.js` - JavaScript version (runs with `node`)
- `src/scripts/migrateAdminId.ts` - TypeScript version with proper typing
- Updated `package.json` with `migrate:adminId` script

## Important Notes

- **Run this script once** after deployment when you've added the fixes to handle array format
- **Backup your database** before running any migration in production
- The script is **idempotent** - you can run it multiple times safely
