// Test script to verify sample data chunk creation
// Run this to check if document chunks are properly created

import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
  console.error('❌ Missing Supabase configuration');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

async function testChunkCreation() {
  try {
    console.log('🔍 Testing chunk creation for sample data...');
    
    // Get all documents
    const { data: documents, error: docError } = await supabase
      .from('documents')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(5);

    if (docError) throw docError;

    console.log(`📄 Found ${documents?.length || 0} documents`);

    for (const doc of documents || []) {
      console.log(`\n📋 Document: ${doc.filename}`);
      console.log(`   Content length: ${doc.content_text?.length || 0} characters`);
      console.log(`   Status: ${doc.status}`);

      // Check chunks for this document
      const { data: chunks, error: chunkError } = await supabase
        .from('document_chunks')
        .select('*')
        .eq('document_id', doc.id)
        .order('chunk_index');

      if (chunkError) {
        console.error(`   ❌ Error fetching chunks:`, chunkError);
        continue;
      }

      console.log(`   🧩 Chunks: ${chunks?.length || 0}`);
      
      if (chunks && chunks.length > 0) {
        console.log(`   ✅ First chunk preview: "${chunks[0].content.substring(0, 100)}..."`);
        console.log(`   🧠 Embedding dimensions: ${chunks[0].embedding?.length || 'No embedding'}`);
      } else {
        console.log(`   ❌ No chunks found for this document`);
      }
    }

    // Summary
    const { data: totalChunks, error: totalError } = await supabase
      .from('document_chunks')
      .select('id', { count: 'exact' });

    if (!totalError) {
      console.log(`\n📊 Total document chunks in database: ${totalChunks?.length || 0}`);
    }

  } catch (error) {
    console.error('❌ Test failed:', error);
  }
}

// Run the test
testChunkCreation();