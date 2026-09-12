import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

const STORAGE_KEY = 'examforge_mcq_data';

export interface MCQRow {
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
let memoryCache: MCQRow[] | null = null;

async function loadCache(): Promise<MCQRow[]> {
  if (memoryCache) return memoryCache;
  try {
    const json = await AsyncStorage.getItem(STORAGE_KEY);
    memoryCache = json ? JSON.parse(json) : [];
  } catch {
    memoryCache = [];
  }
  return memoryCache!;
}

async function saveCache(rows: MCQRow[]): Promise<void> {
  memoryCache = rows;
  await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(rows));
}

function normalizeRow(row: any, idx: number): MCQRow {
  return {
    id: row.id || row.n8n_id || idx + 1,
    question: String(row.question || ''),
    a_hindi: String(row.a_hindi || ''),
    b_hindi: String(row.b_hindi || ''),
    c_hindi: String(row.c_hindi || ''),
    d_hindi: String(row.d_hindi || ''),
    answer: String(row.answer || ''),
    e_hindi: String(row.e_hindi || ''),
    explanation: String(row.explanation || ''),
    question_en: String(row.question_en || ''),
    a_eng: String(row.a_eng || ''),
    b_eng: String(row.b_eng || ''),
    c_eng: String(row.c_eng || ''),
    d_eng: String(row.d_eng || ''),
    e_engl: String(row.e_engl || ''),
    answer_en: String(row.answer_en || ''),
    explaination_en: String(row.explaination_en || ''),
    index: String(row.index || ''),
    n8n_id: row.id || row.n8n_id || null,
    created_at: String(row.createdAt || new Date().toISOString()),
    updated_at: String(row.updatedAt || new Date().toISOString()),
  };
}

// ─── Native: lazy-loaded SQLite ───
let nativeDb: any = null;
let nativeDbReady = false;
let nativeDbFailed = false;

