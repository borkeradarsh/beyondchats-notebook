// Manual seeding script for development/testing
// You can run this script to manually seed sample data for specific users

import { createClient } from '@supabase/supabase-js';
import { seedSampleNotebooks } from '../lib/sampleData';

// Configuration - replace with your actual Supabase credentials
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
  console.error('❌ Missing Supabase configuration. Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

// Manual seeding function
async function manualSeed() {
  try {
    console.log('🌱 Starting manual seeding process...');
    
    // Get all users (or specify specific user IDs)
    const { data: users, error: usersError } = await supabase.auth.admin.listUsers();
    
    if (usersError) {
      console.error('❌ Error fetching users:', usersError);
      return;
    }
    
    console.log(`👥 Found ${users.users.length} users`);
    
    for (const user of users.users) {
      console.log(`\n👤 Processing user: ${user.email} (${user.id})`);
      
      // Check if user already has notebooks
      const { data: existingNotebooks } = await supabase
        .from('notebooks')
        .select('id')
        .eq('user_id', user.id);
      
      if (existingNotebooks && existingNotebooks.length > 0) {
        console.log(`📚 User already has ${existingNotebooks.length} notebooks, skipping...`);
        continue;
      }
      
      // Seed sample notebooks for this user
      try {
        await seedSampleNotebooks(supabase, user.id);
        console.log(`✅ Successfully seeded notebooks for ${user.email}`);
      } catch (seedError) {
        console.error(`❌ Error seeding for ${user.email}:`, seedError);
      }
    }
    
    console.log('\n🎉 Manual seeding completed!');
  } catch (error) {
    console.error('❌ Error in manual seeding:', error);
  }
}

// Seed specific user by email
async function seedUserByEmail(email: string) {
  try {
    console.log(`🎯 Seeding sample data for user: ${email}`);
    
    // Get user by email using list users API
    const { data: { users }, error: userError } = await supabase.auth.admin.listUsers();
    
    if (userError) {
      console.error(`❌ Error fetching users:`, userError);
      return;
    }
    
    const user = users.find(u => u.email === email);
    
    if (!user) {
      console.error(`❌ User not found: ${email}`);
      return;
    }
    
    await seedSampleNotebooks(supabase, user.id);
    console.log(`✅ Successfully seeded notebooks for ${email}`);
  } catch (error) {
    console.error(`❌ Error seeding for ${email}:`, error);
  }
}

// Clean up all sample data (useful for testing)
async function cleanupSampleData() {
  try {
    console.log('🧹 Cleaning up all sample data...');
    
    // Delete all notebooks and documents (be careful with this!)
    const { error: docsError } = await supabase
      .from('documents')
      .delete()
      .neq('id', ''); // Delete all
    
    if (docsError) throw docsError;
    
    const { error: notebooksError } = await supabase
      .from('notebooks')
      .delete()
      .neq('id', ''); // Delete all
    
    if (notebooksError) throw notebooksError;
    
    console.log('✅ Cleanup completed');
  } catch (error) {
    console.error('❌ Error during cleanup:', error);
  }
}

// Command line interface
const command = process.argv[2];
const argument = process.argv[3];

switch (command) {
  case 'seed-all':
    manualSeed();
    break;
  case 'seed-user':
    if (!argument) {
      console.error('❌ Please provide user email: npm run seed seed-user user@example.com');
      process.exit(1);
    }
    seedUserByEmail(argument);
    break;
  case 'cleanup':
    console.log('⚠️ This will delete ALL notebooks and documents. Are you sure?');
    console.log('Uncomment the line below to confirm:');
    // cleanupSampleData();
    break;
  default:
    console.log(`
📖 Sample Data Seeding Script

Usage:
  npm run seed seed-all           # Seed all users
  npm run seed seed-user <email>  # Seed specific user
  npm run seed cleanup            # Clean up all data (careful!)

Examples:
  npm run seed seed-user test@example.com
  npm run seed seed-all
    `);
}

export { manualSeed, seedUserByEmail, cleanupSampleData };