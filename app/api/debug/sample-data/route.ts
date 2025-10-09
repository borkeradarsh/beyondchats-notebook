// Debug API route to test sample data creation
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { seedSampleNotebooks } from '@/app/lib/sampleData';

export async function GET(request: NextRequest) {
  try {
    // Get user ID from query params
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId');
    
    if (!userId) {
      return NextResponse.json(
        { error: 'userId query parameter is required' },
        { status: 400 }
      );
    }

    // Create Supabase client with service role key for admin access
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    console.log(`🧪 Debug: Testing sample data creation for user ${userId}`);

    // Create sample data
    const result = await seedSampleNotebooks(supabase, userId);

    // Get chunk count for verification
    const { data: chunkCount } = await supabase
      .from('document_chunks')
      .select('id', { count: 'exact' })
      .eq('document_id', result[0]?.id);

    return NextResponse.json({
      success: true,
      message: 'Sample data created successfully',
      notebooks: result,
      chunkCount: chunkCount?.length || 0,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('❌ Debug API error:', error);
    return NextResponse.json(
      { 
        error: 'Failed to create sample data',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { userId } = body;
    
    if (!userId) {
      return NextResponse.json(
        { error: 'userId is required in request body' },
        { status: 400 }
      );
    }

    // Create Supabase client
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    // Check existing data first
    const { data: existingNotebooks } = await supabase
      .from('notebooks')
      .select('*')
      .eq('user_id', userId);

    // Get chunk statistics
    const { data: chunks } = await supabase
      .from('document_chunks')
      .select('document_id')
      .in('document_id', 
        await supabase
          .from('documents')
          .select('id')
          .eq('user_id', userId)
          .then(res => res.data?.map(d => d.id) || [])
      );

    return NextResponse.json({
      existingNotebooks: existingNotebooks?.length || 0,
      totalChunks: chunks?.length || 0,
      notebooks: existingNotebooks
    });

  } catch (error) {
    console.error('❌ Debug check error:', error);
    return NextResponse.json(
      { error: 'Failed to check data' },
      { status: 500 }
    );
  }
}