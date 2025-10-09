import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

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
        
        return user.id;
    } catch (error) {
        console.error('Error getting user ID:', error);
        return null;
    }
};

export async function GET(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const documentId = (await params).id;
        
        const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
        const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY;

        if (!supabaseUrl || !supabaseServiceKey) {
            throw new Error("Missing required environment variables.");
        }

        const supabase = createClient(supabaseUrl, supabaseServiceKey);

        // Verify user authentication
        const userId = await getUserIdFromRequest(request);
        if (!userId) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        // Get document info and verify ownership
        const { data: document, error: docError } = await supabase
            .from('documents')
            .select('id, filename, storage_path, user_id, content_text, file_size')
            .eq('id', documentId)
            .eq('user_id', userId)
            .single();

        if (docError || !document) {
            return NextResponse.json({ error: 'Document not found or access denied' }, { status: 404 });
        }

        // Check if document has storage path (new format) or content_text (legacy format)
        if (!document.storage_path && !document.content_text) {
            return NextResponse.json({ error: 'PDF file not available' }, { status: 404 });
        }

        // For legacy documents with base64 content_text, convert back to PDF
        if (!document.storage_path && document.content_text) {
            try {
                // Decode base64 content back to PDF bytes
                const pdfBuffer = Buffer.from(document.content_text, 'base64');
                
                return new NextResponse(pdfBuffer, {
                    status: 200,
                    headers: {
                        'Content-Type': 'application/pdf',
                        'Content-Length': pdfBuffer.length.toString(),
                        'Content-Disposition': `inline; filename="${document.filename}"`,
                        'Cache-Control': 'private, max-age=3600',
                        'X-Document-ID': documentId,
                        'X-Document-Source': 'legacy-base64',
                    },
                });
            } catch (error) {
                console.error('Error processing legacy document:', error);
                return NextResponse.json({ error: 'Invalid legacy PDF data' }, { status: 500 });
            }
        }

        if (!document.storage_path) {
            return NextResponse.json({ error: 'PDF file not available in storage' }, { status: 404 });
        }

        // Download file from Supabase Storage
        const { data: fileData, error: downloadError } = await supabase.storage
            .from('documents')
            .download(document.storage_path);

        if (downloadError || !fileData) {
            console.error('Error downloading file from storage:', downloadError);
            return NextResponse.json({ error: 'Failed to retrieve PDF file' }, { status: 500 });
        }

        // Convert Blob to ArrayBuffer
        const arrayBuffer = await fileData.arrayBuffer();

        // Return the PDF file with proper headers
        return new NextResponse(arrayBuffer, {
            status: 200,
            headers: {
                'Content-Type': 'application/pdf',
                'Content-Length': document.file_size?.toString() || arrayBuffer.byteLength.toString(),
                'Content-Disposition': `inline; filename="${document.filename}"`,
                'Cache-Control': 'private, max-age=3600',
                'X-Document-ID': documentId,
            },
        });

    } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'An unexpected error occurred.';
        console.error('Error serving PDF:', errorMessage);
        
        return NextResponse.json({ 
            error: `Internal Server Error: ${errorMessage}`,
            success: false
        }, { 
            status: 500,
            headers: {
                'Content-Type': 'application/json'
            }
        });
    }
}