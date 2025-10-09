import { supabase } from './supabase';

export interface Profile {
  id: string;
  username?: string;
  avatar_url?: string;
}

/**
 * Get the current user's profile
 */
export async function getCurrentProfile(): Promise<Profile | null> {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    
    if (!user) {
      return null;
    }

    // First try to get existing profile
    const { data: profile, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', user.id)
      .single();

    if (error && error.code === 'PGRST116') {
      // Profile doesn't exist, create it
      console.log('Profile not found, creating new profile for user:', user.id);
      
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
        return null;
      }

      console.log('Profile created successfully:', newProfile);
      return newProfile;
    }

    if (error) {
      console.error('Error fetching profile:', error);
      return null;
    }

    return profile;
  } catch (error) {
    console.error('Error in getCurrentProfile:', error);
    return null;
  }
}

/**
 * Update the current user's profile
 */
export async function updateProfile(updates: Partial<Pick<Profile, 'username' | 'avatar_url'>>) {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    
    if (!user) {
      throw new Error('No authenticated user');
    }

    const { data, error } = await supabase
      .from('profiles')
      .update(updates)
      .eq('id', user.id)
      .select()
      .single();

    if (error) {
      throw error;
    }

    return data;
  } catch (error) {
    console.error('Error updating profile:', error);
    throw error;
  }
}

/**
 * Get a profile by user ID (for admin/public viewing)
 */
export async function getProfileById(userId: string): Promise<Profile | null> {
  try {
    const { data: profile, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .single();

    if (error) {
      console.error('Error fetching profile by ID:', error);
      return null;
    }

    return profile;
  } catch (error) {
    console.error('Error in getProfileById:', error);
    return null;
  }
}