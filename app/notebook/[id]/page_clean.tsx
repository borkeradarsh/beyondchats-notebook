'use client';

import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/app/lib/supabase';
import { motion, AnimatePresence } from 'framer-motion';
import { Send, FileText, ChevronLeft, Menu, MessageSquare, BookOpen, BarChart3, Play, Download, Share, Settings } from 'lucide-react';
import { redirect } from 'next/navigation';

interface Document {
  id: string;
  filename: string;
  content_text: string;
  created_at: string;
}

interface Notebook {
  id: string;
  title: string;
  description: string;
}

interface Message {
  id: string;
  content: string;
  is_user: boolean;
  created_at: string;
}

// Tab Button Component
const TabButton = ({ icon: Icon, label, active }: { icon: any, label: string, active: boolean }) => (
  <motion.button
    whileHover={{ scale: 1.02 }}
    whileTap={{ scale: 0.98 }}
    className={`flex items-center px-4 py-2 rounded-lg font-medium transition-colors ${
      active 
        ? 'bg-blue-600 text-white' 
        : 'text-slate-400 hover:text-white hover:bg-slate-700'
    }`}
  >
    <Icon className="w-4 h-4 mr-2" />
    {label}
  </motion.button>
);

export default function NotebookPage({ params }: { params: Promise<{ id: string }> }) {
  const [notebookId, setNotebookId] = useState<string | null>(null);
  const [notebook, setNotebook] = useState<Notebook | null>(null);
  const [documents, setDocuments] = useState<Document[]>([]);
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [selectedDocuments, setSelectedDocuments] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSending, setIsSending] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(true);

  useEffect(() => {
    params.then(({ id }) => setNotebookId(id));
  }, [params]);

  const loadNotebookData = useCallback(async () => {
    if (!notebookId) return;
    
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        redirect('/login');
        return;
      }

      const { data: notebookData, error: notebookError } = await supabase
        .from('notebooks')
        .select('*')
        .eq('id', notebookId)
        .eq('user_id', user.id)
        .single();

      if (notebookError || !notebookData) {
        redirect('/dashboard');
        return;
      }

      setNotebook(notebookData);

      const { data: documentsData } = await supabase
        .from('documents')
        .select('*')
        .eq('notebook_id', notebookId)
        .eq('user_id', user.id)
        .order('created_at', { ascending: true });

      setDocuments(documentsData || []);

      const { data: messagesData } = await supabase
        .from('chat_messages')
        .select('*')
        .eq('notebook_id', notebookId)
        .eq('user_id', user.id)
        .order('created_at', { ascending: true });

      setMessages(messagesData || []);
    } catch (error) {
      console.error('Error loading notebook data:', error);
    } finally {
      setIsLoading(false);
    }
  }, [notebookId]);

  useEffect(() => {
    loadNotebookData();
  }, [loadNotebookData]);

  const sendMessage = async () => {
    if (!newMessage.trim() || isSending || !notebookId) return;

    setIsSending(true);
    const userMessage = newMessage.trim();
    setNewMessage('');

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const tempUserMessage: Message = {
        id: Date.now().toString(),
        content: userMessage,
        is_user: true,
        created_at: new Date().toISOString()
      };
      setMessages(prev => [...prev, tempUserMessage]);

      // Get the session token for API authentication
      const { data: { session } } = await supabase.auth.getSession();
      
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session?.access_token}`,
        },
        body: JSON.stringify({
          message: userMessage,
          notebookId: notebookId!,
          selectedDocuments,
          userId: user.id
        }),
      });

      const data = await response.json();

      if (data.response) {
        const aiMessage: Message = {
          id: (Date.now() + 1).toString(),
          content: data.response,
          is_user: false,
          created_at: new Date().toISOString()
        };
        setMessages(prev => [...prev, aiMessage]);
      }
    } catch (error) {
      console.error('Error sending message:', error);
    } finally {
      setIsSending(false);
    }
  };

  const toggleDocumentSelection = (docId: string) => {
    setSelectedDocuments(prev => 
      prev.includes(docId) 
        ? prev.filter(id => id !== docId)
        : [...prev, docId]
    );
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center">
        <motion.div
          animate={{ rotate: 360 }}
          transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
          className="w-8 h-8 border-2 border-blue-600 border-t-transparent rounded-full"
        />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 flex">
      <AnimatePresence>
        {sidebarOpen && (
          <motion.div
            initial={{ x: -300 }}
            animate={{ x: 0 }}
            exit={{ x: -300 }}
            transition={{ type: "spring", damping: 20 }}
            className="w-80 bg-slate-900 border-r border-slate-700 flex flex-col"
          >
            <div className="p-6 border-b border-slate-700">
              <motion.button
                whileHover={{ x: -4 }}
                onClick={() => window.history.back()}
                className="flex items-center text-slate-400 hover:text-white mb-4"
              >
                <ChevronLeft className="w-5 h-5 mr-1" />
                Back
              </motion.button>
              <h1 className="text-xl font-semibold text-white mb-2">
                {notebook?.title}
              </h1>
              <p className="text-sm text-slate-400">
                {notebook?.description}
              </p>
            </div>

            <div className="flex-1 p-6">
              <h2 className="text-sm font-medium text-slate-300 mb-4">
                Documents ({documents.length})
              </h2>
              <div className="space-y-2">
                {documents.map((doc) => (
                  <motion.button
                    key={doc.id}
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={() => toggleDocumentSelection(doc.id)}
                    className={`w-full p-3 rounded-lg border text-left transition-colors ${
                      selectedDocuments.includes(doc.id)
                        ? 'border-blue-500 bg-blue-900/30 text-blue-200'
                        : 'border-slate-600 bg-slate-800 text-slate-300 hover:bg-slate-700'
                    }`}
                  >
                    <div className="flex items-center">
                      <FileText className="w-4 h-4 mr-3 flex-shrink-0" />
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium truncate">
                          {doc.filename}
                        </p>
                        <p className="text-xs text-slate-400 mt-1">
                          {new Date(doc.created_at).toLocaleDateString()}
                        </p>
                      </div>
                    </div>
                  </motion.button>
                ))}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="flex-1 flex flex-col">
        {/* Enhanced Header with Tabs */}
        <div className="bg-slate-900 border-b border-slate-700">
          <div className="px-6 py-4 flex items-center justify-between border-b border-slate-700/50">
            <div className="flex items-center">
              <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={() => setSidebarOpen(!sidebarOpen)}
                className="p-2 hover:bg-slate-700 rounded-lg mr-4"
              >
                <Menu className="w-5 h-5 text-slate-400" />
              </motion.button>
              <div>
                <h1 className="text-xl font-semibold text-white">
                  {notebook?.title}
                </h1>
                <p className="text-sm text-slate-400 mt-1">
                  {documents.length} document{documents.length !== 1 ? 's' : ''} • Interactive Learning
                </p>
              </div>
            </div>
            
            <div className="flex items-center space-x-2">
              <motion.button
                whileHover={{ scale: 1.05 }}
                className="p-2 hover:bg-slate-700 rounded-lg text-slate-400 hover:text-white"
              >
                <Share className="w-4 h-4" />
              </motion.button>
              <motion.button
                whileHover={{ scale: 1.05 }}
                className="p-2 hover:bg-slate-700 rounded-lg text-slate-400 hover:text-white"
              >
                <Download className="w-4 h-4" />
              </motion.button>
              <motion.button
                whileHover={{ scale: 1.05 }}
                className="p-2 hover:bg-slate-700 rounded-lg text-slate-400 hover:text-white"
              >
                <Settings className="w-4 h-4" />
              </motion.button>
            </div>
          </div>
          
          {/* Tab Navigation */}
          <div className="px-6">
            <div className="flex space-x-1">
              <TabButton icon={MessageSquare} label="Chat" active={true} />
              <TabButton icon={BookOpen} label="Quiz" active={false} />
              <TabButton icon={BarChart3} label="Progress" active={false} />
              <TabButton icon={Play} label="Videos" active={false} />
            </div>
          </div>
        </div>

        {/* Chat Area */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          <AnimatePresence>
            {messages.map((message) => (
              <motion.div
                key={message.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                className={`flex ${message.is_user ? 'justify-end' : 'justify-start'}`}
              >
                <div className={`max-w-3xl p-4 rounded-lg ${
                  message.is_user 
                    ? 'bg-blue-600 text-white' 
                    : 'bg-slate-800 border border-slate-600 text-slate-100'
                }`}>
                  <p className="whitespace-pre-wrap">
                    {message.content}
                  </p>
                </div>
              </motion.div>
            ))}
          </AnimatePresence>

          {isSending && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="flex justify-start"
            >
              <div className="bg-slate-800 border border-slate-600 text-slate-100 max-w-3xl p-4 rounded-lg">
                <div className="flex items-center space-x-2">
                  <motion.div
                    animate={{ scale: [1, 1.2, 1] }}
                    transition={{ duration: 1, repeat: Infinity }}
                    className="w-2 h-2 bg-slate-500 rounded-full"
                  />
                  <motion.div
                    animate={{ scale: [1, 1.2, 1] }}
                    transition={{ duration: 1, repeat: Infinity, delay: 0.2 }}
                    className="w-2 h-2 bg-slate-500 rounded-full"
                  />
                  <motion.div
                    animate={{ scale: [1, 1.2, 1] }}
                    transition={{ duration: 1, repeat: Infinity, delay: 0.4 }}
                    className="w-2 h-2 bg-slate-500 rounded-full"
                  />
                </div>
              </div>
            </motion.div>
          )}
        </div>

        {/* Input Area with Educational Suggestions */}
        <div className="bg-slate-900 border-t border-slate-700 p-6">
          {/* Educational prompt suggestions */}
          {selectedDocuments.length > 0 && messages.length === 0 && (
            <div className="mb-4">
              <p className="text-sm text-slate-400 mb-2">Try asking:</p>
              <div className="flex flex-wrap gap-2">
                {[
                  "Explain the main concepts in simple terms",
                  "What are the key takeaways?",
                  "Break down the most important points",
                  "Can you give me a summary for studying?",
                  "What should I focus on learning here?"
                ].map((suggestion, index) => (
                  <button
                    key={index}
                    onClick={() => setNewMessage(suggestion)}
                    className="px-3 py-1 text-xs bg-slate-800 text-slate-300 rounded-full hover:bg-slate-700 transition-colors"
                  >
                    {suggestion}
                  </button>
                ))}
              </div>
            </div>
          )}
          
          <div className="flex space-x-4">
            <input
              type="text"
              value={newMessage}
              onChange={(e) => setNewMessage(e.target.value)}
              onKeyPress={(e) => e.key === 'Enter' && sendMessage()}
              placeholder="Ask a question about your documents..."
              className="flex-1 px-4 py-3 bg-slate-800 border border-slate-600 rounded-lg text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              disabled={isSending}
            />
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={sendMessage}
              disabled={!newMessage.trim() || isSending}
              className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center"
            >
              <Send className="w-4 h-4" />
            </motion.button>
          </div>
          {selectedDocuments.length > 0 && (
            <div className="mt-4 flex flex-wrap gap-2">
              {selectedDocuments.map((docId) => {
                const doc = documents.find(d => d.id === docId);
                return doc ? (
                  <span
                    key={docId}
                    className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800"
                  >
                    <FileText className="w-3 h-3 mr-1" />
                    {doc.filename}
                  </span>
                ) : null;
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}