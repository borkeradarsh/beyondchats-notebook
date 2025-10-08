# RAG Implementation Setup Guide

## What's Been Fixed

Your NotebookLM clone now implements proper **Retrieval-Augmented Generation (RAG)** instead of just sending entire documents to the AI. Here's what changed:

### 🧠 How RAG Works Now

1. **Document Processing (Indexing Phase)**:
   - Documents are automatically split into smaller chunks (~1000 words with overlap)
   - Each chunk is converted to embeddings using Google's `text-embedding-004` model
   - Chunks and embeddings are stored in a vector database (Supabase with pgvector)

2. **Query Processing (Retrieval Phase)**:
   - User questions are converted to embeddings using the same model
   - System searches for the most semantically similar document chunks
   - Top 5-8 most relevant chunks are retrieved based on cosine similarity

3. **Answer Generation (Augmented Phase)**:
   - Retrieved chunks are formatted as context for the LLM
   - AI is instructed to answer ONLY based on provided context
   - Responses include citations showing which sources were used

## 🚀 Setup Instructions

### 1. Database Setup

Run this SQL in your Supabase SQL editor to create the required tables:

```sql
-- Enable vector extension
CREATE EXTENSION IF NOT EXISTS vector;

-- Create document chunks table
CREATE TABLE IF NOT EXISTS document_chunks (
  id BIGSERIAL PRIMARY KEY,
  document_id UUID NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
  chunk_index INTEGER NOT NULL,
  content TEXT NOT NULL,
  embedding vector(768), -- Google's text-embedding-004 produces 768-dimensional vectors
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(document_id, chunk_index)
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS document_chunks_embedding_idx ON document_chunks 
USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100);

CREATE INDEX IF NOT EXISTS document_chunks_document_id_idx ON document_chunks(document_id);

-- Enable Row Level Security
ALTER TABLE document_chunks ENABLE ROW LEVEL SECURITY;

-- Create access policy
CREATE POLICY "Users can access their document chunks" ON document_chunks
  FOR ALL 
  USING (
    document_id IN (
      SELECT d.id FROM documents d 
      WHERE d.user_id = auth.uid()
    )
  );

-- Create search function
CREATE OR REPLACE FUNCTION search_document_chunks(
  query_embedding vector(768),
  notebook_id uuid,
  selected_documents uuid[] DEFAULT NULL,
  similarity_threshold float DEFAULT 0.7,
  match_count int DEFAULT 5
)
RETURNS TABLE (
  content text,
  chunk_index int,
  filename text,
  document_id uuid,
  similarity float
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    dc.content,
    dc.chunk_index,
    d.filename,
    d.id as document_id,
    1 - (dc.embedding <=> query_embedding) as similarity
  FROM document_chunks dc
  JOIN documents d ON dc.document_id = d.id
  WHERE 
    d.user_id = auth.uid() AND
    (
      (selected_documents IS NULL AND d.notebook_id = search_document_chunks.notebook_id) OR
      (selected_documents IS NOT NULL AND d.id = ANY(selected_documents))
    ) AND
    1 - (dc.embedding <=> query_embedding) > similarity_threshold
  ORDER BY dc.embedding <=> query_embedding
  LIMIT match_count;
END;
$$;
```

### 2. Environment Variables

Make sure you have these in your `.env.local`:

```bash
GOOGLE_API_KEY=your_gemini_api_key_here
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
```

### 3. Test the RAG System

1. **Upload Documents**: Create a new notebook and upload PDF files
2. **Wait for Processing**: Documents are automatically chunked and embedded (check console logs)
3. **Ask Questions**: Chat with your documents using specific questions like:
   - "What are the main findings in the Q3 report?"
   - "Explain the methodology used in this study"
   - "What recommendations does the document provide?"

## 🔍 How to Verify It's Working

### Check Console Logs
When you ask questions, you should see logs like:
```
Starting RAG retrieval for message: What are the key findings?
Generated query embedding, dimension: 768
RAG search results: { chunksFound: 5, searchError: null }
RAG context prepared: { contextLength: 2847, sourcesCount: 5, avgSimilarity: 0.834 }
```

### Look for Citations
AI responses should now include citations like:
```
Based on the provided documents, the key findings include... (Source 1, Source 3)

According to the Q3 report... (Source 2)
```

### Check Response Quality
- Answers should be more accurate and specific to your documents
- AI should say "I cannot find information about X in the provided documents" when appropriate
- Responses should reference specific content from your uploaded files

## 🚨 Troubleshooting

### If RAG isn't working:
1. **Check database setup**: Make sure the `document_chunks` table exists
2. **Verify API key**: Ensure your Google AI API key is valid
3. **Check embeddings**: Look for "Document embedding status" in console logs
4. **Test with specific questions**: Ask about content you know is in your documents

### Common Issues:
- **No chunks found**: Documents might not be embedded yet (wait a few minutes after upload)
- **Low similarity scores**: Try rephrasing your question to be more specific
- **Generic answers**: AI might be falling back to general knowledge (check if context is being retrieved)

## 🎯 What's Different Now

| Before (Basic Chat) | After (RAG Implementation) |
|---|---|
| ❌ Sent entire documents to AI | ✅ Retrieves only relevant chunks |
| ❌ Token limit issues | ✅ Stays within context limits |
| ❌ Generic/hallucinated answers | ✅ Grounded, cited responses |
| ❌ Poor performance with large docs | ✅ Scales with document size |
| ❌ No source attribution | ✅ Clear citations and sources |

Your NotebookLM clone now works like the real NotebookLM! 🎉