'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Upload, 
  FileText,
  ArrowLeft,
  Plus,
  X,
  CheckCircle
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
  const [showSuccessPopup, setShowSuccessPopup] = useState(false);
  const [successMessage, setSuccessMessage] = useState('');

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

      // Step 2: Process and upload each PDF with proper RAG processing
      const documentPromises = uploadedFiles.map(async (fileData) => {
        try {
          // Upload and process the document with RAG (PDF parsing is done in the backend)
          const { data: { session } } = await supabase.auth.getSession();
          
          const formData = new FormData();
          formData.append('file', fileData.file);
          formData.append('notebookId', notebook.id);
          
          const uploadResponse = await fetch('/api/upload', {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${session?.access_token}`
            },
            body: formData // Send as FormData, not JSON
          });

          if (!uploadResponse.ok) {
            const errorData = await uploadResponse.json();
            throw new Error(errorData.error || `Failed to upload document: ${uploadResponse.statusText}`);
          }

          const uploadResult = await uploadResponse.json();
          console.log(`Uploaded and processed ${fileData.name}:`, uploadResult);

          return {
            id: uploadResult.documentId,
            filename: fileData.name,
            message: uploadResult.message
          };

        } catch (error) {
          console.error(`Error processing document ${fileData.name}:`, error);
          throw new Error(`Failed to process ${fileData.name}: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
      });

      // Wait for all documents to be processed (including RAG embedding)
      const documents = await Promise.all(documentPromises);
      console.log('Documents processed with RAG:', documents);

      console.log(`Document Upload Summary:
        - Documents: ${documents.length}
        - Files processed: ${documents.map(d => d.filename).join(', ')}`);
      
      // Show success popup
      setSuccessMessage(`Successfully uploaded ${documents.length} document(s) to your notebook!`);
      setShowSuccessPopup(true);
      
      // Auto-hide popup after 3 seconds
      setTimeout(() => {
        setShowSuccessPopup(false);
      }, 3000);

      // Step 3: Navigate to the created notebook after a brief delay
      setTimeout(() => {
        router.push(`/notebook/${notebook.id}`);
      }, 1500);
      
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

      {/* Success Popup */}
      <AnimatePresence>
        {showSuccessPopup && (
          <motion.div
            initial={{ opacity: 0, y: -50, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -50, scale: 0.9 }}
            transition={{ duration: 0.3, ease: "easeOut" }}
            className="fixed top-6 right-6 z-50 bg-gradient-to-r from-green-500 to-emerald-600 text-white px-6 py-4 rounded-2xl shadow-2xl shadow-green-500/25 border border-green-400/20 backdrop-blur-sm"
          >
            <div className="flex items-center space-x-3">
              <motion.div
                initial={{ scale: 0, rotate: -180 }}
                animate={{ scale: 1, rotate: 0 }}
                transition={{ duration: 0.5, delay: 0.1 }}
                className="w-6 h-6 bg-white/20 rounded-full flex items-center justify-center"
              >
                <CheckCircle className="w-4 h-4 text-white" />
              </motion.div>
              <div>
                <p className="font-semibold text-sm">{successMessage}</p>
                <p className="text-xs text-green-100 mt-1">Redirecting to your notebook...</p>
              </div>
            </div>
            
            {/* Progress bar */}
            <motion.div
              initial={{ width: "100%" }}
              animate={{ width: "0%" }}
              transition={{ duration: 3, ease: "linear" }}
              className="absolute bottom-0 left-0 h-1 bg-white/30 rounded-b-2xl"
            />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}