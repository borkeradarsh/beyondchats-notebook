export interface PDFDocument {
  id: string;
  name: string;
  content: string;
  uploadedAt: Date;
  pageCount: number;
  size: number;
}

export interface ChatMessage {
  id: string;
  content: string;
  role: 'user' | 'assistant';
  timestamp: Date;
  citations?: Citation[];
}

export interface Citation {
  id: string;
  text: string;
  pageNumber: number;
  confidence: number;
}

export interface Quiz {
  id: string;
  title: string;
  questions: QuizQuestion[];
  createdAt: Date;
  documentId: string;
}

export interface QuizQuestion {
  id: string;
  question: string;
  type: 'multiple-choice' | 'true-false' | 'short-answer';
  options?: string[];
  correctAnswer: string | string[];
  explanation: string;
  pageReference?: number;
}

export interface QuizResult {
  questionId: string;
  userAnswer: string | string[];
  isCorrect: boolean;
  timeSpent: number;
}

export interface AppState {
  documents: PDFDocument[];
  currentDocument: PDFDocument | null;
  chatHistory: ChatMessage[];
  quizzes: Quiz[];
  currentQuiz: Quiz | null;
  isLoading: boolean;
}