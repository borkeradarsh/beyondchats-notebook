import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import jwt from 'jsonwebtoken';

// Helper function to get user ID from JWT token (matching quiz routes)
async function getUserIdFromRequest(request: NextRequest): Promise<string | null> {
  try {
    const authHeader = request.headers.get('authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return null;
    }

    const token = authHeader.substring(7);
    const decoded = jwt.decode(token) as { sub?: string } | null;
    return decoded?.sub || null;
  } catch (error) {
    console.error('Error extracting user ID:', error);
    return null;
  }
}

// POST: Save quiz attempt progress
export async function POST(request: NextRequest) {
  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY;

    if (!supabaseUrl || !supabaseServiceKey) {
      throw new Error("Missing Supabase environment variables.");
    }
    
    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    
    // Get authenticated user ID
    const userId = await getUserIdFromRequest(request);
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { 
      notebookId, 
      documentId, 
      quizTopic, 
      questions, 
      userAnswers, 
      score,
      quizType,
      totalQuestions,
      correctAnswers
    } = body;

    // Validate required fields
    if (!notebookId || !quizTopic || !questions || !userAnswers || score === undefined) {
      return NextResponse.json({ 
        error: 'Missing required fields: notebookId, quizTopic, questions, userAnswers, score' 
      }, { status: 400 });
    }

    // Verify user owns the notebook
    const { data: notebook, error: notebookError } = await supabase
      .from('notebooks')
      .select('id')
      .eq('id', notebookId)
      .eq('user_id', userId)
      .single();

    if (notebookError || !notebook) {
      return NextResponse.json({ 
        error: 'Notebook not found or access denied' 
      }, { status: 403 });
    }

    // If documentId is provided, verify user owns the document
    if (documentId) {
      const { data: document, error: docError } = await supabase
        .from('documents')
        .select('id')
        .eq('id', documentId)
        .eq('user_id', userId)
        .eq('notebook_id', notebookId)
        .single();

      if (docError || !document) {
        return NextResponse.json({ 
          error: 'Document not found or access denied' 
        }, { status: 403 });
      }
    }

    // Insert quiz attempt record
    const { data: attemptData, error: insertError } = await supabase
      .from('quiz_attempts')
      .insert({
        user_id: userId,
        notebook_id: notebookId,
        document_id: documentId || null,
        quiz_topic: quizTopic,
        quiz_type: quizType || 'mcq',
        questions: JSON.stringify(questions),
        user_answers: JSON.stringify(userAnswers),
        score: score,
        total_questions: totalQuestions || questions.length,
        correct_answers: correctAnswers || Math.round((score / 100) * questions.length),
        created_at: new Date().toISOString()
      })
      .select('id')
      .single();

    if (insertError) {
      console.error('Quiz attempt insert error:', insertError);
      return NextResponse.json({ 
        error: `Failed to save quiz attempt: ${insertError.message}` 
      }, { status: 500 });
    }

    return NextResponse.json({ 
      success: true,
      message: 'Quiz attempt saved successfully.',
      attemptId: attemptData.id
    });

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'An unexpected error occurred.';
    console.error('--- PROGRESS API (POST) CRASH ---', errorMessage);
    return NextResponse.json({ 
      error: `Internal Server Error: ${errorMessage}` 
    }, { status: 500 });
  }
}

// GET: Retrieve user's quiz progress and statistics
export async function GET(request: NextRequest) {
  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY;

    if (!supabaseUrl || !supabaseServiceKey) {
      throw new Error("Missing Supabase environment variables.");
    }
    
    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    
    // Get authenticated user ID
    const userId = await getUserIdFromRequest(request);
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Parse query parameters
    const url = new URL(request.url);
    const notebookId = url.searchParams.get('notebookId');
    const limit = parseInt(url.searchParams.get('limit') || '10');

    // Base query for quiz attempts
    let query = supabase
      .from('quiz_attempts')
      .select(`
        id, 
        created_at, 
        quiz_topic, 
        quiz_type, 
        score, 
        total_questions, 
        correct_answers,
        notebook_id,
        document_id,
        notebooks:notebook_id(title),
        documents:document_id(filename)
      `)
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(limit);

    // Filter by notebook if specified
    if (notebookId) {
      query = query.eq('notebook_id', notebookId);
    }

    const { data: attempts, error: attemptsError } = await query;

    if (attemptsError) {
      console.error('Quiz attempts fetch error:', attemptsError);
      return NextResponse.json({ 
        error: `Failed to fetch quiz attempts: ${attemptsError.message}` 
      }, { status: 500 });
    }

    // Calculate progress statistics
    const stats = {
      totalAttempts: attempts?.length || 0,
      averageScore: attempts?.length > 0 
        ? Math.round(attempts.reduce((sum, attempt) => sum + attempt.score, 0) / attempts.length)
        : 0,
      totalCorrectAnswers: attempts?.reduce((sum, attempt) => sum + attempt.correct_answers, 0) || 0,
      totalQuestions: attempts?.reduce((sum, attempt) => sum + attempt.total_questions, 0) || 0,
      quizTypeBreakdown: attempts?.reduce((acc, attempt) => {
        acc[attempt.quiz_type] = (acc[attempt.quiz_type] || 0) + 1;
        return acc;
      }, {} as Record<string, number>) || {},
      recentActivity: attempts?.slice(0, 5) || []
    };

    return NextResponse.json({
      success: true,
      attempts: attempts || [],
      statistics: stats
    });

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'An unexpected error occurred.';
    console.error('--- PROGRESS API (GET) CRASH ---', errorMessage);
    return NextResponse.json({ 
      error: `Internal Server Error: ${errorMessage}` 
    }, { status: 500 });
  }
}