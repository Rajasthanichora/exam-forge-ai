import AsyncStorage from '@react-native-async-storage/async-storage';

const KEYS = {
  APP_DATA: 'examforge_app_data',
  OPENROUTER_KEY: 'examforge_openrouter_key',
  GEMINI_KEY: 'examforge_gemini_key',
  AI_PROVIDER: 'examforge_ai_provider',
  OPENROUTER_MODEL: 'examforge_openrouter_model',
  GEMINI_MODEL: 'examforge_gemini_model',
  OPENROUTER_TESTED: 'examforge_openrouter_tested_models',
  GEMINI_TESTED: 'examforge_gemini_tested_models',
};

export async function getItem(key: string): Promise<string | null> {
  try {
    return await AsyncStorage.getItem(key);
  } catch {
    return null;
  }
}

export async function setItem(key: string, value: string): Promise<void> {
  try {
    await AsyncStorage.setItem(key, value);
  } catch (e) {
    console.error('AsyncStorage setItem error:', e);
  }
}

export async function removeItem(key: string): Promise<void> {
  try {
    await AsyncStorage.removeItem(key);
  } catch (e) {
    console.error('AsyncStorage removeItem error:', e);
  }
}

// Typed storage helpers
export async function getJson<T>(key: string): Promise<T | null> {
  const val = await getItem(key);
  if (!val) return null;
  try {
    return JSON.parse(val) as T;
  } catch {
    return null;
  }
}

export async function setJson(key: string, value: unknown): Promise<void> {
  await setItem(key, JSON.stringify(value));
}

// App-specific storage
export const AppStorage = {
  getAppData: () => getJson<any>(KEYS.APP_DATA),
  setAppData: (data: unknown) => setJson(KEYS.APP_DATA, data),

  getOpenRouterKey: () => getItem(KEYS.OPENROUTER_KEY),
  setOpenRouterKey: (key: string) => setItem(KEYS.OPENROUTER_KEY, key),
  removeOpenRouterKey: () => removeItem(KEYS.OPENROUTER_KEY),

  getGeminiKey: () => getItem(KEYS.GEMINI_KEY),
  setGeminiKey: (key: string) => setItem(KEYS.GEMINI_KEY, key),
  removeGeminiKey: () => removeItem(KEYS.GEMINI_KEY),

  getAiProvider: async (): Promise<'openrouter' | 'gemini'> => {
    const val = await getItem(KEYS.AI_PROVIDER);
    return (val as 'openrouter' | 'gemini') || 'openrouter';
  },
  setAiProvider: (provider: string) => setItem(KEYS.AI_PROVIDER, provider),

  getOpenRouterModel: () => getItem(KEYS.OPENROUTER_MODEL),
  setOpenRouterModel: (model: string) => setItem(KEYS.OPENROUTER_MODEL, model),

  getGeminiModel: () => getItem(KEYS.GEMINI_MODEL),
  setGeminiModel: (model: string) => setItem(KEYS.GEMINI_MODEL, model),

  getTestedModels: async (provider: 'openrouter' | 'gemini'): Promise<any[]> => {
    const key = provider === 'openrouter' ? KEYS.OPENROUTER_TESTED : KEYS.GEMINI_TESTED;
    return (await getJson<any[]>(key)) || [];
  },
  setTestedModels: async (provider: 'openrouter' | 'gemini', models: unknown) => {
    const key = provider === 'openrouter' ? KEYS.OPENROUTER_TESTED : KEYS.GEMINI_TESTED;
    await setJson(key, models);
  },
};
