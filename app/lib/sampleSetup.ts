// Script to help populate sample PDFs with real content
// Run this script to update the sample data with actual PDF files

import { sampleNotebooks } from './sampleData';

// Instructions for adding real PDF content:
console.log(`
📚 Sample Data Setup Instructions:

1. AUTOMATIC SEEDING (Current Implementation):
   - New users automatically get 3 sample notebooks
   - Each notebook has 3-4 placeholder documents
   - Documents show realistic filenames but no actual PDF content
   - Users can immediately test the UI and see how notebooks work

2. TO ADD REAL PDF CONTENT:
   
   Option A: Replace placeholders with base64 PDF data
   - Convert your sample PDFs to base64
   - Update the content_text field in sampleData.ts
   - Files will be viewable in the PDF viewer
   
   Option B: Upload to Supabase Storage
   - Upload sample PDFs to your Supabase storage bucket
   - Update the storage_path field instead of content_text
   - More efficient for larger files
   
   Option C: Use public sample PDFs
   - Find educational PDFs with permissive licenses
   - Convert to base64 or upload to storage
   - Update the sample data accordingly

3. SAMPLE NOTEBOOKS INCLUDED:
   ${sampleNotebooks.map((nb, i) => `
   ${i + 1}. ${nb.title}
      - ${nb.documents.length} documents
      - ${nb.documents.map(doc => doc.filename).join(', ')}`).join('')}

4. DATABASE STRUCTURE NEEDED:
   Make sure your Supabase database has these tables:
   
   notebooks:
   - id (uuid, primary key)
   - user_id (uuid, foreign key to auth.users)
   - title (text)
   - description (text)
   - source_count (integer)
   - is_featured (boolean)
   - created_at (timestamp)
   
   documents:
   - id (uuid, primary key)
   - notebook_id (uuid, foreign key to notebooks)
   - user_id (uuid, foreign key to auth.users)
   - filename (text)
   - content_text (text) -- for base64 PDF content
   - storage_path (text) -- for Supabase storage path
   - status (text) -- 'ready', 'processing', etc.
   - file_size (integer)
   - created_at (timestamp)

5. HOW IT WORKS:
   - When a user first logs in, the system checks if they have any notebooks
   - If they don't, it automatically creates the sample notebooks
   - This gives them immediate content to explore and test with
   - They can still create their own notebooks normally
   - Sample notebooks appear just like regular notebooks in the UI

6. BENEFITS:
   ✅ New users aren't greeted with empty state
   ✅ Immediate demonstration of app functionality  
   ✅ Realistic test data for development
   ✅ Users can explore features before uploading own PDFs
   ✅ Better onboarding experience
`);

// Helper function to convert file to base64 (for browser environment)
export function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = () => {
      const result = reader.result as string;
      // Remove the "data:application/pdf;base64," prefix
      const base64 = result.split(',')[1];
      resolve(base64);
    };
    reader.onerror = error => reject(error);
  });
}

// Helper function to generate sample content for testing
export function generateSamplePDFContent(): string {
  // This is a minimal PDF header - not a real PDF but useful for testing
  // In production, you'd want to use actual PDF files
  return btoa(`%PDF-1.4
1 0 obj
<<
/Type /Catalog
/Pages 2 0 R
>>
endobj

2 0 obj
<<
/Type /Pages
/Kids [3 0 R]
/Count 1
>>
endobj

3 0 obj
<<
/Type /Page
/Parent 2 0 R
/MediaBox [0 0 612 792]
/Contents 4 0 R
>>
endobj

4 0 obj
<<
/Length 44
>>
stream
BT
/F1 12 Tf
72 720 Td
(Sample PDF Content) Tj
ET
endstream
endobj

xref
0 5
0000000000 65535 f 
0000000009 00000 n 
0000000058 00000 n 
0000000115 00000 n 
0000000207 00000 n 
trailer
<<
/Size 5
/Root 1 0 R
>>
startxref
302
%%EOF`);
}