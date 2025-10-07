'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import { 
  Upload, 
  FileText,
  ArrowLeft,
  Plus,
  X
} from 'lucide-react';
import { Button } from '@/app/components/ui/button';
import { useAuth } from '@/app/components/auth/AuthProvider';
import { supabase } from '@/app/lib/supabase';

interface UploadedFile {
  id: string;
  file: File;
  name: string;
  size: number;
}

export default function NewNotebookPage() {
  const router = useRouter();
  const { user, loading } = useAuth();
  const [notebookTitle, setNotebookTitle] = useState('');
  const [uploadedFiles, setUploadedFiles] = useState<UploadedFile[]>([]);
  const [isUploading, setIsUploading] = useState(false);

  // Redirect to login if not authenticated
  useEffect(() => {
    if (!loading && !user) {
      router.push('/');
    }
  }, [user, loading, router]);

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files || []);
    const pdfFiles = files.filter(file => file.type === 'application/pdf');
    
    const newFiles: UploadedFile[] = pdfFiles.map(file => ({
      id: Date.now().toString() + Math.random().toString(36).substr(2, 9),
      file,
      name: file.name,
      size: file.size
    }));

    setUploadedFiles(prev => [...prev, ...newFiles]);
  };

  const removeFile = (fileId: string) => {
    setUploadedFiles(prev => prev.filter(file => file.id !== fileId));
  };

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const handleCreateNotebook = async () => {
    if (!user) {
      alert('Please log in to create a notebook.');
      return;
    }

    if (!notebookTitle.trim() || uploadedFiles.length === 0) {
      alert('Please provide a notebook title and upload at least one PDF file.');
      return;
    }

    setIsUploading(true);
    
    try {
      // Step 1: Create notebook entry in Supabase
      const { data: notebook, error: notebookError } = await supabase
        .from('notebooks')
        .insert({
          user_id: user.id,
          title: notebookTitle.trim(),
          description: `Notebook with ${uploadedFiles.length} PDF document${uploadedFiles.length !== 1 ? 's' : ''}`,
          source_count: uploadedFiles.length,
          is_featured: false
        })
        .select()
        .single();

      if (notebookError) {
        throw new Error(`Failed to create notebook: ${notebookError.message}`);
      }

      console.log('Notebook created:', notebook);

      // Step 2: Process and create document entries for each PDF
      const documentPromises = uploadedFiles.map(async (fileData) => {
        // For now, we'll create document entries without actual file upload
        // In a production app, you'd upload to Supabase Storage first
        
        // Extract basic text content (placeholder)
        const mockContent = `Document: ${fileData.name}

EXECUTIVE SUMMARY
This document contains comprehensive information about various topics relevant to academic and professional research. The content has been carefully structured to provide valuable insights and actionable information.

MAIN CONTENT SECTIONS:

1. INTRODUCTION
This PDF document serves as a comprehensive resource covering multiple domains of knowledge. It includes detailed analysis, research findings, and practical applications that can be referenced for academic, professional, or personal learning purposes.

2. KEY FINDINGS AND INSIGHTS
• Advanced concepts and methodologies are thoroughly explained
• Practical examples demonstrate real-world applications  
• Case studies provide context and validation of theories
• Statistical data supports conclusions and recommendations
• Best practices are outlined for implementation

3. DETAILED ANALYSIS
The document presents in-depth analysis of complex topics, breaking down intricate concepts into understandable components. Each section builds upon previous knowledge while introducing new perspectives and methodologies.

4. RESEARCH METHODOLOGY
The information presented follows rigorous research standards, incorporating:
- Primary source materials
- Peer-reviewed publications
- Expert interviews and consultations
- Empirical data collection and analysis
- Comparative studies and benchmarking

5. CONCLUSIONS AND RECOMMENDATIONS
Based on comprehensive analysis, the document provides actionable recommendations for practical implementation. These suggestions are grounded in evidence-based research and proven methodologies.

6. REFERENCES AND FURTHER READING
Extensive bibliography and resource lists are provided for readers seeking additional information on specific topics covered in this document.

TECHNICAL SPECIFICATIONS:
- Document Name: ${fileData.name}
- File Size: ${formatFileSize(fileData.size)}
- Content Type: PDF Document
- Processing Date: ${new Date().toLocaleDateString()}
- Pages: Multiple sections with detailed content

This mock content demonstrates how actual PDF text extraction would provide substantial, searchable content for AI-powered question answering and document analysis.`;

        const { data: document, error: docError } = await supabase
          .from('documents')
          .insert({
            notebook_id: notebook.id,
            user_id: user.id,
            filename: fileData.name,
            file_path: `/uploads/${user.id}/${notebook.id}/${fileData.name}`, // Mock path
            file_size: fileData.size,
            content_text: mockContent,
            page_count: Math.floor(Math.random() * 50) + 10 // Mock page count 10-60
          })
          .select()
          .single();

        if (docError) {
          console.error(`Error creating document ${fileData.name}:`, docError);
          throw new Error(`Failed to create document: ${docError.message}`);
        }

        return document;
      });

      // Wait for all documents to be created
      const documents = await Promise.all(documentPromises);
      console.log('Documents created:', documents);

      // Step 3: Navigate to the created notebook
      router.push(`/notebook/${notebook.id}`);
      
    } catch (error) {
      console.error('Error creating notebook:', error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      alert(`Failed to create notebook: ${errorMessage}`);
    } finally {
      setIsUploading(false);
    }
  };

  // Show loading while checking authentication
  if (loading) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600"></div>
      </div>
    );
  }

  // Don't render if not authenticated (will redirect)
  if (!user) {
    return null;
  }

  return (
    <div className="min-h-screen bg-slate-950">
      {/* Header */}
      <header className="border-b border-slate-800 bg-slate-950/80 backdrop-blur-lg">
        <div className="max-w-4xl mx-auto px-6 py-4">
          <div className="flex items-center space-x-4">
            <button
              onClick={() => router.push('/dashboard')}
              className="p-2 hover:bg-slate-800 rounded-lg transition-colors"
            >
              <ArrowLeft className="w-5 h-5 text-gray-400" />
            </button>
            <h1 className="text-xl font-bold text-white">Create New Notebook</h1>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-4xl mx-auto px-6 py-8">
        <div className="space-y-8">
          {/* Notebook Title */}
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Notebook Title
            </label>
            <input
              type="text"
              value={notebookTitle}
              onChange={(e) => setNotebookTitle(e.target.value)}
              placeholder="Enter notebook title..."
              className="w-full bg-slate-800 border border-slate-700 rounded-lg px-4 py-3 text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-600 focus:border-transparent"
            />
          </div>

          {/* File Upload Section */}
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-4">
              Upload PDF Files
            </label>
            
            {/* Upload Area */}
            <div className="border-2 border-dashed border-slate-700 rounded-2xl p-8 text-center hover:border-slate-600 transition-colors">
              <input
                type="file"
                multiple
                accept=".pdf"
                onChange={handleFileUpload}
                className="hidden"
                id="file-upload"
              />
              <label
                htmlFor="file-upload"
                className="cursor-pointer flex flex-col items-center space-y-4"
              >
                <div className="w-16 h-16 bg-slate-800 rounded-full flex items-center justify-center">
                  <Upload className="w-8 h-8 text-gray-400" />
                </div>
                <div>
                  <p className="text-white font-medium mb-2">
                    Click to upload PDF files
                  </p>
                  <p className="text-gray-400 text-sm">
                    Select multiple PDF files to add to your notebook
                  </p>
                </div>
              </label>
            </div>
          </div>

          {/* Uploaded Files List */}
          {uploadedFiles.length > 0 && (
            <div>
              <h3 className="text-lg font-semibold text-white mb-4">
                Uploaded Files ({uploadedFiles.length})
              </h3>
              <div className="space-y-3">
                {uploadedFiles.map((file) => (
                  <motion.div
                    key={file.id}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="flex items-center justify-between p-4 bg-slate-800 rounded-lg border border-slate-700"
                  >
                    <div className="flex items-center space-x-3">
                      <div className="w-10 h-10 bg-red-600 rounded-lg flex items-center justify-center">
                        <FileText className="w-5 h-5 text-white" />
                      </div>
                      <div>
                        <p className="text-white font-medium">{file.name}</p>
                        <p className="text-gray-400 text-sm">{formatFileSize(file.size)}</p>
                      </div>
                    </div>
                    <button
                      onClick={() => removeFile(file.id)}
                      className="p-2 hover:bg-slate-700 rounded-lg transition-colors"
                    >
                      <X className="w-4 h-4 text-gray-400" />
                    </button>
                  </motion.div>
                ))}
              </div>
            </div>
          )}



          {/* Create Button */}
          <div className="flex justify-end">
            <Button
              onClick={handleCreateNotebook}
              disabled={!notebookTitle.trim() || uploadedFiles.length === 0 || isUploading}
              className="bg-blue-600 hover:bg-blue-700 px-8 py-3"
            >
              {isUploading ? (
                <div className="flex items-center space-x-2">
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  <span>Creating...</span>
                </div>
              ) : (
                <div className="flex items-center space-x-2">
                  <Plus className="w-4 h-4" />
                  <span>Create Notebook</span>
                </div>
              )}
            </Button>
          </div>
        </div>
      </main>
    </div>
  );
}