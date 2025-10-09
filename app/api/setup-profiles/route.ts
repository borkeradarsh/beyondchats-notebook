import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

// Create admin client
const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY!
);

export async function POST() {
  try {
    console.log('Setting up profiles for existing users...');

    // Get all existing users
    const { data: existingUsers } = await supabaseAdmin.auth.admin.listUsers();
    
    if (!existingUsers.users) {
      return NextResponse.json({
        success: false,
        error: 'No users found'
      }, { status: 404 });
    }

    let successCount = 0;
    let errorCount = 0;

    // Create profiles for existing users
    for (const user of existingUsers.users) {
      try {
        const { error: insertError } = await supabaseAdmin
          .from('profiles')
          .upsert({
            id: user.id,
            username: user.user_metadata?.name || user.user_metadata?.full_name || user.email?.split('@')[0] || null,
            avatar_url: user.user_metadata?.avatar_url || user.user_metadata?.picture || null
          }, {
            onConflict: 'id'
          });

        if (insertError) {
          console.error(`Error creating profile for user ${user.id}:`, insertError);
          errorCount++;
        } else {
          console.log(`Created/updated profile for user: ${user.email}`);
          successCount++;
        }
      } catch (userError) {
        console.error(`Error processing user ${user.id}:`, userError);
        errorCount++;
      }
    }

    return NextResponse.json({
      success: true,
      message: 'Profiles setup completed',
      usersProcessed: existingUsers.users.length,
      successCount,
      errorCount,
      note: 'Make sure to run the SQL script in Supabase SQL Editor to create the profiles table and triggers first'
    });

  } catch (error) {
    console.error('Setup error:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}