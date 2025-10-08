import { NextRequest, NextResponse } from 'next/server';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { createClient } from '@supabase/supabase-js';

// --- Type Definitions ---

export async function POST(request: NextRequest) {
  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY;
    const googleApiKey = process.env.GOOGLE_API_KEY;

    if (!supabaseUrl || !supabaseServiceKey || !googleApiKey) {
      throw new Error("Missing required environment variables.");
    }
    
    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    const genAI = new GoogleGenerativeAI(googleApiKey);

    const { notebookId, documentIds, questionCount = 5, types = ['mcq'] } = await request.json();

    if (!notebookId || !documentIds || documentIds.length === 0) {
      return NextResponse.json({ error: 'NotebookId and documentIds are required.' }, { status: 400 });
    }

    // Use the first document for now (can be enhanced to combine multiple documents)
    const documentId = documentIds[0];

    // 1. Get document metadata
    const { data: documentData, error: docError } = await supabase
      .from('documents')
      .select('filename, notebook_id, user_id')
      .eq('id', documentId)
      .single();

    if (docError || !documentData) {
      return NextResponse.json({ error: 'Document not found.' }, { status: 404 });
    }

    // 2. Get document content from chunks table
    const { data: chunks, error: chunksError } = await supabase
      .from('document_chunks')
      .select('content')
      .eq('document_id', documentId)
      .order('chunk_index', { ascending: true });

    if (chunksError || !chunks || chunks.length === 0) {
      return NextResponse.json({ error: 'Document content not found.' }, { status: 404 });
    }

    // Combine all chunks to form the complete document content
    const context = chunks.map(chunk => chunk.content).join('\n\n');
    
    // Generate quiz based on requested type
    const quizType = types[0]; // Use first type specified
    let typePrompt = '';
    
    if (quizType === 'mcq') {
      typePrompt = `Generate ${questionCount} Multiple Choice Questions. Each question should have 4 options and one correct answer.`;
    } else if (quizType === 'saq') {
      typePrompt = `Generate ${questionCount} Short Answer Questions. These should require brief, factual responses.`;
    } else if (quizType === 'laq') {
      typePrompt = `Generate ${questionCount} Long Answer Questions. These should require detailed explanations.`;
    }

    const prompt = `
      You are an expert quiz creator for students. Based ONLY on the document content below, create educational questions.

      ${typePrompt}

      Return a JSON object with a "questions" array. Each question should have:
      - "type": "${quizType}"
      - "question": The question text
      ${quizType === 'mcq' ? '- "options": Array of exactly 4 strings' : ''}
      - "correct_answer": The correct answer${quizType === 'mcq' ? ' (must exactly match one of the options)' : ''}
      - "explanation": Brief explanation of the correct answer
      - "difficulty": "easy", "medium", or "hard"

      Document: ${documentData.filename}
      ---
      ${context}
      ---

      Generate the quiz now as valid JSON.
    `;

    // Generate quiz using Gemini
    const generativeModel = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });
    const result = await generativeModel.generateContent(prompt);
    const response = await result.response;
    const text = response.text();
    
    // Clean up the response to ensure it's valid JSON
    const jsonResponse = text.replace(/```json/g, '').replace(/```/g, '').trim();
    
    let parsedResponse;
    try {
      parsedResponse = JSON.parse(jsonResponse);
    } catch (error) {
      console.error('Failed to parse AI response:', text, error);
      return NextResponse.json({ error: 'Failed to generate valid quiz format' }, { status: 500 });
    }

    // Validate and format the response
    if (!parsedResponse.questions || !Array.isArray(parsedResponse.questions)) {
      return NextResponse.json({ error: 'Invalid quiz format generated' }, { status: 500 });
    }

    // Add unique IDs and ensure proper formatting
    const formattedQuestions = parsedResponse.questions.map((q: unknown, index: number) => {
      const question = q as Record<string, unknown>;
      return {
        id: `quiz_${Date.now()}_${index}`,
        type: quizType,
        question: (question.question as string) || '',
        ...(quizType === 'mcq' && { options: (question.options as string[]) || [] }),
        correct_answer: (question.correct_answer as string) || '',
        explanation: (question.explanation as string) || '',
        difficulty: (question.difficulty as string) || 'medium'
      };
    });

    return NextResponse.json({ 
      success: true,
      questions: formattedQuestions
    });

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'An unexpected error occurred.';
    console.error('--- QUIZ API CRASH ---', errorMessage);
    return NextResponse.json({ error: `Internal Server Error: ${errorMessage}` }, { status: 500 });
  }
}

