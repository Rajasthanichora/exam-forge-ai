import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

// ─── Per-subject MCQ storage (generic, not Electrician-specific) ───

export interface SubjectMCQRow {
  id: number;
  question: string;
  a_hindi: string;
  b_hindi: string;
  c_hindi: string;
  d_hindi: string;
  answer: string;
  e_hindi: string;
  explanation: string;
  question_en: string;
  a_eng: string;
  b_eng: string;
  c_eng: string;
  d_eng: string;
  e_engl: string;
  answer_en: string;
  explaination_en: string;
  index: string;
  n8n_id: number;
  created_at: string;
  updated_at: string;
}

const IS_NATIVE = Platform.OS === 'android' || Platform.OS === 'ios';

// ─── Memory cache for web fallback ───
const memoryCaches: Record<string, SubjectMCQRow[]> = {};

function storageKey(subjectId: string) {
  return `examforge_subject_${subjectId}_mcq_data`;
}

function tagsStorageKey(subjectId: string) {
  return `examforge_subject_${subjectId}_mcq_tags`;
}

async function loadCache(subjectId: string): Promise<SubjectMCQRow[]> {
  if (memoryCaches[subjectId]) return memoryCaches[subjectId];
  try {
    const json = await AsyncStorage.getItem(storageKey(subjectId));
    memoryCaches[subjectId] = json ? JSON.parse(json) : [];
  } catch {
    memoryCaches[subjectId] = [];
  }
  return memoryCaches[subjectId];
}

async function saveCache(subjectId: string, rows: SubjectMCQRow[]): Promise<void> {
  memoryCaches[subjectId] = rows;
  await AsyncStorage.setItem(storageKey(subjectId), JSON.stringify(rows));
}

// ─── Native: lazy-loaded SQLite ───
const nativeDbs: Record<string, any> = {};
const nativeDbReady: Record<string, boolean> = {};

async function getNativeDb(subjectId: string) {
  if (!IS_NATIVE) return null;
  if (nativeDbs[subjectId] && nativeDbReady[subjectId]) return nativeDbs[subjectId];
  try {
    const SQLite = require('expo-sqlite');
    const db = await SQLite.openDatabaseAsync(`subject_${subjectId}.db`);
    await db.execAsync(`
      CREATE TABLE IF NOT EXISTS mcq_questions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        question TEXT NOT NULL DEFAULT '',
        a_hindi TEXT NOT NULL DEFAULT '',
        b_hindi TEXT NOT NULL DEFAULT '',
        c_hindi TEXT NOT NULL DEFAULT '',
        d_hindi TEXT NOT NULL DEFAULT '',
        answer TEXT NOT NULL DEFAULT '',
        e_hindi TEXT NOT NULL DEFAULT '',
        explanation TEXT NOT NULL DEFAULT '',
        question_en TEXT NOT NULL DEFAULT '',
        a_eng TEXT NOT NULL DEFAULT '',
        b_eng TEXT NOT NULL DEFAULT '',
        c_eng TEXT NOT NULL DEFAULT '',
        d_eng TEXT NOT NULL DEFAULT '',
        e_engl TEXT NOT NULL DEFAULT '',
        answer_en TEXT NOT NULL DEFAULT '',
        explaination_en TEXT NOT NULL DEFAULT '',
        "index" TEXT NOT NULL DEFAULT '',
        n8n_id INTEGER,
        created_at TEXT NOT NULL DEFAULT '',
        updated_at TEXT NOT NULL DEFAULT ''
      );
    `);
    nativeDbs[subjectId] = db;
    nativeDbReady[subjectId] = true;
    return db;
  } catch (e) {
    console.warn(`[subject-db] SQLite init failed for ${subjectId}:`, e);
    return null;
  }
}

// ─── Tags helpers (per-subject) ───
async function getNativeTagsDb(subjectId: string) {
  if (!IS_NATIVE) return null;
  const db = await getNativeDb(subjectId);
  if (!db) return null;
  try {
    await db.execAsync(`
      CREATE TABLE IF NOT EXISTS mcq_tags (
        question_id TEXT PRIMARY KEY,
        tags TEXT NOT NULL DEFAULT ''
      );
    `);
  } catch {}
  return db;
}

// ═══════════════════════════════════════════════
//  Public API
// ═══════════════════════════════════════════════

