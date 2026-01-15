export interface QuizOption {
  key: string; // e.g., "A", "B", "C", "D"
  text: string; // The content of the option
}

export interface Question {
  id: number;
  text: string;
  options: QuizOption[];
  correctAnswers: string[]; // Array of correct keys (e.g., ["A"] or ["A", "B"])
  explanation?: string; // General explanation
  optionExplanations?: { [key: string]: string }; // Specific explanation for each option
}

export interface QuizData {
  title: string;
  questions: Question[];
  timeLimit?: number; // Time limit in seconds
  isExamMode?: boolean; // true = hide results until finish, false = instant feedback
}

export enum AppState {
  UPLOAD = 'UPLOAD',
  PROCESSING = 'PROCESSING',
  CONFIG = 'CONFIG',
  QUIZ = 'QUIZ',
  RESULTS = 'RESULTS',
  HISTORY = 'HISTORY'
}

export interface UserAnswers {
  [questionId: number]: string[]; // questionId -> array of selectedKeys
}

export interface QuizHistoryItem {
  id: string;
  timestamp: number;
  title: string;
  score: number;
  totalQuestions: number;
  correctCount: number;
  timeSpent: number;
  quizData: QuizData;
  userAnswers: UserAnswers;
}