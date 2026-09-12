import AsyncStorage from '@react-native-async-storage/async-storage';

const KEYS = {
  APP_DATA: 'examforge_app_data',
  OPENROUTER_KEY: 'examforge_openrouter_key',
  GEMINI_KEY: 'examforge_gemini_key',
  MISTRAL_KEY: 'examforge_mistral_key',
  AI_PROVIDER: 'examforge_ai_provider',
  OPENROUTER_MODEL: 'examforge_openrouter_model',
  GEMINI_MODEL: 'examforge_gemini_model',
  MISTRAL_MODEL: 'examforge_mistral_model',
  OPENROUTER_TESTED: 'examforge_openrouter_tested_models',
  GEMINI_TESTED: 'examforge_gemini_tested_models',
  MISTRAL_TESTED: 'examforge_mistral_tested_models',
  CONVERSATIONS: 'examforge_ai_conversations',
  ACTIVE_CONVERSATION: 'examforge_active_conversation',
  CUSTOM_INSTRUCTIONS: 'examforge_custom_instructions',
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

  getMistralKey: () => getItem(KEYS.MISTRAL_KEY),
  setMistralKey: (key: string) => setItem(KEYS.MISTRAL_KEY, key),
  removeMistralKey: () => removeItem(KEYS.MISTRAL_KEY),

  getAiProvider: async (): Promise<'openrouter' | 'gemini' | 'mistral'> => {
    const val = await getItem(KEYS.AI_PROVIDER);
    return (val as 'openrouter' | 'gemini' | 'mistral') || 'openrouter';
  },
  setAiProvider: (provider: string) => setItem(KEYS.AI_PROVIDER, provider),

  getOpenRouterModel: () => getItem(KEYS.OPENROUTER_MODEL),
  setOpenRouterModel: (model: string) => setItem(KEYS.OPENROUTER_MODEL, model),

  getGeminiModel: () => getItem(KEYS.GEMINI_MODEL),
  setGeminiModel: (model: string) => setItem(KEYS.GEMINI_MODEL, model),

  getMistralModel: () => getItem(KEYS.MISTRAL_MODEL),
  setMistralModel: (model: string) => setItem(KEYS.MISTRAL_MODEL, model),

  getTestedModels: async (provider: 'openrouter' | 'gemini' | 'mistral'): Promise<any[]> => {
    let key: string;
    if (provider === 'openrouter') key = KEYS.OPENROUTER_TESTED;
    else if (provider === 'gemini') key = KEYS.GEMINI_TESTED;
    else key = KEYS.MISTRAL_TESTED;
    return (await getJson<any[]>(key)) || [];
  },
  setTestedModels: async (provider: 'openrouter' | 'gemini' | 'mistral', models: unknown) => {
    let key: string;
    if (provider === 'openrouter') key = KEYS.OPENROUTER_TESTED;
    else if (provider === 'gemini') key = KEYS.GEMINI_TESTED;
    else key = KEYS.MISTRAL_TESTED;
    await setJson(key, models);
  },

  // Conversation storage
  getConversations: () => getJson<any[]>(KEYS.CONVERSATIONS),
  setConversations: (conversations: unknown) => setJson(KEYS.CONVERSATIONS, conversations),
  getActiveConversation: () => getItem(KEYS.ACTIVE_CONVERSATION),
  setActiveConversation: (id: string) => setItem(KEYS.ACTIVE_CONVERSATION, id),
  removeActiveConversation: () => removeItem(KEYS.ACTIVE_CONVERSATION),

  // Custom Instructions
  getCustomInstructions: () => getItem(KEYS.CUSTOM_INSTRUCTIONS),
  setCustomInstructions: (instructions: string) => setItem(KEYS.CUSTOM_INSTRUCTIONS, instructions),
};
