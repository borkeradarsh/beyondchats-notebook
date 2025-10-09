import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { seedNewUser } from '@/app/lib/autoSeeding';

// Create admin client
const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY!
);

export async function POST(request: NextRequest) {
  try {
    // Get the user from the request
    const authHeader = request.headers.get('authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const token = authHeader.substring(7);
    const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(token);
    
    if (authError || !user) {
      return NextResponse.json({ error: 'Invalid token' }, { status: 401 });
    }

    console.log(`Auto-seeding requested for user: ${user.id}`);

    // Call the seeding function
    const result = await seedNewUser(user.id);

    if (result.success) {
      return NextResponse.json({
        success: true,
        message: 'Auto-seeding completed successfully',
        notebookId: result.notebookId,
        documentsCreated: result.documentsCreated
      });
    } else {
      return NextResponse.json({
        success: false,
        error: result.error || 'Seeding failed'
      }, { status: 500 });
    }

  } catch (error) {
    console.error('Auto-seeding API error:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}