async function getNativeDb() {
  if (!IS_NATIVE || nativeDbFailed) return null;
  if (nativeDb && nativeDbReady) return nativeDb;
  try {
    const SQLite = require('expo-sqlite');
    nativeDb = await SQLite.openDatabaseAsync('electrician_mcq.db');
    await nativeDb.execAsync(`
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
    nativeDbReady = true;
  } catch (e) {
    console.warn('[electrician-db] SQLite init failed:', e);
    nativeDbFailed = true;
    nativeDb = null;
  }
  return nativeDb;
}

// ─── Public API ───

export async function insertMCQRows(rows: any[]): Promise<number> {
  const db = await getNativeDb();
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
  const existing = await loadCache();
  const normalized = rows.map((r, i) => normalizeRow(r, existing.length + i));
  const merged = [...existing, ...normalized];
  await saveCache(merged);
  return normalized.length;
}

export async function getMCQCount(): Promise<number> {
  const db = await getNativeDb();
  if (db) {
    const r = await db.getFirstAsync('SELECT COUNT(*) as cnt FROM mcq_questions');
    return r?.cnt ?? 0;
  }
  const cache = await loadCache();
  return cache.length;
}

export async function getMCQRows(offset: number, limit: number): Promise<MCQRow[]> {
  const db = await getNativeDb();
  if (db) {
    return await db.getAllAsync(
      'SELECT * FROM mcq_questions ORDER BY id ASC LIMIT ? OFFSET ?',
      [limit, offset]
    );
  }
  const cache = await loadCache();
  return cache.slice(offset, offset + limit);
}

export async function getMCQByIndex(indexName: string): Promise<MCQRow[]> {
  const db = await getNativeDb();
  if (db) {
    return await db.getAllAsync(
      'SELECT * FROM mcq_questions WHERE "index" = ? ORDER BY id ASC',
      [indexName]
    );
  }
  const cache = await loadCache();
  return cache.filter((r: MCQRow) => r.index === indexName);
}

export async function searchMCQ(query: string): Promise<MCQRow[]> {
  const db = await getNativeDb();
  if (db) {
    const like = `%${query}%`;
    return await db.getAllAsync(
      `SELECT * FROM mcq_questions WHERE question LIKE ? OR question_en LIKE ? OR answer LIKE ? OR answer_en LIKE ? ORDER BY id ASC LIMIT 200`,
      [like, like, like, like]
    );
  }
  const cache = await loadCache();
  const q = query.toLowerCase();
  return cache.filter((r: MCQRow) =>
    r.question.toLowerCase().includes(q) ||
    r.question_en.toLowerCase().includes(q) ||
    r.answer.toLowerCase().includes(q) ||
    r.answer_en.toLowerCase().includes(q)
  ).slice(0, 200);
}

export async function clearMCQTable(): Promise<void> {
  const db = await getNativeDb();
  if (db) {
    await db.execAsync('DELETE FROM mcq_questions');
    return;
  }
  memoryCache = null;
  await AsyncStorage.removeItem(STORAGE_KEY);
}

export async function getDistinctIndexes(): Promise<string[]> {
  const db = await getNativeDb();
  if (db) {
    const rows = await db.getAllAsync(
      'SELECT DISTINCT "index" FROM mcq_questions WHERE "index" != "" ORDER BY "index" ASC'
    );
    return rows.map((r: any) => r.index);
  }
  const cache = await loadCache();
  const set = new Set(cache.map((r: MCQRow) => r.index).filter(Boolean));
  return Array.from(set).sort();
}

export async function getTopicCounts(): Promise<{ name: string; count: number }[]> {
  const db = await getNativeDb();
  if (db) {
    return await db.getAllAsync(
      'SELECT "index" as name, COUNT(*) as count FROM mcq_questions WHERE "index" != "" GROUP BY "index" ORDER BY "index" ASC'
    );
  }
  const cache = await loadCache();
  const map = new Map<string, number>();
  for (const r of cache) {
    if (r.index) map.set(r.index, (map.get(r.index) || 0) + 1);
  }
  return Array.from(map.entries()).map(([name, count]) => ({ name, count })).sort((a, b) => a.name.localeCompare(b.name));
}

export async function dropMCQTable(): Promise<void> {
  const db = await getNativeDb();
  if (db) {
    await db.execAsync('DROP TABLE IF EXISTS mcq_tags');
    await db.execAsync('DROP TABLE IF EXISTS mcq_questions');
    nativeDb = null;
    nativeDbReady = false;
    return;
  }
  memoryCache = null;
  await AsyncStorage.removeItem(STORAGE_KEY);
}

// ─── Tags API ───
const TAGS_KEY = 'examforge_mcq_tags';

let tagsTableReady = false;

async function ensureTagsTable(db: any) {
  if (tagsTableReady) return;
  try {
    await db.execAsync(`
      CREATE TABLE IF NOT EXISTS mcq_tags (
        question_id TEXT PRIMARY KEY,
        tags TEXT NOT NULL DEFAULT ''
      );
    `);
    tagsTableReady = true;
  } catch {}
}

/** Get tags for a question (e.g. "important,edit") */
export async function getQuestionTags(questionId: string): Promise<string[]> {
  const db = await getNativeDb();
  if (db) {
    await ensureTagsTable(db);
    const row = await db.getFirstAsync('SELECT tags FROM mcq_tags WHERE question_id = ?', [questionId]);
    return row?.tags ? row.tags.split(',').filter(Boolean) : [];
  }
  try {
    const json = await AsyncStorage.getItem(TAGS_KEY);
    const all: Record<string, string[]> = json ? JSON.parse(json) : {};
    return all[questionId] || [];
  } catch { return []; }
}

/** Set tags for a question (replaces all tags) */
export async function setQuestionTags(questionId: string, tags: string[]): Promise<void> {
  const db = await getNativeDb();
  if (db) {
    await ensureTagsTable(db);
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
    const json = await AsyncStorage.getItem(TAGS_KEY);
    const all: Record<string, string[]> = json ? JSON.parse(json) : {};
    const cleaned = [...new Set(tags)].filter(Boolean);
    if (cleaned.length > 0) all[questionId] = cleaned;
    else delete all[questionId];
    await AsyncStorage.setItem(TAGS_KEY, JSON.stringify(all));
  } catch {}
}

/** Add a single tag to a question (preserves existing tags) */
export async function addQuestionTag(questionId: string, tag: string): Promise<string[]> {
  const current = await getQuestionTags(questionId);
  if (!current.includes(tag)) current.push(tag);
  await setQuestionTags(questionId, current);
  return current;
}

/** Remove a single tag from a question */
export async function removeQuestionTag(questionId: string, tag: string): Promise<string[]> {
  const current = await getQuestionTags(questionId);
  const updated = current.filter(t => t !== tag);
  await setQuestionTags(questionId, updated);
  return updated;
}

/** Get all questions with a specific tag */
export async function getQuestionsByTag(tag: string): Promise<string[]> {
  const db = await getNativeDb();
  if (db) {
    await ensureTagsTable(db);
    const rows = await db.getAllAsync('SELECT question_id FROM mcq_tags WHERE tags LIKE ?', [`%${tag}%`]);
    return rows.map((r: any) => r.question_id);
  }
  try {
    const json = await AsyncStorage.getItem(TAGS_KEY);
    const all: Record<string, string[]> = json ? JSON.parse(json) : {};
    return Object.entries(all).filter(([, tags]) => tags.includes(tag)).map(([id]) => id);
  } catch { return []; }
}

/** Delete a question by its MCQ row id (removes from DB + tags) */
export async function deleteMCQById(mcqRowId: number): Promise<boolean> {
  const db = await getNativeDb();
  if (db) {
    await ensureTagsTable(db);
    let deleted = false;
    await db.withExclusiveTransactionAsync(async (txn: any) => {
      const res = await txn.runAsync('DELETE FROM mcq_questions WHERE id = ?', [mcqRowId]);
      if (res.changes > 0) deleted = true;
      await txn.runAsync('DELETE FROM mcq_tags WHERE question_id = ?', [`ecq_${mcqRowId}`]);
    });
    return deleted;
  }
  // Web fallback
  const existing = await loadCache();
  const idx = existing.findIndex(r => r.id === mcqRowId);
  if (idx === -1) return false;
  existing.splice(idx, 1);
  await saveCache(existing);
  // Clean up tags
  try {
    const json = await AsyncStorage.getItem(TAGS_KEY);
    const all: Record<string, string[]> = json ? JSON.parse(json) : {};
    delete all[`ecq_${mcqRowId}`];
    await AsyncStorage.setItem(TAGS_KEY, JSON.stringify(all));
  } catch {}
  return true;
}

/** Get all MCQRow objects that have a specific tag */
export async function getMCQRowsByTag(tag: string): Promise<MCQRow[]> {
  const db = await getNativeDb();
  if (db) {
    await ensureTagsTable(db);
    const tagged = await db.getAllAsync('SELECT question_id FROM mcq_tags WHERE tags LIKE ?', [`%${tag}%`]);
    if (!tagged.length) return [];
    const ids = tagged.map((r: any) => {
      const qid = r.question_id as string;
      return parseInt(qid.replace('ecq_', ''), 10);
    }).filter((n: number) => !isNaN(n));
    if (!ids.length) return [];
    const placeholders = ids.map(() => '?').join(',');
    return await db.getAllAsync(
      `SELECT * FROM mcq_questions WHERE id IN (${placeholders}) ORDER BY id ASC`, ids
    );
  }
  // Web fallback
  const cache = await loadCache();
  const json = await AsyncStorage.getItem(TAGS_KEY);
  const all: Record<string, string[]> = json ? JSON.parse(json) : {};
  const taggedIds = Object.entries(all)
    .filter(([, tags]) => tags.includes(tag))
    .map(([qid]) => parseInt(qid.replace('ecq_', ''), 10))
    .filter(n => !isNaN(n));
  return cache.filter(r => taggedIds.includes(r.id));
}

/** Update a single MCQRow by id */
export async function updateMCQRow(mcqRowId: number, fields: Partial<MCQRow>): Promise<boolean> {
  const db = await getNativeDb();
  if (db) {
    const allowed = ['question', 'a_hindi', 'b_hindi', 'c_hindi', 'd_hindi', 'answer', 'explanation',
      'question_en', 'a_eng', 'b_eng', 'c_eng', 'd_eng', 'answer_en', 'explaination_en'] as const;
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
    // Also update memory cache
    memoryCache = null;
    return true;
  }
  // Web fallback
  const existing = await loadCache();
  const idx = existing.findIndex(r => r.id === mcqRowId);
  if (idx === -1) return false;
  for (const [k, v] of Object.entries(fields)) {
    if (k in existing[idx]) (existing[idx] as any)[k] = String(v || '');
  }
  existing[idx].updated_at = new Date().toISOString();
  await saveCache(existing);
  return true;
}
