import AsyncStorage from '@react-native-async-storage/async-storage';
import { AppStorage, getItem, setItem } from './storage';

// ─── Types ───────────────────────────────────────────────────────────────────────

export interface StorageItemInfo {
  key: string;
  label: string;
  category: StorageCategory;
  sizeBytes: number;
  sizeFormatted: string;
}

export type StorageCategory =
  | 'app_data'
  | 'api_keys'
  | 'ai_settings'
  | 'conversations'
  | 'logs'
  | 'theme'
  | 'other';

export interface StorageCategoryInfo {
  category: StorageCategory;
  label: string;
  color: string;
  items: StorageItemInfo[];
  totalBytes: number;
  totalFormatted: string;
}

export interface BackupData {
  version: 1;
  createdAt: string;
  appName: 'exam-forge-mobile';
  data: Record<string, string>;
}

export interface StorageBreakdown {
  categories: StorageCategoryInfo[];
  totalBytes: number;
  totalFormatted: string;
}

// ─── Category Colors ─────────────────────────────────────────────────────────────

const CATEGORY_COLORS: Record<StorageCategory, string> = {
  app_data: '#4F46E5',
  api_keys: '#F43F5E',
  ai_settings: '#10B981',
  conversations: '#F59E0B',
  logs: '#64748B',
  theme: '#8B5CF6',
  other: '#6B7280',
};

const CATEGORY_LABELS: Record<StorageCategory, string> = {
  app_data: 'App Data',
  api_keys: 'API Keys',
  ai_settings: 'AI Settings',
  conversations: 'Conversations',
  logs: 'Logs',
  theme: 'Theme',
  other: 'Other',
};

export interface KeyDescriptor {
  key: string;
  label: string;
  category: StorageCategory;
}

export const ALL_STORAGE_KEYS: KeyDescriptor[] = [
  { key: 'examforge_app_data', label: 'App Data (Groups, Sections, Tests)', category: 'app_data' },
  { key: 'examforge_openrouter_key', label: 'OpenRouter API Key', category: 'api_keys' },
  { key: 'examforge_gemini_key', label: 'Gemini API Key', category: 'api_keys' },
  { key: 'examforge_mistral_key', label: 'Mistral API Key', category: 'api_keys' },
  { key: 'examforge_ai_provider', label: 'AI Provider Preference', category: 'ai_settings' },
  { key: 'examforge_openrouter_model', label: 'OpenRouter Model', category: 'ai_settings' },
  { key: 'examforge_gemini_model', label: 'Gemini Model', category: 'ai_settings' },
  { key: 'examforge_mistral_model', label: 'Mistral Model', category: 'ai_settings' },
  { key: 'examforge_openrouter_tested_models', label: 'Tested OpenRouter Models', category: 'ai_settings' },
  { key: 'examforge_gemini_tested_models', label: 'Tested Gemini Models', category: 'ai_settings' },
  { key: 'examforge_mistral_tested_models', label: 'Tested Mistral Models', category: 'ai_settings' },
  { key: 'examforge_ai_conversations', label: 'AI Chat Conversations', category: 'conversations' },
  { key: 'examforge_active_conversation', label: 'Active Conversation', category: 'conversations' },
  { key: 'examforge_custom_instructions', label: 'Custom Instructions', category: 'ai_settings' },
  { key: 'examforge_fullscreen_mode', label: 'Fullscreen Mode Setting', category: 'theme' },
  { key: 'examforge_theme_mode', label: 'Theme Mode (Light/Dark)', category: 'theme' },
  { key: 'examforge_shared_logs', label: 'Application Logs', category: 'logs' },
  { key: 'examforge_ai_saved_documents', label: 'AI Saved Documents', category: 'ai_settings' },
  { key: 'examforge_ai_config_notes', label: 'AI Config Notes', category: 'ai_settings' },
  { key: 'examforge_ai_config_difficulty', label: 'AI Config Difficulty', category: 'ai_settings' },
  { key: 'examforge_ai_config_count', label: 'AI Config Question Count', category: 'ai_settings' },
  { key: 'examforge_ai_selected_doc_ids', label: 'AI Selected Document IDs', category: 'ai_settings' },
];

