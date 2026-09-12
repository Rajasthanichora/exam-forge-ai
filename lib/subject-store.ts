import { getItem, setItem, removeItem } from './storage';

const SUBJECTS_KEY = 'examforge_subjects';
const SUBJECT_N8N_KEY = 'examforge_subject_n8n';

export interface Subject {
  id: string;
  name: string;
  color: string;
  icon: string;
  createdAt: string;
}

export interface SubjectN8nConfig {
  webhookUrl: string;
  params: any[];
}

const SUBJECT_COLORS = ['#EF4444', '#8B5CF6', '#06B6D4', '#EC4899', '#14B8A6', '#F97316', '#6366F1', '#84CC16'];
const SUBJECT_ICONS = ['book', 'calculator', 'flask', 'musical-notes', 'globe', 'medical', 'code-slash', 'fitness'];

function generateId(): string {
  return 'sub_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 6);
}

// ─── Subject Registry ───

export async function registerSubject(name: string): Promise<Subject> {
  const existing = await getAllSubjects();
  const subject: Subject = {
    id: generateId(),
    name: name.trim(),
    color: SUBJECT_COLORS[existing.length % SUBJECT_COLORS.length],
    icon: SUBJECT_ICONS[existing.length % SUBJECT_ICONS.length],
    createdAt: new Date().toISOString(),
  };
  existing.push(subject);
  await setItem(SUBJECTS_KEY, JSON.stringify(existing));
  // Initialize empty n8n config for new subject
  await setSubjectN8nConfig(subject.id, { webhookUrl: '', params: [] });
  return subject;
}

export async function unregisterSubject(subjectId: string): Promise<void> {
  const all = await getAllSubjects();
  const filtered = all.filter(s => s.id !== subjectId);
  await setItem(SUBJECTS_KEY, JSON.stringify(filtered));
  await removeItem(`${SUBJECT_N8N_KEY}_${subjectId}`);
}

export async function getAllSubjects(): Promise<Subject[]> {
  const json = await getItem(SUBJECTS_KEY);
  if (!json) return [];
  try { return JSON.parse(json); } catch { return []; }
}

export async function getSubjectById(id: string): Promise<Subject | null> {
  const all = await getAllSubjects();
  return all.find(s => s.id === id) || null;
}

// ─── Per-subject n8n config ───

export async function getSubjectN8nConfig(subjectId: string): Promise<SubjectN8nConfig> {
  const json = await getItem(`${SUBJECT_N8N_KEY}_${subjectId}`);
  if (!json) return { webhookUrl: '', params: [] };
  try { return JSON.parse(json); } catch { return { webhookUrl: '', params: [] }; }
}

export async function setSubjectN8nConfig(subjectId: string, config: SubjectN8nConfig): Promise<void> {
  await setItem(`${SUBJECT_N8N_KEY}_${subjectId}`, JSON.stringify(config));
}
