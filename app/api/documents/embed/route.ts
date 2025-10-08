import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY!
);

export async function POST(request: NextRequest) {
  try {
    const { documentId } = await request.json();
    
    if (!documentId) {
      return NextResponse.json({ error: 'Document ID is required' }, { status: 400 });
    }

    // Check if document exists and has chunks
    const { data: document, error: docError } = await supabase
      .from('documents')
      .select('id, filename, status')
      .eq('id', documentId)
      .single();

    if (docError || !document) {
      return NextResponse.json({ error: 'Document not found' }, { status: 404 });
    }

    // Check if document has chunks (meaning it's been processed)
    const { data: chunks, error: chunksError } = await supabase
      .from('document_chunks')
      .select('id')
      .eq('document_id', documentId)
      .limit(1);

    if (chunksError) {
      return NextResponse.json({ error: 'Failed to check document chunks' }, { status: 500 });
    }

    const isEmbedded = chunks && chunks.length > 0;
    const status = document.status;

    return NextResponse.json({
      documentId,
      filename: document.filename,
      status,
      isEmbedded,
      hasChunks: isEmbedded,
      message: isEmbedded ? 'Document is already embedded' : 'Document needs embedding'
    });

  } catch (error) {
    console.error('Error in documents/embed:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}