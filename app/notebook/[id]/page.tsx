'use client';

import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/app/lib/supabase';
import { motion, AnimatePresence } from 'framer-motion';
import { Send, FileText, ChevronLeft, Menu, MessageSquare, BookOpen, BarChart3, Play, Download, Share, Settings, CheckCircle, XCircle, Clock, ArrowRight } from 'lucide-react';
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

interface QuizQuestion {
  id: string;
  type: 'mcq' | 'saq' | 'laq';
  question: string;
  options?: string[];
  correct_answer: string;
  explanation: string;
  difficulty: 'easy' | 'medium' | 'hard';
}

// Tab Button Component
const TabButton = ({ icon: Icon, label, active, onClick }: { 
  icon: React.ComponentType<{ className?: string }>, 
  label: string, 
  active: boolean,
  onClick?: () => void
}) => (
  <motion.button
    whileHover={{ scale: 1.02 }}
    whileTap={{ scale: 0.98 }}
    onClick={onClick}
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

// Quiz Question Component
const QuizQuestionCard = ({ question, onAnswer, userAnswer, showResult }: {
  question: QuizQuestion;
  onAnswer: (answer: string) => void;
  userAnswer?: string;
  showResult?: boolean;
}) => {
  const isCorrect = userAnswer === question.correct_answer;
  
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-slate-800 border border-slate-600 rounded-lg p-6 mb-6"
    >
      <div className="flex items-center justify-between mb-4">
        <span className={`px-3 py-1 rounded-full text-xs font-medium ${
          question.type === 'mcq' ? 'bg-blue-100 text-blue-800' :
          question.type === 'saq' ? 'bg-green-100 text-green-800' :
          'bg-purple-100 text-purple-800'
        }`}>
          {question.type.toUpperCase()}
        </span>
        <span className={`px-2 py-1 rounded text-xs ${
          question.difficulty === 'easy' ? 'bg-green-700 text-green-100' :
          question.difficulty === 'medium' ? 'bg-yellow-700 text-yellow-100' :
          'bg-red-700 text-red-100'
        }`}>
          {question.difficulty}
        </span>
      </div>
      
      <h3 className="text-lg font-medium text-white mb-4">{question.question}</h3>
      
      {question.type === 'mcq' && question.options && (
        <div className="space-y-3">
          {question.options.map((option, index) => (
            <button
              key={index}
              onClick={() => !showResult && onAnswer(option)}
              disabled={showResult}
              className={`w-full p-3 rounded-lg border text-left transition-colors ${
                showResult 
                  ? option === question.correct_answer
                    ? 'border-green-400 bg-green-900/30 text-green-200'
                    : option === userAnswer
                    ? 'border-red-400 bg-red-900/30 text-red-200'
                    : 'border-slate-600 bg-slate-700 text-slate-300'
                  : userAnswer === option
                  ? 'border-blue-400 bg-blue-900/30 text-blue-200'
                  : 'border-slate-600 bg-slate-700 text-slate-300 hover:bg-slate-600'
              }`}
            >
              <div className="flex items-center">
                <span className="w-6 h-6 rounded-full bg-slate-600 flex items-center justify-center text-xs mr-3">
                  {String.fromCharCode(65 + index)}
                </span>
                {option}
                {showResult && option === question.correct_answer && (
                  <CheckCircle className="w-5 h-5 text-green-400 ml-auto" />
                )}
                {showResult && option === userAnswer && option !== question.correct_answer && (
                  <XCircle className="w-5 h-5 text-red-400 ml-auto" />
                )}
              </div>
            </button>
          ))}
        </div>
      )}
      
      {(question.type === 'saq' || question.type === 'laq') && (
        <textarea
          placeholder="Type your answer here..."
          onChange={(e) => onAnswer(e.target.value)}
          className="w-full p-3 bg-slate-700 border border-slate-600 rounded-lg text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 min-h-[100px]"
          disabled={showResult}
          value={userAnswer || ''}
        />
      )}
      
      {showResult && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="mt-4 p-4 bg-slate-900 rounded-lg border border-slate-600"
        >
          <div className="flex items-center mb-2">
            {isCorrect ? (
              <CheckCircle className="w-5 h-5 text-green-400 mr-2" />
            ) : (
              <XCircle className="w-5 h-5 text-red-400 mr-2" />
            )}
            <span className={`font-medium ${isCorrect ? 'text-green-400' : 'text-red-400'}`}>
              {isCorrect ? 'Correct!' : 'Incorrect'}
            </span>
          </div>
          <p className="text-slate-300 text-sm">{question.explanation}</p>
          {!isCorrect && question.type !== 'mcq' && (
            <div className="mt-2 p-2 bg-green-900/20 border border-green-700 rounded">
              <p className="text-sm text-green-300">
                <strong>Correct Answer:</strong> {question.correct_answer}
              </p>
            </div>
          )}
        </motion.div>
      )}
    </motion.div>
  );
};

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
  const [activeTab, setActiveTab] = useState<'chat' | 'quiz' | 'progress' | 'videos'>('chat');
  
  // Quiz state
  const [quizQuestions, setQuizQuestions] = useState<QuizQuestion[]>([]);

  const [userAnswers, setUserAnswers] = useState<{[key: string]: string}>({});
  const [showResults, setShowResults] = useState<{[key: string]: boolean}>({});
  const [isGeneratingQuiz, setIsGeneratingQuiz] = useState(false);
  const [quizScore, setQuizScore] = useState({ correct: 0, total: 0 });

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

  const generateQuiz = async () => {
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
          types: ['mcq', 'saq', 'laq']
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
        setShowResults({});
        setQuizScore({ correct: 0, total: 0 });
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

  const submitAnswer = (questionId: string) => {
    setShowResults(prev => ({ ...prev, [questionId]: true }));
    
    const question = quizQuestions.find(q => q.id === questionId);
    if (question && userAnswers[questionId] === question.correct_answer) {
      setQuizScore(prev => ({ ...prev, correct: prev.correct + 1, total: prev.total + 1 }));
    } else {
      setQuizScore(prev => ({ ...prev, total: prev.total + 1 }));
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
              <TabButton 
                icon={MessageSquare} 
                label="Chat" 
                active={activeTab === 'chat'} 
                onClick={() => setActiveTab('chat')}
              />
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
        </div>

        {/* Content Area */}
        <div className="flex-1 overflow-hidden">
          {activeTab === 'chat' && (
            <div className="h-full flex flex-col">
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

              {/* Input Area */}
              <div className="bg-slate-900 border-t border-slate-700 p-6">
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
          )}

          {activeTab === 'quiz' && (
            <div className="h-full overflow-y-auto p-6">
              {quizQuestions.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full text-center">
                  <BookOpen className="w-16 h-16 text-slate-400 mb-4" />
                  <h2 className="text-2xl font-semibold text-white mb-2">Generate Quiz</h2>
                  <p className="text-slate-400 mb-6 max-w-md">
                    Select documents from the sidebar and generate quiz questions to test your knowledge.
                  </p>
                  <motion.button
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    onClick={generateQuiz}
                    disabled={selectedDocuments.length === 0 || isGeneratingQuiz}
                    className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center"
                  >
                    {isGeneratingQuiz ? (
                      <>
                        <Clock className="w-4 h-4 mr-2 animate-spin" />
                        Generating...
                      </>
                    ) : (
                      <>
                        <BookOpen className="w-4 h-4 mr-2" />
                        Generate Quiz
                      </>
                    )}
                  </motion.button>
                  {selectedDocuments.length === 0 && (
                    <p className="text-xs text-slate-500 mt-3">
                      Please select at least one document to generate quiz questions.
                    </p>
                  )}
                </div>
              ) : (
                <div className="max-w-4xl mx-auto">
                  <div className="flex items-center justify-between mb-6">
                    <h2 className="text-2xl font-semibold text-white">Quiz Questions</h2>
                    <div className="flex items-center space-x-4">
                      <div className="text-sm text-slate-400">
                        Score: {quizScore.correct}/{quizScore.total}
                      </div>
                      <motion.button
                        whileHover={{ scale: 1.05 }}
                        onClick={generateQuiz}
                        disabled={isGeneratingQuiz}
                        className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm"
                      >
                        Generate New Quiz
                      </motion.button>
                    </div>
                  </div>
                  
                  <div className="space-y-6">
                    {quizQuestions.map((question) => (
                      <QuizQuestionCard
                        key={question.id}
                        question={question}
                        onAnswer={(answer) => handleAnswer(question.id, answer)}
                        userAnswer={userAnswers[question.id]}
                        showResult={showResults[question.id]}
                      />
                    ))}
                  </div>
                  
                  {Object.keys(userAnswers).length > 0 && (
                    <div className="mt-6 flex justify-center">
                      <motion.button
                        whileHover={{ scale: 1.05 }}
                        onClick={() => {
                          quizQuestions.forEach(q => {
                            if (userAnswers[q.id] && !showResults[q.id]) {
                              submitAnswer(q.id);
                            }
                          });
                        }}
                        className="px-6 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 flex items-center"
                      >
                        Submit All Answers
                        <ArrowRight className="w-4 h-4 ml-2" />
                      </motion.button>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {activeTab === 'progress' && (
            <div className="h-full overflow-y-auto p-6">
              <div className="max-w-4xl mx-auto">
                <h2 className="text-2xl font-semibold text-white mb-6">Learning Progress</h2>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  <div className="bg-slate-800 border border-slate-600 rounded-lg p-6">
                    <BarChart3 className="w-8 h-8 text-blue-400 mb-4" />
                    <h3 className="text-lg font-medium text-white mb-2">Quiz Performance</h3>
                    <p className="text-3xl font-bold text-blue-400 mb-2">
                      {quizScore.total > 0 ? Math.round((quizScore.correct / quizScore.total) * 100) : 0}%
                    </p>
                    <p className="text-sm text-slate-400">
                      {quizScore.correct} correct out of {quizScore.total} questions
                    </p>
                  </div>
                  
                  <div className="bg-slate-800 border border-slate-600 rounded-lg p-6">
                    <MessageSquare className="w-8 h-8 text-green-400 mb-4" />
                    <h3 className="text-lg font-medium text-white mb-2">Chat Sessions</h3>
                    <p className="text-3xl font-bold text-green-400 mb-2">{messages.length}</p>
                    <p className="text-sm text-slate-400">Total messages exchanged</p>
                  </div>
                  
                  <div className="bg-slate-800 border border-slate-600 rounded-lg p-6">
                    <FileText className="w-8 h-8 text-purple-400 mb-4" />
                    <h3 className="text-lg font-medium text-white mb-2">Documents</h3>
                    <p className="text-3xl font-bold text-purple-400 mb-2">{documents.length}</p>
                    <p className="text-sm text-slate-400">Available for study</p>
                  </div>
                </div>
                
                <div className="mt-8 bg-slate-800 border border-slate-600 rounded-lg p-6">
                  <h3 className="text-lg font-medium text-white mb-4">Study Recommendations</h3>
                  <div className="space-y-3">
                    <div className="flex items-center p-3 bg-slate-700 rounded-lg">
                      <BookOpen className="w-5 h-5 text-blue-400 mr-3" />
                      <span className="text-slate-300">Review challenging quiz topics</span>
                    </div>
                    <div className="flex items-center p-3 bg-slate-700 rounded-lg">
                      <MessageSquare className="w-5 h-5 text-green-400 mr-3" />
                      <span className="text-slate-300">Ask more detailed questions about difficult concepts</span>
                    </div>
                    <div className="flex items-center p-3 bg-slate-700 rounded-lg">
                      <Play className="w-5 h-5 text-purple-400 mr-3" />
                      <span className="text-slate-300">Watch recommended videos for additional context</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'videos' && (
            <div className="h-full overflow-y-auto p-6">
              <div className="max-w-4xl mx-auto text-center">
                <Play className="w-16 h-16 text-slate-400 mb-4 mx-auto" />
                <h2 className="text-2xl font-semibold text-white mb-2">Video Recommendations</h2>
                <p className="text-slate-400 mb-6">
                  Coming soon! YouTube video suggestions based on your document content.
                </p>
                <div className="bg-slate-800 border border-slate-600 rounded-lg p-6">
                  <h3 className="text-lg font-medium text-white mb-4">Planned Features</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-left">
                    <div className="flex items-center p-3 bg-slate-700 rounded-lg">
                      <Play className="w-5 h-5 text-blue-400 mr-3" />
                      <span className="text-slate-300">Topic-based video recommendations</span>
                    </div>
                    <div className="flex items-center p-3 bg-slate-700 rounded-lg">
                      <Clock className="w-5 h-5 text-green-400 mr-3" />
                      <span className="text-slate-300">Duration-filtered content</span>
                    </div>
                    <div className="flex items-center p-3 bg-slate-700 rounded-lg">
                      <BarChart3 className="w-5 h-5 text-purple-400 mr-3" />
                      <span className="text-slate-300">Difficulty level matching</span>
                    </div>
                    <div className="flex items-center p-3 bg-slate-700 rounded-lg">
                      <BookOpen className="w-5 h-5 text-orange-400 mr-3" />
                      <span className="text-slate-300">Educational channel curation</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}