// ─── Helpers ─────────────────────────────────────────────────────────────────────

// ─── UTF-8 byte size helper ────────────────────────────────────────────────────

export function getStringByteSize(str: string): number {
  // UTF-8 byte length calculation (works in Hermes/React Native)
  let size = 0;
  for (let i = 0; i < str.length; i++) {
    const code = str.charCodeAt(i);
    if (code < 0x80) {
      size += 1;
    } else if (code < 0x800) {
      size += 2;
    } else if (code < 0xD800 || code >= 0xE000) {
      size += 3;
    } else {
      // Surrogate pair
      i++;
      size += 4;
    }
  }
  return size;
}

export function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  const val = bytes / Math.pow(k, i);
  return parseFloat(val.toFixed(i === 0 ? 0 : 2)) + ' ' + sizes[i];
}

// ─── Storage Breakdown ───────────────────────────────────────────────────────────

export async function getStorageBreakdown(): Promise<StorageBreakdown> {
  const categoryMap = new Map<StorageCategory, StorageItemInfo[]>();

  for (const desc of ALL_STORAGE_KEYS) {
    const value = await getItem(desc.key);
    const sizeBytes = value ? getStringByteSize(value) : 0;
    const item: StorageItemInfo = {
      key: desc.key,
      label: desc.label,
      category: desc.category,
      sizeBytes,
      sizeFormatted: formatBytes(sizeBytes),
    };
    const existing = categoryMap.get(desc.category) || [];
    existing.push(item);
    categoryMap.set(desc.category, existing);
  }

  const categories: StorageCategoryInfo[] = [];
  let totalBytes = 0;

  for (const [category, items] of categoryMap.entries()) {
    const catTotal = items.reduce((sum, i) => sum + i.sizeBytes, 0);
    totalBytes += catTotal;
    categories.push({
      category,
      label: CATEGORY_LABELS[category],
      color: CATEGORY_COLORS[category],
      items,
      totalBytes: catTotal,
      totalFormatted: formatBytes(catTotal),
    });
  }

  categories.sort((a, b) => b.totalBytes - a.totalBytes);

  return {
    categories,
    totalBytes,
    totalFormatted: formatBytes(totalBytes),
  };
}

// ─── Backup ──────────────────────────────────────────────────────────────────────

export async function collectAllBackupData(): Promise<BackupData> {
  const data: Record<string, string> = {};

  for (const desc of ALL_STORAGE_KEYS) {
    const value = await getItem(desc.key);
    if (value !== null) {
      data[desc.key] = value;
    }
  }

  return {
    version: 1,
    createdAt: new Date().toISOString(),
    appName: 'exam-forge-mobile',
    data,
  };
}

export function serializeBackup(backup: BackupData): string {
  return JSON.stringify(backup, null, 2);
}

export function generateBackupFilename(): string {
  const now = new Date();
  const dateStr =
    now.getFullYear().toString() +
    now.getMonth().toString().padStart(2, '0') +
    now.getDate().toString().padStart(2, '0') +
    '_' +
    now.getHours().toString().padStart(2, '0') +
    now.getMinutes().toString().padStart(2, '0');
  return `examforge_backup_${dateStr}.json`;
}

// ─── Restore ─────────────────────────────────────────────────────────────────────

export function parseBackup(jsonStr: string): BackupData {
  const parsed = JSON.parse(jsonStr);

  if (!parsed || typeof parsed !== 'object') {
    throw new Error('Invalid backup file: not a valid JSON object');
  }
  if (parsed.appName !== 'exam-forge-mobile') {
    throw new Error('Invalid backup file: not an ExamForge backup');
  }
  if (!parsed.data || typeof parsed.data !== 'object') {
    throw new Error('Invalid backup file: missing data field');
  }

  return parsed as BackupData;
}

export async function restoreFromBackup(backup: BackupData): Promise<{ restored: number; failed: number }> {
  let restored = 0;
  let failed = 0;

  for (const [key, value] of Object.entries(backup.data)) {
    try {
      await setItem(key, value);
      restored++;
    } catch {
      failed++;
    }
  }

  return { restored, failed };
}

