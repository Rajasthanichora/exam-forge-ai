export type Difficulty = 'easy' | 'medium' | 'hard';
export type Language = 'english' | 'hindi' | 'hinglish';

export interface Question {
  id: string;
  question: string;
  options: string[];
  correctAnswer: number;
  explanation?: string;
  difficulty: Difficulty;
  topic?: string;
}

export interface TestConfig {
  studyNotes: string;
  difficulty: Difficulty;
  questionCount: number;
  language: Language;
  customPrompt: string;
  oneLinerMode?: boolean;
  aiModel?: string;
  sectionId?: string;
  sectionName?: string;
}

export interface TestResult {
  id: string;
  name: string;
  date: string;
  config: TestConfig;
  questions: Question[];
  answers: Record<string, number>;
  score: number;
  totalQuestions: number;
  timeTaken?: number;
  scoreReport?: string;
}

export interface StoredQuestion {
  questionHash: string;
  questionText: string;
  topic?: string;
  dateUsed: string;
  testId?: string;
}

export interface SavedDocument {
  id: string;
  name: string;
  content: string;
  size: number;
  uploadedAt: string;
}

export interface Group {
  id: string;
  name: string;
  createdAt: string;
}

export interface Section {
  id: string;
  name: string;
  createdAt: string;
  groupId?: string;
  savedDocuments: SavedDocument[];
  storedQuestions: StoredQuestion[];
  testResults: TestResult[];
  pastedNotes?: string;
}

export interface AppData {
  groups: Group[];
  sections: Section[];
  apiKey: string;
  geminiApiKey: string;
  aiProvider: 'openrouter' | 'gemini' | 'mistral';
  activeSectionId: string | null;
}

export interface SimilarityReport {
  totalNewQuestions: number;
  similarQuestions: number;
  uniqueQuestions: number;
  similarityPercentage: number;
  flaggedQuestions: Array<{
    newQuestion: string;
    similarTo: string;
    similarity: number;
  }>;
}

export interface UploadedFile {
  name: string;
  content: string;
  size: number;
}

export interface WorkingModel {
  provider: 'openrouter' | 'gemini' | 'mistral';
  model: string;
  label: string;
  working: boolean;
  lastTested: string;
}

export interface ConversationMessage {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: string;
  testContext?: {
    sectionId: string;
    sectionName: string;
    testId: string;
    testName: string;
  };
}

export interface Conversation {
  id: string;
  title: string;
  createdAt: string;
  updatedAt: string;
  messages: ConversationMessage[];
  activeTestContext?: {
    sectionId: string;
    sectionName: string;
    testId: string;
    testName: string;
  } | null;
}
