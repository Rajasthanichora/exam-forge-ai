import { setItem, getItem } from './storage';

const LOG_KEY = 'examforge_shared_logs';

export interface LogEntry {
  time: string;
  text: string;
  color?: string;
  screen: string;
}

export async function persistLog(screen: string, text: string, color?: string): Promise<void> {
  const time = new Date().toLocaleTimeString('en-US', { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' });
  try {
    const existing = await getItem(LOG_KEY);
    const logs: LogEntry[] = existing ? JSON.parse(existing) : [];
    logs.push({ time, text, color, screen });
    // Keep only last 200 entries to avoid unbounded growth
    const trimmed = logs.slice(-200);
    await setItem(LOG_KEY, JSON.stringify(trimmed));
  } catch {
    // silently ignore persistence errors
  }
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

export function addLog(logs: LogEntry[], text: string, color?: string, screen?: string): LogEntry[] {
  const time = new Date().toLocaleTimeString('en-US', { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' });
  return [...logs, { time, text, color, screen: screen || '' }];
}
