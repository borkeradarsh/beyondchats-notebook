import { NextRequest, NextResponse } from 'next/server';
import { GoogleGenerativeAI } from '@google/generative-ai';

const genAI = new GoogleGenerativeAI(process.env.GOOGLE_API_KEY!);

interface QuizQuestion {
  id: string;
  type: 'mcq' | 'saq' | 'laq';
  question: string;
  options?: string[];
  correct_answer: string;
  explanation: string;
  difficulty: 'easy' | 'medium' | 'hard';
}

export async function POST(request: NextRequest) {
  try {
    const authHeader = request.headers.get('authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const token = authHeader.split(' ')[1];
    
    // Create Supabase client with auth header
    const { createClient } = await import('@supabase/supabase-js');
    const supabaseClient = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        global: {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        },
      }
    );

    const { data: { user }, error: authError } = await supabaseClient.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { notebookId, documentIds, questionCount = 5, types = ['mcq'] } = await request.json();

    if (!notebookId || !documentIds || documentIds.length === 0) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    // Get document content
    const { data: documents, error: docsError } = await supabaseClient
      .from('documents')
      .select('content_text, filename')
      .in('id', documentIds)
      .eq('user_id', user.id)
      .eq('notebook_id', notebookId);

    if (docsError || !documents || documents.length === 0) {
      return NextResponse.json({ error: 'No documents found' }, { status: 404 });
    }

    // Combine document content
    const combinedContent = documents.map(doc => 
      `Document: ${doc.filename}\n${doc.content_text}`
    ).join('\n\n');

    // Generate quiz questions using Gemini
    const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash-exp" });

    const quizPrompt = `
Based on the following document content, generate ${questionCount} educational quiz questions.

Document Content:
${combinedContent}

Requirements:
1. Generate a mix of question types: ${types.join(', ')}
2. Include questions of varying difficulty levels (easy, medium, hard)
3. For MCQ questions, provide 4 options with only one correct answer
4. For SAQ (Short Answer Questions), expect 1-2 sentence answers
5. For LAQ (Long Answer Questions), expect paragraph-length answers
6. Include detailed explanations for all correct answers
7. Focus on key concepts, main ideas, and important details from the documents

Return ONLY a valid JSON array of questions in this exact format:
[
  {
    "id": "unique_id_1",
    "type": "mcq",
    "question": "Question text here?",
    "options": ["Option A", "Option B", "Option C", "Option D"],
    "correct_answer": "Exact correct option text",
    "explanation": "Detailed explanation of why this is correct and what concept it tests",
    "difficulty": "easy|medium|hard"
  },
  {
    "id": "unique_id_2", 
    "type": "saq",
    "question": "Question text here?",
    "correct_answer": "Expected short answer",
    "explanation": "Explanation of the answer and concept",
    "difficulty": "easy|medium|hard"
  }
]

Important: 
- Make questions directly relevant to the document content
- Ensure variety in topics covered
- Use clear, educational language
- Test understanding, not just memorization
- Return ONLY the JSON array, no other text
`;

    const result = await model.generateContent(quizPrompt);
    const response = result.response;
    const text = response.text();

    try {
      // Parse the JSON response
      const questions: QuizQuestion[] = JSON.parse(text);
      
      // Validate and clean up the questions
      const validQuestions = questions.filter(q => 
        q.question && q.correct_answer && q.explanation && q.type && q.difficulty
      ).map((q, index) => ({
        ...q,
        id: q.id || `question_${Date.now()}_${index}`
      }));

      if (validQuestions.length === 0) {
        throw new Error('No valid questions generated');
      }

      return NextResponse.json({ 
        questions: validQuestions,
        message: `Generated ${validQuestions.length} quiz questions successfully`
      });

    } catch (parseError) {
      console.error('Failed to parse quiz questions:', parseError);
      console.error('Raw AI response:', text);
      console.error('Attempting to clean and re-parse...');
      
      // Try to extract JSON from the response if it's wrapped in code blocks
      let cleanText = text.trim();
      
      // Remove markdown code block markers
      if (cleanText.startsWith('```json')) {
        cleanText = cleanText.replace(/^```json\s*/, '').replace(/\s*```$/, '');
      } else if (cleanText.startsWith('```')) {
        cleanText = cleanText.replace(/^```\s*/, '').replace(/\s*```$/, '');
      }
      
      // Try to extract JSON array from cleaned text
      const jsonMatch = cleanText.match(/\[[\s\S]*\]/);
      if (jsonMatch) {
        try {
          const questions: QuizQuestion[] = JSON.parse(jsonMatch[0]);
          const validQuestions = questions.filter(q => 
            q.question && q.correct_answer && q.explanation && q.type && q.difficulty
          ).map((q, index) => ({
            ...q,
            id: q.id || `question_${Date.now()}_${index}`
          }));
          
          if (validQuestions.length > 0) {
            return NextResponse.json({ 
              questions: validQuestions,
              message: `Generated ${validQuestions.length} quiz questions successfully (after cleanup)`
            });
          }
        } catch (cleanupError) {
          console.error('Cleanup parsing also failed:', cleanupError);
        }
      }
      
      // Fallback: create sample questions if parsing fails
      const fallbackQuestions: QuizQuestion[] = [
        {
          id: `fallback_${Date.now()}_1`,
          type: 'mcq',
          question: 'Based on the documents, what is the main topic discussed?',
          options: [
            'Primary concept from the document',
            'Secondary concept',
            'Unrelated topic A',
            'Unrelated topic B'
          ],
          correct_answer: 'Primary concept from the document',
          explanation: 'This is the main focus of the provided documents based on the content analysis.',
          difficulty: 'medium'
        },
        {
          id: `fallback_${Date.now()}_2`,
          type: 'saq',
          question: 'Summarize the key takeaway from the documents in 1-2 sentences.',
          correct_answer: 'The documents focus on important concepts that require understanding and application.',
          explanation: 'A good summary should capture the essential information and main themes presented.',
          difficulty: 'easy'
        }
      ];

      return NextResponse.json({ 
        questions: fallbackQuestions,
        message: 'Generated fallback quiz questions due to parsing issues'
      });
    }

  } catch (error) {
    console.error('Quiz generation error:', error);
    return NextResponse.json(
      { error: 'Failed to generate quiz questions' },
      { status: 500 }
    );
  }
}