import { NextRequest, NextResponse } from 'next/server';
import { generateQuiz } from '@/app/lib/gemini';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  try {
    const { documentContent, difficulty = 'medium', numberOfQuestions = 5 } = await request.json();

    if (!documentContent) {
      return NextResponse.json(
        { error: 'Document content is required' },
        { status: 400 }
      );
    }

    // Generate quiz using Gemini
    const quiz = await generateQuiz(documentContent, difficulty);

    return NextResponse.json({
      quiz,
      numberOfQuestions,
      difficulty,
    });

  } catch (error) {
    console.error('Quiz generation error:', error);
    return NextResponse.json(
      { error: 'Failed to generate quiz' },
      { status: 500 }
    );
  }
}