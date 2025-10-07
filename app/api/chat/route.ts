import { NextRequest, NextResponse } from 'next/server';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { createClient } from '@supabase/supabase-js';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const genAI = new GoogleGenerativeAI(process.env.GOOGLE_API_KEY!);

export async function POST(request: NextRequest) {
  try {
    const { message, notebookId, selectedDocuments } = await request.json();
    
    // Get the authorization token from the request header
    const authHeader = request.headers.get('authorization');
    const token = authHeader?.replace('Bearer ', '');
    
    if (!token) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }
    
    // Create authenticated supabase client
    const supabase = createClient(
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

    if (!message) {
      return NextResponse.json(
        { error: 'Message is required' },
        { status: 400 }
      );
    }

    if (!notebookId) {
      return NextResponse.json(
        { error: 'Notebook ID is required' },
        { status: 400 }
      );
    }

    // Check if API key is available
    if (!process.env.GOOGLE_API_KEY) {
      console.error('GOOGLE_API_KEY not found in environment variables');
      return NextResponse.json(
        { error: 'API key not configured' },
        { status: 500 }
      );
    }

    // Get documents from the notebook for RAG
    let documentContext = '';
    
    console.log('Debug - selectedDocuments:', selectedDocuments);
    console.log('Debug - selectedDocuments type:', typeof selectedDocuments);
    console.log('Debug - selectedDocuments length:', selectedDocuments?.length);
    console.log('Debug - notebookId:', notebookId);
    
    let dbQueryResult = null;
    

    
    if (selectedDocuments && selectedDocuments.length > 0) {
      // Fetch selected documents
      console.log('Debug - querying selected documents with IDs:', selectedDocuments);
      const { data: documents, error } = await supabase
        .from('documents')
        .select('filename, content_text')
        .in('id', selectedDocuments);

      dbQueryResult = { documents, error, queryType: 'selected' };
      console.log('Debug - selected documents query result:', dbQueryResult);
      
      if (documents) {
        console.log('Debug - documents found:', documents.length);
        documents.forEach((doc, index) => {
          console.log(`Debug - document ${index}:`, {
            filename: doc.filename,
            contentLength: doc.content_text?.length || 0,
            contentPreview: doc.content_text?.substring(0, 100) + '...'
          });
        });
      }

      if (!error && documents && documents.length > 0) {
        documentContext = documents.map(doc => 
          `Document: ${doc.filename}\nContent: ${doc.content_text}\n---\n`
        ).join('\n');
      }
    } else {
      // If no specific documents selected, use all documents from the notebook
      const { data: documents, error } = await supabase
        .from('documents')
        .select('filename, content_text')
        .eq('notebook_id', notebookId)
        .limit(3); // Limit to first 3 documents to avoid token limits

      console.log('Debug - all documents query result:', { documents, error });

      if (!error && documents && documents.length > 0) {
        documentContext = documents.map(doc => 
          `Document: ${doc.filename}\nContent: ${doc.content_text}\n---\n`
        ).join('\n');
      }
    }
    
    console.log('Debug - documentContext length:', documentContext.length);
    console.log('Debug - documentContext preview:', documentContext.substring(0, 200) + '...');



    const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash' });

    let prompt;
    
    if (documentContext.trim().length > 0) {
      prompt = `You are an intelligent educational assistant designed to help students learn from their documents. Use the following document content to provide clear, educational explanations.

Document Context:
${documentContext}

User Question: ${message}

Educational Instructions:
- Answer based primarily on the provided document content
- Explain concepts in a clear, student-friendly manner
- Break down complex topics into understandable parts
- Provide examples and analogies when helpful
- Highlight key terms and their definitions
- If explaining processes, break them into step-by-step format
- Connect new information to broader concepts when relevant
- Use bullet points or numbered lists for clarity when appropriate
- If the question cannot be answered from the documents, state that clearly
- Encourage further learning by suggesting related questions or topics to explore
- Make learning engaging and accessible

Answer:`;
    } else {
      prompt = `You are an intelligent assistant. The user is asking about documents in their notebook, but I cannot access the document content at the moment. 

User Question: ${message}

Please respond that you're unable to access the document content and suggest they try uploading the documents again or contact support if the issue persists. Be helpful and apologetic.

Answer:`;
    }

    const result = await model.generateContent(prompt);
    const response = await result.response;
    const text = response.text();

    return NextResponse.json({
      response: text,
      sources: selectedDocuments || [],
      citations: [] // TODO: Implement citation extraction from response
    });

  } catch (error) {
    console.error('Chat API error:', error);
    return NextResponse.json(
      { error: 'Failed to generate response' },
      { status: 500 }
    );
  }
}