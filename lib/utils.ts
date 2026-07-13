import { StoredQuestion } from './types';

export function hashQuestion(question: string): string {
  let hash = 0;
  const str = normalizeText(question);
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  return hash.toString(36);
}

export function normalizeText(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^\w\s]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

export function calculateSimilarity(text1: string, text2: string): number {
  const words1 = new Set(normalizeText(text1).split(' '));
  const words2 = new Set(normalizeText(text2).split(' '));
  const intersection = new Set([...words1].filter(x => words2.has(x)));
  const union = new Set([...words1, ...words2]);
  return union.size > 0 ? intersection.size / union.size : 0;
}

export function checkQuestionSimilarity(
  newQuestion: string,
  storedQuestions: StoredQuestion[],
  threshold: number = 0.6
): { isSimilar: boolean; similarity: number; similarTo?: string } {
  let maxSimilarity = 0;
  let mostSimilar: string | undefined;

  for (const stored of storedQuestions) {
    const similarity = calculateSimilarity(newQuestion, stored.questionText);
    if (similarity > maxSimilarity) {
      maxSimilarity = similarity;
      mostSimilar = stored.questionText;
    }
  }

  return {
    isSimilar: maxSimilarity >= threshold,
    similarity: maxSimilarity,
    similarTo: mostSimilar,
  };
}

export function generateUniqueId(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).substring(2, 11)}`;
}

export function shuffleArray<T>(array: T[]): T[] {
  const shuffled = [...array];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
}

export function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

export function formatTime(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
}

export function shuffleQuestionOptions(question: { options: string[]; correctAnswer: number }): {
  options: string[];
  correctAnswer: number;
} {
  const entries = question.options.map((option, index) => ({ option, originalIndex: index }));
  const shuffled = shuffleArray(entries);
  return {
    options: shuffled.map(e => e.option),
    correctAnswer: shuffled.findIndex(e => e.originalIndex === question.correctAnswer),
  };
}
