import { NextRequest, NextResponse } from 'next/server';
import { PdfReader } from 'pdfreader';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { createClient } from '@supabase/supabase-js';

// --- Server-safe PDF parsing function using 'pdfreader' ---
function parsePdfByPage(fileBuffer: Buffer): Promise<string[]> {
  return new Promise((resolve, reject) => {
    const reader = new PdfReader(null);
    const pages: string[] = [];
    let currentPageText = '';

    reader.parseBuffer(fileBuffer, (err, item) => {
      if (err) {
        reject(err);
      } else if (!item) {
        if (currentPageText) pages.push(currentPageText.trim());
        resolve(pages);
      } else if (item.page) {
        if (currentPageText) pages.push(currentPageText.trim());
        currentPageText = '';
      } else if (item.text) {
        currentPageText += item.text + ' ';
      }
    });
  });
}

// Extract user ID from Supabase authentication
const getUserIdFromRequest = async (request: NextRequest): Promise<string | null> => {
    try {
        // Get authorization header
        const authHeader = request.headers.get('authorization');
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            console.log('No valid authorization header found');
            return null;
        }

        // Extract the JWT token
        const token = authHeader.substring(7); // Remove 'Bearer ' prefix
        
        // Create Supabase client and verify the token
        const supabase = createClient(
            process.env.NEXT_PUBLIC_SUPABASE_URL!,
            process.env.SUPABASE_SERVICE_KEY!
        );
        
        const { data: { user }, error } = await supabase.auth.getUser(token);
        
        if (error || !user) {
            console.log('Invalid token or user not found:', error?.message);
            return null;
        }
        
        console.log('Authenticated user:', user.id);
        return user.id;
    } catch (error) {
        console.error('Error getting user ID:', error);
        return null;
    }
};

const chunkText = (text: string, chunkSize = 1500, overlap = 200): string[] => {
  const chunks: string[] = [];
  if (!text) return chunks;
  for (let i = 0; i < text.length; i += chunkSize - overlap) {
    chunks.push(text.slice(i, i + chunkSize));
  }
  return chunks.filter(chunk => chunk.trim().length > 50);
};

export async function POST(request: NextRequest) {
  console.log("Upload API route hit.");

  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY;
    const googleApiKey = process.env.GOOGLE_API_KEY;

    if (!supabaseUrl || !supabaseServiceKey || !googleApiKey) {
      throw new Error("Missing required environment variables.");
    }

    const genAI = new GoogleGenerativeAI(googleApiKey);
    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    console.log("Clients initialized successfully.");

    const userId = await getUserIdFromRequest(request);
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const formData = await request.formData();
    const file = formData.get('file') as File;
    // --- THE FIX: Correctly extract notebookId from FormData ---
    const notebookId = formData.get('notebookId') as string; 

    if (!file || !notebookId) {
      return NextResponse.json({ error: 'Missing file or notebookId in the request.' }, { status: 400 });
    }
    console.log(`Received file: ${file.name} for notebook: ${notebookId}`);

    const { data: document, error: docError } = await supabase
      .from('documents')
      // --- THE FIX: Use the extracted notebookId in the insert call ---
      .insert({ user_id: userId, filename: file.name, status: 'processing', notebook_id: notebookId })
      .select().single();
    if (docError) throw new Error(`Supabase insert error: ${docError.message}`);
    console.log(`Created document record with ID: ${document.id}`);

    const fileBuffer = Buffer.from(await file.arrayBuffer());
    
    // Upload the actual PDF file to Supabase Storage
    console.log("Uploading PDF file to Supabase Storage...");
    const fileExt = file.name.split('.').pop();
    const fileName = `${document.id}.${fileExt}`;
    const filePath = `${userId}/${fileName}`;

    const { data: uploadData, error: uploadError } = await supabase.storage
      .from('documents')
      .upload(filePath, fileBuffer, {
        contentType: file.type,
        upsert: false,
        cacheControl: '3600',
        metadata: {
          documentId: document.id,
          originalFilename: file.name,
          uploadedBy: userId,
          uploadedAt: new Date().toISOString()
        }
      });

    if (uploadError) {
      console.error('Error uploading file to storage:', uploadError);
      // Clean up the document record if file upload fails
      await supabase.from('documents').delete().eq('id', document.id);
      throw new Error(`File upload failed: ${uploadError.message}`);
    }

    console.log(`File uploaded successfully to: ${uploadData.path}`);
    
    // Update document record with storage path
    const { error: updateError } = await supabase
      .from('documents')
      .update({ 
        storage_path: uploadData.path,
        file_size: fileBuffer.length
      })
      .eq('id', document.id);

    if (updateError) {
      console.error('Error updating document with storage path:', updateError);
      // Don't fail the entire operation, just log the error
    }
    
    console.log("Starting PDF parsing with pdfreader...");
    const pageTexts = await parsePdfByPage(fileBuffer);
    const numPages = pageTexts.length;
    console.log(`PDF parsed successfully. Discovered ${numPages} pages.`);

    const chunksWithMetadata = pageTexts.flatMap((text, pageIndex) => {
        const chunks = chunkText(text);
        return chunks.map((content, chunkIndex) => ({
            document_id: document.id,
            page_number: pageIndex + 1,
            chunk_index: chunkIndex,
            content: content,
        }));
    });

    if (chunksWithMetadata.length === 0) {
      await supabase.from('documents').update({ status: 'error', page_count: 0 }).eq('id', document.id);
      return NextResponse.json({ error: 'Could not extract any text content from the PDF.' }, { status: 400 });
    }
    console.log(`Created ${chunksWithMetadata.length} chunks across ${numPages} pages.`);

    const embeddingModel = genAI.getGenerativeModel({ model: "text-embedding-004" });
    const contentToEmbed = chunksWithMetadata.map(chunk => chunk.content);
    
    console.log("Generating embeddings...");
    const embeddings: number[][] = [];
    for (const text of contentToEmbed) {
        const embeddingResult = await embeddingModel.embedContent(text);
        embeddings.push(embeddingResult.embedding.values);
    }
    console.log("Embeddings generated.");

    const documentsToInsert = chunksWithMetadata.map((chunk, index) => ({
      ...chunk,
      embedding: embeddings[index],
    }));

    console.log("Inserting chunks into Supabase...");
    await supabase.from('document_chunks').insert(documentsToInsert);
    console.log("Chunks inserted.");

    await supabase.from('documents').update({ status: 'ready', page_count: numPages }).eq('id', document.id);
    console.log("Document status updated to 'ready'.");

    return NextResponse.json({ 
      message: 'Document processed successfully.', 
      documentId: document.id,
      success: true,
      chunksCreated: documentsToInsert.length,
      pageCount: numPages,
      storagePath: uploadData.path,
      fileSize: fileBuffer.length
    });

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'An unexpected error occurred.';
    console.error('--- UPLOAD API CRASH ---', errorMessage);
    
    // Ensure we always return JSON, never HTML
    return NextResponse.json({ 
      error: `Internal Server Error: ${errorMessage}`,
      success: false,
      stack: process.env.NODE_ENV === 'development' ? (error as Error)?.stack : undefined
    }, { 
      status: 500,
      headers: {
        'Content-Type': 'application/json'
      }
    });
  }
}

