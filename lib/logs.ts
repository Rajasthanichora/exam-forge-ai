import { setItem, getItem } from './storage';

const LOG_KEY = 'examforge_shared_logs';

export type LogCategory = 'success' | 'info' | 'warning' | 'error';

export const LOG_COLORS: Record<LogCategory, string> = {
  success: '#10B981',
  info: '#6366F1',
  warning: '#F59E0B',
  error: '#F43F5E',
};

export const LOG_LABELS: Record<LogCategory, string> = {
  success: 'SUCCESS',
  info: 'INFO',
  warning: 'WARNING',
  error: 'ERROR',
};

export interface LogEntry {
  time: string;
  text: string;
  color?: string;
  screen: string;
  category?: LogCategory;
}

export async function persistLog(
  screen: string,
  text: string,
  color?: string,
  category?: LogCategory
): Promise<void> {
  const time = new Date().toLocaleTimeString('en-US', {
    hour12: false,
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
  try {
    const existing = await getItem(LOG_KEY);
    const logs: LogEntry[] = existing ? JSON.parse(existing) : [];
    const resolvedColor = color || (category ? LOG_COLORS[category] : undefined);
    logs.push({ time, text, color: resolvedColor, screen, category });
    const trimmed = logs.slice(-200);
    await setItem(LOG_KEY, JSON.stringify(trimmed));
  } catch {
    // silently ignore persistence errors
  }
}

export async function logSuccess(screen: string, text: string): Promise<void> {
  return persistLog(screen, text, LOG_COLORS.success, 'success');
}

export async function logInfo(screen: string, text: string): Promise<void> {
  return persistLog(screen, text, LOG_COLORS.info, 'info');
}

export async function logWarning(screen: string, text: string): Promise<void> {
  return persistLog(screen, text, LOG_COLORS.warning, 'warning');
}

export async function logError(screen: string, text: string): Promise<void> {
  return persistLog(screen, text, LOG_COLORS.error, 'error');
}

export async function getPersistedLogs(): Promise<LogEntry[]> {
  try {
    const data = await getItem(LOG_KEY);
    return data ? JSON.parse(data) : [];
  } catch {
    return [];
  }
}

export async function clearPersistedLogs(): Promise<void> {
  try {
    await setItem(LOG_KEY, JSON.stringify([]));
  } catch {
    // silently ignore
  }
}

export function addLog(
  logs: LogEntry[],
  text: string,
  color?: string,
  screen?: string
): LogEntry[] {
  const time = new Date().toLocaleTimeString('en-US', {
    hour12: false,
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
  return [...logs, { time, text, color, screen: screen || '' }];
}