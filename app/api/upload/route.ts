import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get('file') as File;

    if (!file) {
      return NextResponse.json(
        { error: 'No file provided' },
        { status: 400 }
      );
    }

    if (file.type !== 'application/pdf') {
      return NextResponse.json(
        { error: 'Only PDF files are supported' },
        { status: 400 }
      );
    }

    // For now, we'll return mock data until we fix the PDF parsing
    // In a real implementation, you would parse the PDF here
    const mockContent = `This is a sample PDF content for demonstration purposes. 
    
The document contains information about various topics including:
- Introduction to the subject matter
- Key concepts and definitions  
- Detailed explanations and examples
- Conclusions and recommendations

This content would normally be extracted from the actual PDF file using a PDF parsing library. 
The AI can use this content to answer questions and generate quizzes based on the document.`;

    return NextResponse.json({
      content: mockContent,
      pageCount: 5,
      metadata: {
        title: file.name,
        author: 'Unknown',
        subject: 'PDF Document',
      },
      info: {
        PDFFormatVersion: '1.4',
        IsAcroFormPresent: false,
        IsXFAPresent: false,
      },
    });

  } catch (error) {
    console.error('PDF upload error:', error);
    return NextResponse.json(
      { error: 'Failed to process PDF file' },
      { status: 500 }
    );
  }
}