'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '@/app/lib/supabase';
import { motion, AnimatePresence } from 'framer-motion';
import { Send, FileText, ChevronLeft, MessageSquare, BookOpen, BarChart3, Play, Download, Share, Settings, Clock, Plus, Upload, CheckCircle, XCircle } from 'lucide-react';
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
  role: string;
  created_at: string;
}

interface QuizQuestion {
  id: string;
  type: 'mcq' | 'saq' | 'laq';
  question: string;
  options?: string[];
  correct_answer: string;
  explanation: string;
  difficulty: 'easy' | 'medium' | 'hard';
}

interface QuizResult {
  isCorrect: boolean;
  explanation: string;
  userAnswer: string;
  correctAnswer: string;
}

// Tab Button Component
const TabButton = ({ icon: Icon, label, active, onClick }: { 
  icon: React.ComponentType<{ className?: string }>, 
  label: string, 
  active: boolean,
  onClick?: () => void
}) => (
  <motion.button
    whileHover={{ scale: 1.03, y: -1 }}
    whileTap={{ scale: 0.97 }}
    onClick={onClick}
    className={`relative flex flex-col items-center px-4 py-3 rounded-xl font-medium transition-all duration-200 min-w-[80px] ${
      active 
        ? 'bg-white text-slate-900 shadow-md border border-slate-200' 
        : 'text-slate-400 hover:text-slate-200 hover:bg-slate-700/40 border border-transparent hover:border-slate-600/50'
    }`}
  >
    <Icon className={`w-4 h-4 mb-1.5 ${active ? 'text-slate-700' : ''}`} />
    <span className={`text-xs ${active ? 'font-semibold text-slate-800' : 'font-medium'}`}>{label}</span>
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
  const [activeTab, setActiveTab] = useState<'quiz' | 'progress' | 'videos'>('quiz');
  
  // Chat state
  const [chatSessions, setChatSessions] = useState<{id: string, title: string, created_at: string, messageCount: number}[]>([]);
  const [currentChatId, setCurrentChatId] = useState<string | null>(null);
  
  // Quiz state
  const [quizQuestions, setQuizQuestions] = useState<QuizQuestion[]>([]);
  const [selectedQuizType, setSelectedQuizType] = useState<'MCQ' | 'SAQ' | 'LAQ'>('MCQ');

  const [userAnswers, setUserAnswers] = useState<{[key: string]: string}>({});
  const [isGeneratingQuiz, setIsGeneratingQuiz] = useState(false);
  const [quizScore, setQuizScore] = useState({ correct: 0, total: 0 });
  const [isSubmittingQuiz, setIsSubmittingQuiz] = useState(false);
  const [quizResults, setQuizResults] = useState<{[key: string]: {isCorrect: boolean, explanation: string}} | null>(null);
  const [showResults, setShowResults] = useState(false);
  
  // Progress tracking state
  const [progressData, setProgressData] = useState<{
    attempts: Array<{
      id: string;
      created_at: string;
      quiz_topic: string;
      quiz_type: string;
      score: number;
      total_questions: number;
      correct_answers: number;
    }>;
    statistics: {
      totalAttempts: number;
      averageScore: number;
      totalCorrectAnswers: number;
      totalQuestions: number;
      quizTypeBreakdown: Record<string, number>;
      recentActivity: Array<{
        id: string;
        created_at: string;
        quiz_topic: string;
        quiz_type: string;
        score: number;
      }>;
    };
  } | null>(null);
  const [isLoadingProgress, setIsLoadingProgress] = useState(false);

  // Ref for scrolling to bottom
  const messagesEndRef = useRef<HTMLDivElement>(null);
  
  // Ref for file input
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  // Upload state
  const [isUploading, setIsUploading] = useState(false);

  // Scroll to bottom function
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  // Scroll to bottom when messages change
  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  useEffect(() => {
    params.then(({ id }) => setNotebookId(id));
  }, [params]);

  const createNewChat = useCallback(async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user || !notebookId) return;

      // Create a new chat session ID
      const newChatId = `chat_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      const newChatTitle = 'New Chat';
      
      // Add to chat sessions
      const newSession = {
        id: newChatId,
        title: newChatTitle,
        created_at: new Date().toISOString(),
        messageCount: 0
      };
      
      setChatSessions(prev => [newSession, ...prev]);
      setCurrentChatId(newChatId);
      setMessages([]);
      
      // Save to localStorage for persistence
      const savedSessions = JSON.parse(localStorage.getItem(`chat_sessions_${notebookId}`) || '[]');
      savedSessions.unshift(newSession);
      localStorage.setItem(`chat_sessions_${notebookId}`, JSON.stringify(savedSessions));
      
    } catch (error) {
      console.error('Error creating new chat:', error);
    }
  }, [notebookId]);

  // Function to generate intelligent chat title based on content
  const generateChatTitle = useCallback((message: string): string => {
    // Remove extra whitespace and limit length
    const cleanMessage = message.trim().slice(0, 80);
    
    if (!cleanMessage) return 'New Chat';
    
    // Common academic/professional patterns
    const patterns = [
      { regex: /explain|tell me about|what is|what are/i, prefix: 'About ' },
      { regex: /how to|how do|how can/i, prefix: 'How to ' },
      { regex: /why does|why is|why are/i, prefix: 'Why ' },
      { regex: /when should|when to|when is/i, prefix: 'When ' },
      { regex: /where can|where is|where are/i, prefix: 'Where ' },
      { regex: /help me|help with|assist/i, prefix: 'Help with ' },
      { regex: /analyze|analysis/i, prefix: 'Analysis: ' },
      { regex: /compare|comparison/i, prefix: 'Comparison: ' },
      { regex: /summarize|summary/i, prefix: 'Summary: ' },
      { regex: /review|evaluate/i, prefix: 'Review: ' }
    ];
    
    // Check for patterns
    for (const pattern of patterns) {
      if (pattern.regex.test(cleanMessage)) {
        const mainPart = cleanMessage.replace(pattern.regex, '').trim();
        const words = mainPart.split(' ').slice(0, 4).join(' ');
        return pattern.prefix + words;
      }
    }
    
    // If it's a question, use it as is (truncated)
    if (cleanMessage.includes('?')) {
      const question = cleanMessage.split('?')[0];
      return question.length > 50 ? question.slice(0, 47) + '...?' : question + '?';
    }
    
    // For statements, extract key topic
    const words = cleanMessage.split(' ');
    
    // If short enough, use as is
    if (words.length <= 6) {
      return cleanMessage;
    }
    
    // Look for important keywords to build title around
    const importantWords = words.filter(word => 
      word.length > 3 && 
      !['this', 'that', 'with', 'from', 'they', 'them', 'have', 'been', 'were', 'will', 'would', 'could', 'should'].includes(word.toLowerCase())
    );
    
    if (importantWords.length > 0) {
      return importantWords.slice(0, 3).join(' ') + (importantWords.length > 3 ? '...' : '');
    }
    
    // Fallback: first 5 words
    return words.slice(0, 5).join(' ') + (words.length > 5 ? '...' : '');
  }, []);

  // Function to generate title based on conversation context
  const generateConversationTitle = useCallback((userMsg: string, aiResponse: string): string => {
    // Try to extract topic from AI response if it's more informative
    const aiWords = aiResponse.toLowerCase();
    
    // Look for key topics in AI response
    const topicKeywords = ['about', 'regarding', 'concerning', 'explains', 'discusses', 'describes'];
    for (const keyword of topicKeywords) {
      const index = aiWords.indexOf(keyword);
      if (index !== -1) {
        const afterKeyword = aiResponse.slice(index + keyword.length).trim();
        const topic = afterKeyword.split(/[.!?]/)[0].slice(0, 40);
        if (topic.length > 3) {
          return topic.charAt(0).toUpperCase() + topic.slice(1);
        }
      }
    }
    
    // Fallback to user message processing
    return generateChatTitle(userMsg);
  }, [generateChatTitle]);

  // Function to update chat title after first message
  const updateChatTitle = useCallback((chatId: string, newTitle: string) => {
    setChatSessions(prev => {
      const updated = prev.map(chat => 
        chat.id === chatId ? { ...chat, title: newTitle } : chat
      );
      
      // Save to localStorage
      localStorage.setItem(`chat_sessions_${notebookId}`, JSON.stringify(updated));
      return updated;
    });
  }, [notebookId]);

  const switchChat = useCallback((chatId: string) => {
    setCurrentChatId(chatId);
    
    // Load messages for this specific chat session from localStorage
    const loadChatMessages = () => {
      try {
        const savedMessages = JSON.parse(localStorage.getItem(`chat_messages_${notebookId}_${chatId}`) || '[]');
        setMessages(savedMessages);
      } catch (error) {
        console.error('Error loading chat messages:', error);
        setMessages([]);
      }
    };
    
    loadChatMessages();
  }, [notebookId]);

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

      // Auto-select document if there's only one
      if (documentsData && documentsData.length === 1) {
        setSelectedDocuments([documentsData[0].id]);
      }

      // Load messages
      const { data: messagesData } = await supabase
        .from('chat_messages')
        .select('*')
        .eq('notebook_id', notebookId)
        .eq('user_id', user.id)
        .order('created_at', { ascending: true });

      setMessages(messagesData || []);
      
      // Always try to load saved chat sessions from localStorage first
      const savedSessions = JSON.parse(localStorage.getItem(`chat_sessions_${notebookId}`) || '[]');
      
      if (savedSessions.length > 0) {
        // Use saved chat sessions with their proper titles
        setChatSessions(savedSessions);
        setCurrentChatId(savedSessions[0].id);
        
        // Load messages for the first chat session
        const firstChatMessages = JSON.parse(localStorage.getItem(`chat_messages_${notebookId}_${savedSessions[0].id}`) || '[]');
        setMessages(firstChatMessages);
      } else if (messagesData && messagesData.length > 0) {
        // Fallback: create a single chat with all existing messages
        const fallbackChat = {
          id: 'current',
          title: 'Chat History',
          created_at: messagesData[0].created_at,
          messageCount: messagesData.length
        };
        setChatSessions([fallbackChat]);
        setCurrentChatId('current');
        setMessages(messagesData);
        
        // Save this fallback chat to localStorage
        localStorage.setItem(`chat_sessions_${notebookId}`, JSON.stringify([fallbackChat]));
        localStorage.setItem(`chat_messages_${notebookId}_current`, JSON.stringify(messagesData));
      } else {
        // No messages at all - create empty state
        setChatSessions([]);
        setCurrentChatId(null);
        setMessages([]);
      }
    } catch (error) {
      console.error('Error loading notebook data:', error);
    } finally {
      setIsLoading(false);
    }
  }, [notebookId]);

  useEffect(() => {
    loadNotebookData();
  }, [loadNotebookData]);

  // Ensure we have at least one chat session after loading
  useEffect(() => {
    if (!isLoading && chatSessions.length === 0 && notebookId) {
      // Auto-create first chat if none exists
      createNewChat();
    }
  }, [isLoading, chatSessions.length, notebookId, createNewChat]);

  // Function to check and trigger document embedding for RAG
  const ensureDocumentsEmbedded = useCallback(async () => {
    if (!notebookId || documents.length === 0) return;
    
    try {
      const { data: { session } } = await supabase.auth.getSession();
      
      // Check if documents need embedding and process them
      const embeddingPromises = documents.map(async (doc) => {
        try {
          const response = await fetch('/api/documents/embed', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${session?.access_token}`,
            },
            body: JSON.stringify({
              documentId: doc.id
            }),
          });

          if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`HTTP ${response.status}: ${errorText}`);
          }

          const result = await response.json();
          console.log(`Embedding check for ${doc.filename}:`, result);
          return { document: doc.filename, ...result };
        } catch (error) {
          console.error(`Failed to check/embed document ${doc.filename}:`, error);
          return { document: doc.filename, error: error instanceof Error ? error.message : 'Unknown error' };
        }
      });

      const results = await Promise.all(embeddingPromises);
      console.log('Document embedding status:', results);
      
      return results;
    } catch (error) {
      console.error('Error in ensureDocumentsEmbedded:', error);
    }
  }, [notebookId, documents]);

  // Automatically check document embedding when documents are loaded
  useEffect(() => {
    if (documents.length > 0 && notebookId) {
      // Delay to let the component fully load
      setTimeout(() => {
        ensureDocumentsEmbedded();
      }, 2000);
    }
  }, [documents, notebookId, ensureDocumentsEmbedded]);

  const sendMessage = async () => {
    if (!newMessage.trim() || isSending || !notebookId) return;
    
    // Ensure we have a current chat session
    if (!currentChatId) {
      await createNewChat();
      // Wait a bit for state to update
      setTimeout(() => sendMessage(), 100);
      return;
    }

    setIsSending(true);
    const userMessage = newMessage.trim();
    setNewMessage('');

    // Scroll to bottom immediately when user sends a message
    setTimeout(() => scrollToBottom(), 100);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // Save user message to database
      const { data: userMessageData } = await supabase
        .from('chat_messages')
        .insert({
          notebook_id: notebookId,
          content: userMessage,
          role: 'user',
          user_id: user.id
        })
        .select()
        .single();

      if (userMessageData) {
        const tempUserMessage: Message = {
          id: userMessageData.id,
          content: userMessage,
          role: 'user',
          created_at: userMessageData.created_at
        };
        setMessages(prev => {
          const newMessages = [...prev, tempUserMessage];
          // Save to localStorage for this specific chat
          localStorage.setItem(`chat_messages_${notebookId}_${currentChatId}`, JSON.stringify(newMessages));
          
          // Update chat session with new message count and title
          setChatSessions(prev => {
            const updated = prev.map(chat => 
              chat.id === currentChatId 
                ? { ...chat, messageCount: newMessages.length }
                : chat
            );
            localStorage.setItem(`chat_sessions_${notebookId}`, JSON.stringify(updated));
            return updated;
          });
          
          // If this is the first message in the chat, update chat title
          if (newMessages.length === 1) {
            const intelligentTitle = generateChatTitle(userMessage);
            updateChatTitle(currentChatId, intelligentTitle);
          }
          
          return newMessages;
        });
      }

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

      if (data.error) {
        console.error('Chat API error:', data.error);
        // You could show an error message to the user here
        return;
      }

      if (data.answer) {
        // Save AI response to database
        const { data: aiMessageData } = await supabase
          .from('chat_messages')
          .insert({
            notebook_id: notebookId,
            content: data.answer,
            role: 'assistant',
            user_id: user.id
          })
          .select()
          .single();

        if (aiMessageData) {
          const aiMessage: Message = {
            id: aiMessageData.id,
            content: data.answer,
            role: 'assistant',
            created_at: aiMessageData.created_at
          };
          setMessages(prev => {
            const newMessages = [...prev, aiMessage];
            // Save to localStorage for this specific chat
            localStorage.setItem(`chat_messages_${notebookId}_${currentChatId}`, JSON.stringify(newMessages));
            
            // Update chat session message count
            setChatSessions(prev => {
              const updated = prev.map(chat => 
                chat.id === currentChatId 
                  ? { ...chat, messageCount: newMessages.length }
                  : chat
              );
              localStorage.setItem(`chat_sessions_${notebookId}`, JSON.stringify(updated));
              return updated;
            });
            
            // If this is the second message (first AI response), potentially improve the title
            if (newMessages.length === 2) {
              const currentSession = chatSessions.find(chat => chat.id === currentChatId);
              if (currentSession && (currentSession.title === 'New Chat' || currentSession.title.startsWith('About ') || currentSession.title.startsWith('How to '))) {
                // Generate a better title based on the conversation context
                const improvedTitle = generateConversationTitle(userMessage, data.answer);
                updateChatTitle(currentChatId, improvedTitle);
              }
            }
            
            return newMessages;
          });
        }
      }
    } catch (error) {
      console.error('Error sending message:', error);
    } finally {
      setIsSending(false);
    }
  };



  const generateQuizWithType = async (quizType: 'MCQ' | 'SAQ' | 'LAQ') => {
    if (!notebookId || selectedDocuments.length === 0) return;
    
    setIsGeneratingQuiz(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        console.error('No authenticated user');
        return;
      }

      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) {
        console.error('No access token available');
        return;
      }
      
      const response = await fetch('/api/quiz/generate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          notebookId,
          documentIds: selectedDocuments,
          questionCount: 5,
          types: [quizType.toLowerCase()]
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        console.error('Quiz generation failed:', errorData);
        return;
      }

      const data = await response.json();
      if (data.questions) {
        setQuizQuestions(data.questions);
        setUserAnswers({});
        setQuizScore({ correct: 0, total: 0 });
        // Clear previous quiz results and submission state
        setQuizResults(null);
        setShowResults(false);
        setIsSubmittingQuiz(false);
      }
    } catch (error) {
      console.error('Error generating quiz:', error);
    } finally {
      setIsGeneratingQuiz(false);
    }
  };

  const handleAnswer = (questionId: string, answer: string) => {
    setUserAnswers(prev => ({ ...prev, [questionId]: answer }));
  };

  // Load progress data
  const loadProgressData = useCallback(async () => {
    if (!notebookId) return;
    
    setIsLoadingProgress(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) return;

      const response = await fetch(`/api/progress?notebookId=${notebookId}&limit=20`, {
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
        },
      });

      if (response.ok) {
        const data = await response.json();
        setProgressData(data);
      }
    } catch (error) {
      console.error('Error loading progress:', error);
    } finally {
      setIsLoadingProgress(false);
    }
  }, [notebookId]);

  // Load progress when notebook changes or tab becomes active
  useEffect(() => {
    if (activeTab === 'progress' && notebookId) {
      loadProgressData();
    }
  }, [activeTab, notebookId, loadProgressData]);

  const submitQuiz = async () => {
    if (!notebookId || quizQuestions.length === 0) return;
    
    setIsSubmittingQuiz(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        console.error('No authenticated user');
        return;
      }

      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) {
        console.error('No access token available');
        return;
      }

      const response = await fetch('/api/quiz/submit', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          notebookId,
          questions: quizQuestions,
          userAnswers,
          documentIds: selectedDocuments
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        console.error('Quiz submission failed:', errorData);
        return;
      }

      const data = await response.json();
      if (data.success) {
        setQuizResults(data.results);
        const results = data.results as Record<string, QuizResult>;
        const correctCount = Object.values(results).filter(r => r.isCorrect).length;
        const totalQuestions = quizQuestions.length;
        const score = Math.round((correctCount / totalQuestions) * 100);
        
        setQuizScore({ correct: correctCount, total: totalQuestions });
        setShowResults(true);
        
        // Save progress to tracking API
        try {
          const progressResponse = await fetch('/api/progress', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${session.access_token}`,
            },
            body: JSON.stringify({
              notebookId,
              documentId: selectedDocuments[0] || null, // Use first selected document
              quizTopic: `${selectedQuizType} Quiz - ${new Date().toLocaleDateString()}`,
              quizType: selectedQuizType.toLowerCase(),
              questions: quizQuestions,
              userAnswers,
              score,
              totalQuestions,
              correctAnswers: correctCount
            }),
          });
          
          if (progressResponse.ok) {
            console.log('Progress saved successfully');
          } else {
            console.error('Failed to save progress');
          }
        } catch (progressError) {
          console.error('Error saving progress:', progressError);
        }
      }
    } catch (error) {
      console.error('Error submitting quiz:', error);
    } finally {
      setIsSubmittingQuiz(false);
    }
  };

  // Handle file upload
  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (!files || files.length === 0 || !notebookId) return;

    setIsUploading(true);
    
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) return;

      for (const file of Array.from(files)) {
        if (file.type !== 'application/pdf') continue;

        const formData = new FormData();
        formData.append('file', file);
        formData.append('notebookId', notebookId);

        const response = await fetch('/api/upload', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${session.access_token}`,
          },
          body: formData,
        });

        if (!response.ok) {
          console.error('Upload failed for:', file.name);
          continue;
        }

        const result = await response.json();
        if (result.success) {
          // Refresh documents after successful upload
          loadNotebookData();
        }
      }
    } catch (error) {
      console.error('Error uploading files:', error);
    } finally {
      setIsUploading(false);
      // Reset the input
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  // Trigger file selection
  const triggerFileUpload = () => {
    fileInputRef.current?.click();
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
    <div className="h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 flex overflow-hidden">
      {/* Left Sidebar - Documents & Chat History */}
      <div className="w-80 bg-gradient-to-b from-slate-900/95 to-slate-800/95 backdrop-blur-sm border-r border-slate-700/50 flex flex-col h-full shadow-xl">
        <div className="p-6 border-b border-slate-700/50 bg-gradient-to-r from-slate-800/50 to-slate-900/50">
          <motion.button
            whileHover={{ x: -4, scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={() => window.history.back()}
            className="flex items-center text-slate-400 hover:text-white transition-all duration-200 mb-4 p-2 rounded-lg hover:bg-slate-700/50"
          >
            <ChevronLeft className="w-5 h-5 mr-1" />
            Back
          </motion.button>
          <h1 className="text-xl font-bold mb-2 bg-gradient-to-r from-white to-slate-200 bg-clip-text text-transparent">
            {notebook?.title}
          </h1>
          <p className="text-sm text-slate-400 leading-relaxed">
            {notebook?.description}
          </p>
        </div>

        {/* Documents Section */}
        <div className="flex-1 overflow-y-auto scrollbar-hide">
          <div className="p-4">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-sm font-medium text-slate-300 flex items-center">
                <FileText className="w-4 h-4 mr-2" />
                Documents ({documents.length})
              </h2>
              <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={triggerFileUpload}
                disabled={isUploading}
                className="p-2 hover:bg-slate-700 rounded-lg text-slate-400 hover:text-white disabled:opacity-50 disabled:cursor-not-allowed"
                title="Upload more documents"
              >
                <Upload className="w-4 h-4" />
              </motion.button>
            </div>
            
            {/* Hidden file input */}
            <input
              ref={fileInputRef}
              type="file"
              accept=".pdf"
              multiple
              onChange={handleFileUpload}
              className="hidden"
            />
            
            <div className="space-y-2">
              {isUploading && (
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="w-full p-3 rounded-lg border border-blue-500/50 bg-blue-900/20 text-blue-200"
                >
                  <div className="flex items-center">
                    <motion.div
                      animate={{ rotate: 360 }}
                      transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
                      className="w-4 h-4 border-2 border-blue-400 border-t-transparent rounded-full mr-3"
                    />
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium">
                        Uploading documents...
                      </p>
                      <p className="text-xs text-slate-400 mt-1">
                        Processing PDFs
                      </p>
                    </div>
                  </div>
                </motion.div>
              )}
              
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
              
              {documents.length === 0 && !isUploading && (
                <div className="text-center py-8 text-slate-400">
                  <FileText className="w-8 h-8 mx-auto mb-2 opacity-50" />
                  <p className="text-sm">No documents yet</p>
                  <p className="text-xs mt-1">Click the upload button to add PDFs</p>
                </div>
              )}
            </div>
          </div>

          {/* Chat History Section */}
          <div className="border-t border-slate-700 p-4">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-sm font-medium text-slate-300 flex items-center">
                <MessageSquare className="w-4 h-4 mr-2" />
                Chat History
              </h2>
              <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={createNewChat}
                className="p-1 hover:bg-slate-700 rounded text-slate-400 hover:text-white"
              >
                <Plus className="w-4 h-4" />
              </motion.button>
            </div>
            <div className="space-y-2">
              {chatSessions.map((chat) => (
                <motion.button
                  key={chat.id}
                  whileHover={{ scale: 1.02 }}
                  onClick={() => switchChat(chat.id)}
                  className={`w-full p-2 rounded-lg text-left transition-colors ${
                    currentChatId === chat.id
                      ? 'bg-blue-600 text-white'
                      : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                  }`}
                >
                  <p className="text-sm font-medium truncate">{chat.title}</p>
                  <p className="text-xs opacity-70">{new Date(chat.created_at).toLocaleDateString()}</p>
                </motion.button>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Main Chat Area - Always Visible */}
      <div className="flex-1 flex flex-col h-full bg-gradient-to-b from-slate-950 to-slate-900 relative">
        {/* Header */}
        <div className="bg-gradient-to-r from-slate-900/95 to-slate-800/95 backdrop-blur-sm border-b border-slate-700/50 px-6 py-4 shadow-lg">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-xl font-bold bg-gradient-to-r from-white to-slate-200 bg-clip-text text-transparent">
                {notebook?.title}
              </h1>
              <p className="text-sm text-slate-400 mt-1 flex items-center">
                <FileText className="w-4 h-4 mr-1" />
                {documents.length} document{documents.length !== 1 ? 's' : ''} • Interactive Learning
              </p>
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
        </div>

        {/* Chat Messages Area */}
        <div className="flex-1 overflow-y-auto scrollbar-hide p-6 pb-32 space-y-6 bg-gradient-to-b from-transparent via-slate-950/10 to-transparent">
          <AnimatePresence>
            {messages.map((message) => (
              <motion.div
                key={message.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
              >
                <div className={`max-w-3xl p-5 rounded-2xl shadow-lg ${
                  message.role === 'user' 
                    ? 'bg-gradient-to-r from-blue-600 via-blue-500 to-indigo-600 text-white shadow-blue-500/25 backdrop-blur-sm' 
                    : 'bg-gradient-to-br from-slate-800/90 to-slate-700/90 border border-slate-600/50 text-slate-100 backdrop-blur-sm shadow-slate-900/50'
                }`}>
                  <p className="whitespace-pre-wrap text-sm leading-relaxed font-medium tracking-wide">
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
              <div className="bg-gradient-to-br from-slate-800/90 to-slate-700/90 border border-slate-600/50 text-slate-100 max-w-3xl p-5 rounded-2xl backdrop-blur-sm shadow-slate-900/50">
                <div className="flex items-center space-x-2">
                  <motion.div
                    animate={{ scale: [1, 1.2, 1] }}
                    transition={{ duration: 1, repeat: Infinity }}
                    className="w-2 h-2 bg-slate-400 rounded-full"
                  />
                  <motion.div
                    animate={{ scale: [1, 1.2, 1] }}
                    transition={{ duration: 1, repeat: Infinity, delay: 0.2 }}
                    className="w-2 h-2 bg-slate-400 rounded-full"
                  />
                  <motion.div
                    animate={{ scale: [1, 1.2, 1] }}
                    transition={{ duration: 1, repeat: Infinity, delay: 0.4 }}
                    className="w-2 h-2 bg-slate-400 rounded-full"
                  />
                  <span className="ml-2 text-sm text-slate-400">AI is thinking...</span>
                </div>
              </div>
            </motion.div>
          )}
          
          {/* Invisible element to scroll to */}
          <div ref={messagesEndRef} />
        </div>

              {/* Input Area */}
              <div className="absolute bottom-6 left-6 right-6 pointer-events-none">
                <div className="max-w-3xl mx-auto pointer-events-auto">
                  {selectedDocuments.length > 0 && messages.length === 0 && (
                    <div className="mb-6">
                      <p className="text-sm text-slate-800 mb-3 text-center">Try asking:</p>
                      <div className="flex flex-wrap gap-2 justify-center">
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
                  
                  <div className="flex items-center space-x-3 bg-gray-900 backdrop-blur-lg border border-slate-600/40 rounded-2xl p-3 shadow-xl">
                    <input
                      type="text"
                      value={newMessage}
                      onChange={(e) => setNewMessage(e.target.value)}
                      onKeyPress={(e) => e.key === 'Enter' && sendMessage()}
                      placeholder="Ask a question about your documents..."
                      className="flex-1 px-5 py-4 bg-transparent text-white placeholder-slate-400 focus:outline-none text-base font-medium tracking-wide leading-relaxed"
                      disabled={isSending}
                    />
                    <motion.button
                      whileHover={{ scale: 1.05 }}
                      whileTap={{ scale: 0.95 }}
                      onClick={sendMessage}
                      disabled={!newMessage.trim() || isSending}
                      className="p-3 bg-gradient-to-r from-blue-500 to-indigo-600 text-white rounded-xl hover:shadow-lg hover:shadow-blue-500/25 disabled:opacity-50 disabled:cursor-not-allowed flex items-center transition-all duration-200"
                    >
                      <Send className="w-4 h-4" />
                    </motion.button>
                  </div>
                </div>
                {selectedDocuments.length > 0 && (
                  <div className="mt-4 flex flex-wrap gap-2 justify-center">
                    {selectedDocuments.map((docId) => {
                      const doc = documents.find(d => d.id === docId);
                      return doc ? (
                        <span
                          key={docId}
                          className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-blue-500/20 text-blue-300 border border-blue-500/30"
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

      {/* Right Sidebar - Tools */}
      <div className="w-80 bg-gradient-to-b from-slate-900/95 to-slate-800/95 backdrop-blur-sm border-l border-slate-700/50 flex flex-col h-full shadow-xl">
        {/* Navbar Section */}
        <div className="p-6 border-b border-slate-700/50 bg-gradient-to-r from-slate-800/50 to-slate-900/50">
          <h3 className="text-lg font-bold bg-gradient-to-r from-white to-slate-200 bg-clip-text text-transparent mb-6">Studio</h3>
          
          {/* Tab Navigation for Right Sidebar */}
          <div className="flex justify-between px-2">
            <TabButton 
              icon={BookOpen} 
              label="Quiz" 
              active={activeTab === 'quiz'} 
              onClick={() => setActiveTab('quiz')}
            />
            <TabButton 
              icon={BarChart3} 
              label="Progress" 
              active={activeTab === 'progress'} 
              onClick={() => setActiveTab('progress')}
            />
            <TabButton 
              icon={Play} 
              label="Videos" 
              active={activeTab === 'videos'} 
              onClick={() => setActiveTab('videos')}
            />
          </div>
        </div>
        
        {/* Tab Content Section */}
        <div className="flex-1 overflow-y-auto scrollbar-hide">
          <div className="p-4">

          {activeTab === 'quiz' && (
            <div className="space-y-4">
              {/* Quiz Type Selection */}
              <div>
                <h4 className="text-sm font-medium text-slate-300 mb-3">Question Type</h4>
                <div className="flex space-x-2">
                  {(['MCQ', 'SAQ', 'LAQ'] as const).map((type) => (
                    <button
                      key={type}
                      onClick={() => setSelectedQuizType(type)}
                      className={`px-3 py-1 text-xs rounded-full transition-colors ${
                        selectedQuizType === type
                          ? 'bg-blue-600 text-white'
                          : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                      }`}
                    >
                      {type}
                    </button>
                  ))}
                </div>
              </div>

              {/* Generate Quiz Button */}
              <motion.button
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                onClick={() => generateQuizWithType(selectedQuizType)}
                disabled={selectedDocuments.length === 0 || isGeneratingQuiz}
                className="w-full px-4 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center"
              >
                {isGeneratingQuiz ? (
                  <>
                    <Clock className="w-4 h-4 mr-2 animate-spin" />
                    Generating...
                  </>
                ) : (
                  <>
                    <BookOpen className="w-4 h-4 mr-2" />
                    Generate {selectedQuizType} Quiz
                  </>
                )}
              </motion.button>

              {selectedDocuments.length === 0 && (
                <p className="text-xs text-slate-400 text-center">
                  Select documents to generate quiz
                </p>
              )}

              {/* Quiz Questions Display */}
              {quizQuestions.length > 0 && (
                <div className="space-y-4 max-h-96 overflow-y-auto scrollbar-hide">
                  <div className="flex items-center justify-between">
                    <h4 className="text-sm font-medium text-slate-300">
                      Generated Questions ({quizQuestions.length})
                    </h4>
                    <div className="text-xs text-slate-400">
                      {quizScore.correct}/{quizScore.total}
                    </div>
                  </div>
                  {quizQuestions.slice(0, 5).map((question, index) => (
                    <div
                      key={question.id}
                      className="p-3 bg-slate-800 rounded-lg border border-slate-600"
                    >
                      <div className="flex items-start justify-between mb-2">
                        <p className="text-sm font-medium text-white flex-1">
                          Q{index + 1}: {question.question}
                        </p>
                        {showResults && quizResults && quizResults[question.id] && (
                          <div className="ml-2 flex-shrink-0">
                            {quizResults[question.id].isCorrect ? (
                              <CheckCircle className="w-4 h-4 text-green-400" />
                            ) : (
                              <XCircle className="w-4 h-4 text-red-400" />
                            )}
                          </div>
                        )}
                      </div>
                      
                      {question.type === 'mcq' && question.options && (
                        <div className="space-y-1">
                          {question.options.map((option, optIndex) => {
                            const isSelected = userAnswers[question.id] === option;
                            const isCorrect = question.correct_answer === option;
                            const showResult = showResults && quizResults;
                            
                            let buttonClass = 'w-full text-left text-xs p-2 rounded transition-colors ';
                            
                            if (showResult) {
                              if (isCorrect) {
                                buttonClass += 'bg-green-600 text-white ';
                              } else if (isSelected && !isCorrect) {
                                buttonClass += 'bg-red-600 text-white ';
                              } else {
                                buttonClass += 'bg-slate-700 text-slate-300 ';
                              }
                            } else {
                              buttonClass += isSelected
                                ? 'bg-blue-600 text-white'
                                : 'bg-slate-700 text-slate-300 hover:bg-slate-600';
                            }
                            
                            return (
                              <button
                                key={optIndex}
                                onClick={() => !showResults && handleAnswer(question.id, option)}
                                disabled={showResults}
                                className={buttonClass}
                              >
                                {String.fromCharCode(65 + optIndex)}. {option}
                              </button>
                            );
                          })}
                        </div>
                      )}
                      
                      {(question.type === 'saq' || question.type === 'laq') && (
                        <div className="space-y-2">
                          <textarea
                            placeholder="Your answer..."
                            value={userAnswers[question.id] || ''}
                            onChange={(e) => handleAnswer(question.id, e.target.value)}
                            disabled={showResults}
                            className={`w-full p-2 border rounded text-xs ${
                              showResults
                                ? 'bg-slate-700 border-slate-600 text-slate-300 cursor-not-allowed'
                                : 'bg-slate-700 border-slate-600 text-white placeholder-slate-400'
                            }`}
                            rows={question.type === 'laq' ? 4 : 2}
                          />
                          {showResults && quizResults && quizResults[question.id] && (
                            <div className="text-xs">
                              <div className="font-medium text-green-400 mb-1">Correct Answer:</div>
                              <div className="text-slate-300 bg-slate-700 p-2 rounded border">
                                {question.correct_answer}
                              </div>
                            </div>
                          )}
                        </div>
                      )}
                      
                      {showResults && quizResults && quizResults[question.id] && (
                        <div className="mt-3 p-2 bg-slate-700 rounded border border-slate-600">
                          <div className="text-xs font-medium text-blue-400 mb-1">Explanation:</div>
                          <div className="text-xs text-slate-300">
                            {quizResults[question.id].explanation}
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                  
                  {/* Submit Button */}
                  {!showResults && Object.keys(userAnswers).length > 0 && (
                    <div className="mt-4 flex justify-center">
                      <button
                        onClick={submitQuiz}
                        disabled={isSubmittingQuiz}
                        className={`px-6 py-2 rounded-lg font-medium text-sm transition-colors ${
                          isSubmittingQuiz
                            ? 'bg-slate-600 text-slate-400 cursor-not-allowed'
                            : 'bg-blue-600 hover:bg-blue-700 text-white'
                        }`}
                      >
                        {isSubmittingQuiz ? 'Submitting...' : 'Submit Quiz'}
                      </button>
                    </div>
                  )}
                  
                  {/* Results Summary */}
                  {showResults && quizResults && (
                    <div className="mt-4 p-4 bg-slate-800 rounded-lg border border-slate-600">
                      <h4 className="text-sm font-medium text-white mb-2">Quiz Results</h4>
                      <div className="text-xs text-slate-300">
                        Score: {Object.values(quizResults).filter(r => r.isCorrect).length} / {Object.keys(quizResults).length}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {activeTab === 'progress' && (
            <div className="space-y-4">
              {isLoadingProgress ? (
                <div className="text-center py-8">
                  <div className="animate-spin w-8 h-8 border-2 border-blue-400 border-t-transparent rounded-full mx-auto mb-2"></div>
                  <p className="text-sm text-slate-400">Loading progress...</p>
                </div>
              ) : (
                <>
                  {/* Statistics Grid */}
                  <div className="grid grid-cols-1 gap-4">
                    <div className="bg-slate-800 border border-slate-600 rounded-lg p-4">
                      <BarChart3 className="w-6 h-6 text-blue-400 mb-2" />
                      <h4 className="text-sm font-medium text-white mb-1">Average Score</h4>
                      <p className="text-2xl font-bold text-blue-400 mb-1">
                        {progressData?.statistics?.averageScore || 0}%
                      </p>
                      <p className="text-xs text-slate-400">
                        {progressData?.statistics?.totalAttempts || 0} quiz attempts
                      </p>
                    </div>
                    
                    <div className="bg-slate-800 border border-slate-600 rounded-lg p-4">
                      <MessageSquare className="w-6 h-6 text-green-400 mb-2" />
                      <h4 className="text-sm font-medium text-white mb-1">Chat Activity</h4>
                      <p className="text-2xl font-bold text-green-400 mb-1">{messages.length}</p>
                      <p className="text-xs text-slate-400">Messages exchanged</p>
                    </div>
                    
                    <div className="bg-slate-800 border border-slate-600 rounded-lg p-4">
                      <FileText className="w-6 h-6 text-purple-400 mb-2" />
                      <h4 className="text-sm font-medium text-white mb-1">Total Questions</h4>
                      <p className="text-2xl font-bold text-purple-400 mb-1">
                        {progressData?.statistics?.totalCorrectAnswers || 0}/{progressData?.statistics?.totalQuestions || 0}
                      </p>
                      <p className="text-xs text-slate-400">Correct answers</p>
                    </div>
                  </div>

                  {/* Quiz Type Breakdown */}
                  {progressData?.statistics?.quizTypeBreakdown && Object.keys(progressData.statistics.quizTypeBreakdown).length > 0 && (
                    <div className="bg-slate-800 border border-slate-600 rounded-lg p-4">
                      <h4 className="text-sm font-medium text-white mb-3">Quiz Types</h4>
                      <div className="space-y-2">
                        {Object.entries(progressData.statistics.quizTypeBreakdown).map(([type, count]) => (
                          <div key={type} className="flex justify-between items-center">
                            <span className="text-xs text-slate-300 capitalize">
                              {type === 'mcq' ? 'Multiple Choice' : type === 'saq' ? 'Short Answer' : 'Long Answer'}
                            </span>
                            <span className="text-xs font-medium text-white">{count}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Recent Activity */}
                  {progressData?.attempts && progressData.attempts.length > 0 && (
                    <div className="bg-slate-800 border border-slate-600 rounded-lg p-4">
                      <h4 className="text-sm font-medium text-white mb-3">Recent Quiz Attempts</h4>
                      <div className="space-y-2 max-h-60 overflow-y-auto">
                        {progressData.attempts.slice(0, 10).map((attempt) => (
                          <div key={attempt.id} className="flex justify-between items-center p-2 bg-slate-700 rounded">
                            <div>
                              <p className="text-xs font-medium text-white">{attempt.quiz_topic}</p>
                              <p className="text-xs text-slate-400">
                                {new Date(attempt.created_at).toLocaleDateString()} • {attempt.quiz_type.toUpperCase()}
                              </p>
                            </div>
                            <div className="text-right">
                              <p className="text-xs font-medium text-white">{attempt.score}%</p>
                              <p className="text-xs text-slate-400">
                                {attempt.correct_answers}/{attempt.total_questions}
                              </p>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* No data message */}
                  {(!progressData || progressData.attempts.length === 0) && (
                    <div className="text-center py-8">
                      <BarChart3 className="w-12 h-12 text-slate-400 mb-4 mx-auto" />
                      <h4 className="text-lg font-semibold text-white mb-2">No Quiz History</h4>
                      <p className="text-sm text-slate-400 mb-4">
                        Complete some quizzes to see your progress here.
                      </p>
                    </div>
                  )}
                </>
              )}
            </div>
          )}

          {activeTab === 'videos' && (
            <div className="space-y-4">
              <div className="text-center py-8">
                <Play className="w-12 h-12 text-slate-400 mb-4 mx-auto" />
                <h4 className="text-lg font-semibold text-white mb-2">Video Recommendations</h4>
                <p className="text-sm text-slate-400 mb-4">
                  Coming soon! YouTube suggestions based on your content.
                </p>
              </div>
              
              <div className="bg-slate-800 border border-slate-600 rounded-lg p-4">
                <h4 className="text-sm font-medium text-white mb-3">Planned Features</h4>
                <div className="space-y-2">
                  <div className="flex items-center p-2 bg-slate-700 rounded">
                    <Play className="w-4 h-4 text-blue-400 mr-2" />
                    <span className="text-xs text-slate-300">Topic-based recommendations</span>
                  </div>
                  <div className="flex items-center p-2 bg-slate-700 rounded">
                    <Clock className="w-4 h-4 text-green-400 mr-2" />
                    <span className="text-xs text-slate-300">Duration filtering</span>
                  </div>
                  <div className="flex items-center p-2 bg-slate-700 rounded">
                    <BarChart3 className="w-4 h-4 text-purple-400 mr-2" />
                    <span className="text-xs text-slate-300">Difficulty matching</span>
                  </div>
                </div>
              </div>
            </div>
          )}
          </div>
        </div>
      </div>
    </div>
  );
}