export async function insertSubjectMCQRows(subjectId: string, rows: any[]): Promise<number> {
  const db = await getNativeDb(subjectId);
  if (db) {
    let inserted = 0;
    await db.withExclusiveTransactionAsync(async (txn: any) => {
      for (const row of rows) {
        try {
          await txn.runAsync(
            `INSERT INTO mcq_questions (
              question, a_hindi, b_hindi, c_hindi, d_hindi, answer, e_hindi, explanation,
              question_en, a_eng, b_eng, c_eng, d_eng, e_engl, answer_en, explaination_en,
              "index", n8n_id, created_at, updated_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [
              String(row.question || ''), String(row.a_hindi || ''), String(row.b_hindi || ''),
              String(row.c_hindi || ''), String(row.d_hindi || ''), String(row.answer || ''),
              String(row.e_hindi || ''), String(row.explanation || ''), String(row.question_en || ''),
              String(row.a_eng || ''), String(row.b_eng || ''), String(row.c_eng || ''),
              String(row.d_eng || ''), String(row.e_engl || ''), String(row.answer_en || ''),
              String(row.explaination_en || ''), String(row.index || ''),
              row.id || row.n8n_id || null,
              String(row.createdAt || new Date().toISOString()),
              String(row.updatedAt || new Date().toISOString()),
            ]
          );
          inserted++;
        } catch {}
      }
    });
    return inserted;
  }
  // Web fallback
  const existing = await loadCache(subjectId);
  const normalized = rows.map((r, i) => ({
    id: r.id || r.n8n_id || existing.length + i + 1,
    question: String(r.question || ''),
    a_hindi: String(r.a_hindi || ''), b_hindi: String(r.b_hindi || ''),
    c_hindi: String(r.c_hindi || ''), d_hindi: String(r.d_hindi || ''),
    answer: String(r.answer || ''), e_hindi: String(r.e_hindi || ''),
    explanation: String(r.explanation || ''),
    question_en: String(r.question_en || ''),
    a_eng: String(r.a_eng || ''), b_eng: String(r.b_eng || ''),
    c_eng: String(r.c_eng || ''), d_eng: String(r.d_eng || ''),
    e_engl: String(r.e_engl || ''), answer_en: String(r.answer_en || ''),
    explaination_en: String(r.explaination_en || ''),
    index: String(r.index || ''),
    n8n_id: r.id || r.n8n_id || null,
    created_at: String(r.createdAt || new Date().toISOString()),
    updated_at: String(r.updatedAt || new Date().toISOString()),
  }));
  await saveCache(subjectId, [...existing, ...normalized]);
  return normalized.length;
}

export async function getSubjectMCQCount(subjectId: string): Promise<number> {
  const db = await getNativeDb(subjectId);
  if (db) {
    const r = await db.getFirstAsync('SELECT COUNT(*) as cnt FROM mcq_questions');
    return r?.cnt ?? 0;
  }
  const cache = await loadCache(subjectId);
  return cache.length;
}

export async function getSubjectMCQRows(subjectId: string, offset: number, limit: number): Promise<SubjectMCQRow[]> {
  const db = await getNativeDb(subjectId);
  if (db) {
    return await db.getAllAsync(
      'SELECT * FROM mcq_questions ORDER BY id ASC LIMIT ? OFFSET ?', [limit, offset]
    );
  }
  const cache = await loadCache(subjectId);
  return cache.slice(offset, offset + limit);
}

export async function getSubjectMCQById(subjectId: string, id: number): Promise<SubjectMCQRow | null> {
  const db = await getNativeDb(subjectId);
  if (db) {
    return await db.getFirstAsync('SELECT * FROM mcq_questions WHERE id = ?', [id]);
  }
  const cache = await loadCache(subjectId);
  return cache.find(r => r.id === id) || null;
}

export async function getSubjectMCQByIndex(subjectId: string, indexName: string): Promise<SubjectMCQRow[]> {
  const db = await getNativeDb(subjectId);
  if (db) {
    return await db.getAllAsync(
      'SELECT * FROM mcq_questions WHERE "index" = ? ORDER BY id ASC', [indexName]
    );
  }
  const cache = await loadCache(subjectId);
  return cache.filter(r => r.index === indexName);
}

export async function searchSubjectMCQ(subjectId: string, query: string): Promise<SubjectMCQRow[]> {
  const db = await getNativeDb(subjectId);
  if (db) {
    const like = `%${query}%`;
    return await db.getAllAsync(
      `SELECT * FROM mcq_questions WHERE question LIKE ? OR question_en LIKE ? OR answer LIKE ? OR answer_en LIKE ? ORDER BY id ASC LIMIT 200`,
      [like, like, like, like]
    );
  }
  const cache = await loadCache(subjectId);
  const q = query.toLowerCase();
  return cache.filter(r =>
    r.question.toLowerCase().includes(q) ||
    r.question_en.toLowerCase().includes(q) ||
    r.answer.toLowerCase().includes(q) ||
    r.answer_en.toLowerCase().includes(q)
  ).slice(0, 200);
}

export async function clearSubjectMCQTable(subjectId: string): Promise<void> {
  const db = await getNativeDb(subjectId);
  if (db) {
    await db.execAsync('DELETE FROM mcq_questions');
    return;
  }
  memoryCaches[subjectId] = [];
  await AsyncStorage.removeItem(storageKey(subjectId));
}

export async function getSubjectTopicCounts(subjectId: string): Promise<{ name: string; count: number }[]> {
  const db = await getNativeDb(subjectId);
  if (db) {
    return await db.getAllAsync(
      'SELECT "index" as name, COUNT(*) as count FROM mcq_questions WHERE "index" != "" GROUP BY "index" ORDER BY "index" ASC'
    );
  }
  const cache = await loadCache(subjectId);
  const map = new Map<string, number>();
  for (const r of cache) {
    if (r.index) map.set(r.index, (map.get(r.index) || 0) + 1);
  }
  return Array.from(map.entries()).map(([name, count]) => ({ name, count })).sort((a, b) => a.name.localeCompare(b.name));
}

export async function dropSubjectMCQTable(subjectId: string): Promise<void> {
  const db = await getNativeDb(subjectId);
  if (db) {
    await db.execAsync('DELETE FROM mcq_questions');
    await db.execAsync('DROP TABLE IF EXISTS mcq_tags');
    delete nativeDbs[subjectId];
    delete nativeDbReady[subjectId];
    return;
  }
  memoryCaches[subjectId] = [];
  await AsyncStorage.removeItem(storageKey(subjectId));
  await AsyncStorage.removeItem(tagsStorageKey(subjectId));
}

// ─── Tags API (per-subject scoped) ───

export async function getSubjectQuestionTags(subjectId: string, questionId: string): Promise<string[]> {
  const db = await getNativeTagsDb(subjectId);
  if (db) {
    const row = await db.getFirstAsync('SELECT tags FROM mcq_tags WHERE question_id = ?', [questionId]);
    return row?.tags ? row.tags.split(',').filter(Boolean) : [];
  }
  try {
    const json = await AsyncStorage.getItem(tagsStorageKey(subjectId));
    const all: Record<string, string[]> = json ? JSON.parse(json) : {};
    return all[questionId] || [];
  } catch { return []; }
}

export async function setSubjectQuestionTags(subjectId: string, questionId: string, tags: string[]): Promise<void> {
  const db = await getNativeTagsDb(subjectId);
  if (db) {
    const tagsStr = [...new Set(tags)].join(',');
    if (tagsStr) {
      await db.runAsync(
        'INSERT OR REPLACE INTO mcq_tags (question_id, tags) VALUES (?, ?)',
        [questionId, tagsStr]
      );
    } else {
      await db.runAsync('DELETE FROM mcq_tags WHERE question_id = ?', [questionId]);
    }
    return;
  }
  try {
    const json = await AsyncStorage.getItem(tagsStorageKey(subjectId));
    const all: Record<string, string[]> = json ? JSON.parse(json) : {};
    const cleaned = [...new Set(tags)].filter(Boolean);
    if (cleaned.length > 0) all[questionId] = cleaned;
    else delete all[questionId];
    await AsyncStorage.setItem(tagsStorageKey(subjectId), JSON.stringify(all));
  } catch {}
}

export async function addSubjectQuestionTag(subjectId: string, questionId: string, tag: string): Promise<string[]> {
  const current = await getSubjectQuestionTags(subjectId, questionId);
  if (!current.includes(tag)) current.push(tag);
  await setSubjectQuestionTags(subjectId, questionId, current);
  return current;
}

export async function removeSubjectQuestionTag(subjectId: string, questionId: string, tag: string): Promise<string[]> {
  const current = await getSubjectQuestionTags(subjectId, questionId);
  const updated = current.filter(t => t !== tag);
  await setSubjectQuestionTags(subjectId, questionId, updated);
  return updated;
}

export async function getSubjectMCQRowsByTag(subjectId: string, tag: string): Promise<SubjectMCQRow[]> {
  const db = await getNativeDb(subjectId);
  if (db) {
    const tagged = await db.getAllAsync('SELECT question_id FROM mcq_tags WHERE tags LIKE ?', [`%${tag}%`]);
    if (!tagged.length) return [];
    const ids = tagged.map((r: any) => parseInt(r.question_id.replace('sub_', ''), 10)).filter((n: number) => !isNaN(n));
    if (!ids.length) return [];
    const ph = ids.map(() => '?').join(',');
    return await db.getAllAsync(`SELECT * FROM mcq_questions WHERE id IN (${ph}) ORDER BY id ASC`, ids);
  }
  const cache = await loadCache(subjectId);
  const json = await AsyncStorage.getItem(tagsStorageKey(subjectId));
  const all: Record<string, string[]> = json ? JSON.parse(json) : {};
  const taggedIds = Object.entries(all)
    .filter(([, tags]) => tags.includes(tag))
    .map(([qid]) => parseInt(qid.replace('sub_', ''), 10))
    .filter(n => !isNaN(n));
  return cache.filter(r => taggedIds.includes(r.id));
}

export async function updateSubjectMCQRow(subjectId: string, mcqRowId: number, fields: Partial<SubjectMCQRow>): Promise<boolean> {
  const db = await getNativeDb(subjectId);
  if (db) {
    const allowed = ['question', 'a_hindi', 'b_hindi', 'c_hindi', 'd_hindi', 'e_hindi', 'answer', 'explanation',
      'question_en', 'a_eng', 'b_eng', 'c_eng', 'd_eng', 'e_engl', 'answer_en', 'explaination_en'] as const;
    const sets: string[] = [];
    const vals: any[] = [];
    for (const key of allowed) {
      if (key in fields) {
        sets.push(`"${key}" = ?`);
        vals.push(String((fields as any)[key] || ''));
      }
    }
    if (!sets.length) return false;
    sets.push('updated_at = ?');
    vals.push(new Date().toISOString());
    vals.push(mcqRowId);
    await db.runAsync(`UPDATE mcq_questions SET ${sets.join(', ')} WHERE id = ?`, vals);
    delete memoryCaches[subjectId];
    return true;
  }
  const existing = await loadCache(subjectId);
  const idx = existing.findIndex(r => r.id === mcqRowId);
  if (idx === -1) return false;
  for (const [k, v] of Object.entries(fields)) {
    if (k in existing[idx]) (existing[idx] as any)[k] = String(v || '');
  }
  existing[idx].updated_at = new Date().toISOString();
  await saveCache(subjectId, existing);
  return true;
}

export async function deleteSubjectMCQById(subjectId: string, mcqRowId: number): Promise<boolean> {
  const db = await getNativeDb(subjectId);
  if (db) {
    let deleted = false;
    await db.withExclusiveTransactionAsync(async (txn: any) => {
      const res = await txn.runAsync('DELETE FROM mcq_questions WHERE id = ?', [mcqRowId]);
      if (res.changes > 0) deleted = true;
      await txn.runAsync('DELETE FROM mcq_tags WHERE question_id = ?', [`sub_${mcqRowId}`]);
    });
    return deleted;
  }
  const existing = await loadCache(subjectId);
  const idx = existing.findIndex(r => r.id === mcqRowId);
  if (idx === -1) return false;
  existing.splice(idx, 1);
  await saveCache(subjectId, existing);
  try {
    const json = await AsyncStorage.getItem(tagsStorageKey(subjectId));
    const all: Record<string, string[]> = json ? JSON.parse(json) : {};
    delete all[`sub_${mcqRowId}`];
    await AsyncStorage.setItem(tagsStorageKey(subjectId), JSON.stringify(all));
  } catch {}
  return true;
}
