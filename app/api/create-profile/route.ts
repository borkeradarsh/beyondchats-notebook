import { NextResponse } from 'next/server';
import { supabase } from '@/app/lib/supabase';

export async function POST() {
  try {
    // Get the current user
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    
    if (authError || !user) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    // Check if profile already exists
    const { data: existingProfile } = await supabase
      .from('profiles')
      .select('id')
      .eq('id', user.id)
      .single();

    if (existingProfile) {
      return NextResponse.json({ 
        message: 'Profile already exists',
        profile: existingProfile 
      });
    }

    // Create new profile
    const username = user.user_metadata?.name || 
                    user.user_metadata?.full_name || 
                    user.email?.split('@')[0] || 
                    'User';

    const { data: newProfile, error: createError } = await supabase
      .from('profiles')
      .insert({
        id: user.id,
        username: username,
        avatar_url: user.user_metadata?.avatar_url || user.user_metadata?.picture || null
      })
      .select()
      .single();

    if (createError) {
      console.error('Error creating profile:', createError);
      return NextResponse.json({ 
        error: 'Failed to create profile',
        details: createError.message 
      }, { status: 500 });
    }

    return NextResponse.json({ 
      message: 'Profile created successfully',
      profile: newProfile 
    });

  } catch (error) {
    console.error('Error in create-profile API:', error);
    return NextResponse.json({ 
      error: 'Internal server error' 
    }, { status: 500 });
  }
}