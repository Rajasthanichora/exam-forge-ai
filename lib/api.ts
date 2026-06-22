import { Question, TestConfig, StoredQuestion } from './types';
import { shuffleQuestionOptions } from './utils';

const SYSTEM_PROMPT = `You are an expert exam question generator specializing in creating UNIQUE, non-repetitive multiple-choice questions.

CRITICAL OUTPUT FORMAT:
- Return a JSON object with this structure: { "questions": [...], "message": "..." }
- "questions" is an array of question objects
- "message" is optional - include ONLY if you couldn't generate all requested questions

QUESTION REQUIREMENTS:
- Each question must have exactly 4 options
- The correctAnswer field must be the index (0-3) of the correct option
- Include a brief, educational explanation for each answer
- Questions must be COMPLETELY UNIQUE
- Randomize the correct answer position (0-3) across questions - do NOT place correct answers only in fixed positions
- Distribute correct answers randomly among the four options

UNIQUENESS IS CRITICAL:
1. Do NOT repeat concepts from previously used questions
2. Focus on UNTESTED aspects of the study material
3. Cover all possible topics, subtopics, concepts from the source material
4. If you run out of unique concepts, generate FEWER questions rather than repeat`;

function getLanguageInstruction(language: string): string {
  const instructions: Record<string, string> = {
    english: 'Generate all questions, options, and explanations in English only.',
    hindi: 'Generate all questions, options, and explanations in Hindi (à¤¹à¤¿à¤‚à¤¦à¥€) using Devanagari script.',
    hinglish: 'Generate questions in Hinglish - a natural mix of Hindi and English as commonly used in conversation. Use Roman script with Hindi words mixed in naturally.',
  };
  return instructions[language] || instructions.english;
}

function buildPrompt(config: TestConfig, storedQuestions: StoredQuestion[], totalStoredCount?: number): string {
  const difficultyInstructions: Record<string, string> = {
    easy: 'Create straightforward questions testing basic recall and understanding.',
    medium: 'Create moderately challenging questions requiring application of concepts.',
    hard: 'Create challenging questions requiring analysis, synthesis, and critical thinking.',
  };

  let prompt = `Generate ${config.questionCount} UNIQUE multiple-choice questions based on the study material provided.

DIFFICULTY LEVEL: ${config.difficulty.toUpperCase()}
${difficultyInstructions[config.difficulty]}

QUESTION FORMAT: ${config.oneLinerMode ? 'ONE-LINER FORMAT - Each question MUST be a SHORT, SINGLE-LINE question (max 15 words, one sentence only).' : 'STANDARD DETAILED FORMAT'}

LANGUAGE: ${getLanguageInstruction(config.language)}
`;

  if (config.customPrompt) {
    prompt += `SPECIAL INSTRUCTIONS: ${config.customPrompt}\n\n`;
  }

  prompt += `STUDY MATERIAL:
${config.studyNotes}

`;

  if (storedQuestions.length > 0) {
    const totalCount = totalStoredCount ?? storedQuestions.length;
    prompt += `
PREVIOUSLY USED QUESTIONS - DO NOT REPEAT THESE CONCEPTS
Total previously used: ${totalCount} questions
Showing most recent ${storedQuestions.length} for context:

${storedQuestions.map((q, i) => `${i + 1}. ${q.questionText}`).join('\n')}

STRICT UNIQUENESS RULES:
1. Do NOT test the same fact/concept even with different wording
2. ONLY test concepts/facts NOT covered in the above list
3. If you cannot generate ${config.questionCount} unique questions, generate fewer and include "message" field
`;
  }

  prompt += `OUTPUT FORMAT - Return JSON:
{
  "questions": [
    {
      "question": "The complete question text",
      "options": ["Option A", "Option B", "Option C", "Option D"],
      "correctAnswer": 0,
      "explanation": "Brief explanation",
      "topic": "Specific topic"
    }
  ],
  "message": "Optional - only include if couldn't generate all questions"
}`;

  return prompt;
}

async function callOpenRouter(
  apiKey: string,
  model: string,
  systemPrompt: string,
  userPrompt: string
): Promise<string> {
  const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'HTTP-Referer': 'https://examforge.app',
      'X-Title': 'ExamForge AI',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
      temperature: 0.85,
      max_tokens: 6000,
    }),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    const msg = error?.error?.message || 'OpenRouter API error';
    throw new Error(msg);
  }

  const data = await response.json();
  return data.choices?.[0]?.message?.content || '';
}

async function callGemini(
  apiKey: string,
  model: string,
  systemPrompt: string,
  userPrompt: string
): Promise<string> {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(apiKey)}`;

  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [
        {
          role: 'user',
          parts: [{ text: `${systemPrompt}\n\n${userPrompt}` }],
        },
      ],
      generationConfig: {
        temperature: 0.85,
        maxOutputTokens: 6000,
      },
    }),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    const msg = error?.error?.message || 'Gemini API error';
    if (msg.toLowerCase().includes('quota') || msg.toLowerCase().includes('rate limit')) {
      throw new Error('GEMINI_QUOTA_EXCEEDED');
    }
    throw new Error(msg);
  }

  const data = await response.json();
  return data.candidates?.[0]?.content?.parts?.[0]?.text || '';
}


async function callMistral(
  apiKey: string,
  model: string,
  systemPrompt: string,
  userPrompt: string
): Promise<string> {
  const response = await fetch('https://api.mistral.ai/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
      temperature: 0.85,
      max_tokens: 6000,
    }),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    const msg = error?.error?.message || 'Mistral AI API error';
    throw new Error(msg);
  }

  const data = await response.json();
  return data.choices?.[0]?.message?.content || '';
}
function parseQuestionsResponse(
  content: string,
  config: TestConfig
): { questions: Question[]; message: string | null } {
  let questions: Question[] = [];
  let aiMessage: string | null = null;

  try {
    const objectMatch = content.match(/\{[\s\S]*\}/);
    if (objectMatch) {
      const parsed = JSON.parse(objectMatch[0]);
      if (parsed.questions && Array.isArray(parsed.questions)) {
        questions = parsed.questions;
        aiMessage = parsed.message || null;
      } else if (Array.isArray(parsed)) {
        questions = parsed;
      } else {
        const arrayMatch = content.match(/\[[\s\S]*\]/);
        if (arrayMatch) questions = JSON.parse(arrayMatch[0]);
      }
    } else {
      const arrayMatch = content.match(/\[[\s\S]*\]/);
      if (arrayMatch) questions = JSON.parse(arrayMatch[0]);
    }
  } catch {
    throw new Error('Failed to parse AI response. Please try again.');
  }

  const validated = questions
    .slice(0, config.questionCount)
    .map((q: any, index: number) => {
      let questionText = String(q.question || '');
      if (config.oneLinerMode && questionText.length > 120) {
        const firstSentence = questionText.split(/[.!?]/)[0];
        questionText = firstSentence.length > 10 ? firstSentence.trim() + '?' : questionText.slice(0, 100).trim() + '...';
      }
      return {
        id: `q-${Date.now()}-${index}`,
        question: questionText,
        options: Array.isArray(q.options) ? q.options.map(String) : [],
        correctAnswer: typeof q.correctAnswer === 'number' ? q.correctAnswer : 0,
        explanation: String(q.explanation || ''),
        difficulty: config.difficulty,
        topic: String(q.topic || 'General'),
      };
    })
    .filter((q: Question) => q.question && q.options.length === 4)
    .map(q => {
      const shuffled = shuffleQuestionOptions(q);
      return { ...q, options: shuffled.options, correctAnswer: shuffled.correctAnswer };
    });

  if (validated.length === 0) {
    throw new Error('No valid questions with 4 options were generated.');
  }

  let message = aiMessage;
  if (!message && validated.length < config.questionCount) {
    message = `Only ${validated.length} unique questions could be generated.`;
  }

  return { questions: validated, message };
}


// Chat API function - uses the active provider for general chat
export async function chatWithAI(
  provider: 'openrouter' | 'gemini' | 'mistral',
  model: string,
  apiKey: string,
  geminiApiKey: string,
  mistralApiKey: string,
  messages: { role: string; content: string }[]
): Promise<string> {
  const activeKey = provider === 'gemini' ? geminiApiKey : provider === 'mistral' ? mistralApiKey : apiKey;
  
  if (!activeKey) {
    throw new Error(`API key is required for ${provider}`);
  }

  if (provider === 'gemini') {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(activeKey)}`;
    const formattedContents = messages.map(m => ({
      role: m.role === 'assistant' ? 'model' : 'user',
      parts: [{ text: m.content }],
    }));

    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: formattedContents,
        generationConfig: { temperature: 0.85, maxOutputTokens: 4000 },
      }),
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      throw new Error(error?.error?.message || 'Gemini API error');
    }

    const data = await response.json();
    return data.candidates?.[0]?.content?.parts?.[0]?.text || '';
  } else if (provider === 'mistral') {
    return callMistralRaw(activeKey, model, messages);
  } else {
    return callOpenRouterRaw(apiKey, model, messages);
  }
}

async function callOpenRouterRaw(
  apiKey: string,
  model: string,
  messages: { role: string; content: string }[]
): Promise<string> {
  const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'HTTP-Referer': 'https://examforge.app',
      'X-Title': 'ExamForge AI',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model,
      messages: messages.map(m => ({ role: m.role, content: m.content })),
      temperature: 0.85,
      max_tokens: 4000,
    }),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(error?.error?.message || 'OpenRouter API error');
  }

  const data = await response.json();
  return data.choices?.[0]?.message?.content || '';
}

async function callMistralRaw(
  apiKey: string,
  model: string,
  messages: { role: string; content: string }[]
): Promise<string> {
  const response = await fetch('https://api.mistral.ai/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model,
      messages: messages.map(m => ({ role: m.role, content: m.content })),
      temperature: 0.85,
      max_tokens: 4000,
    }),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(error?.error?.message || 'Mistral AI API error');
  }

  const data = await response.json();
  return data.choices?.[0]?.message?.content || '';
}
export async function generateTest(
  config: TestConfig,
  provider: 'openrouter' | 'gemini' | 'mistral',
  model: string,
  apiKey: string,
  geminiApiKey: string,
  mistralApiKey: string,
  storedQuestions: StoredQuestion[],
  totalStoredCount?: number
): Promise<{ questions: Question[]; message: string | null }> {
  const prompt = buildPrompt(config, storedQuestions, totalStoredCount);
  const languageInstruction = getLanguageInstruction(config.language);
  const systemPrompt = `${SYSTEM_PROMPT}\n\nLANGUAGE: ${languageInstruction}`;

  let content: string;

  if (provider === 'gemini') {
    if (!geminiApiKey) throw new Error('Gemini API key is required');
    content = await callGemini(geminiApiKey, model, systemPrompt, prompt);
  } else if (provider === 'mistral') {
    if (!mistralApiKey) throw new Error('Mistral AI API key is required');
    content = await callMistral(mistralApiKey, model, systemPrompt, prompt);
  } else {
    if (!apiKey) throw new Error('OpenRouter API key is required');
    content = await callOpenRouter(apiKey, model, systemPrompt, prompt);
  }

  return parseQuestionsResponse(content, config);
}

export async function testModel(
  provider: 'openrouter' | 'gemini' | 'mistral',
  model: string,
  apiKey: string
): Promise<boolean> {
  try {
    if (provider === 'gemini') {
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(apiKey)}`;
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ role: 'user', parts: [{ text: 'Say OK' }] }],
          generationConfig: { maxOutputTokens: 10 },
        }),
      });
      return response.ok;
    } else if (provider === 'mistral') {
      const response = await fetch('https://api.mistral.ai/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model,
          messages: [{ role: 'user', content: 'Say OK' }],
          max_tokens: 10,
        }),
      });
      return response.ok;
    } else {
      const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model,
          messages: [{ role: 'user', content: 'Say OK' }],
          max_tokens: 10,
        }),
      });
      return response.ok;
    }
  } catch {
    return false;
  }
}

const DEFAULT_OPENROUTER_MODELS = [
  { value: 'meta-llama/llama-3.3-70b-instruct:free', label: 'Llama 3.3 70B Instruct' },
  { value: 'google/gemma-3-27b-it:free', label: 'Gemma 3 27B IT' },
  { value: 'google/gemma-3-12b-it:free', label: 'Gemma 3 12B IT' },
  { value: 'google/gemma-3-4b-it:free', label: 'Gemma 3 4B IT' },
  { value: 'google/gemma-2-9b-it:free', label: 'Gemma 2 9B IT' },
  { value: 'google/gemma-2-2b-it:free', label: 'Gemma 2 2B IT' },
  { value: 'qwen/qwen3-32b:free', label: 'Qwen 3 32B' },
  { value: 'qwen/qwen3-14b:free', label: 'Qwen 3 14B' },
  { value: 'qwen/qwen3-8b:free', label: 'Qwen 3 8B' },
  { value: 'qwen/qwen3-4b:free', label: 'Qwen 3 4B' },
  { value: 'qwen/qwen-2.5-72b-instruct:free', label: 'Qwen 2.5 72B Instruct' },
  { value: 'qwen/qwen-2.5-32b-instruct:free', label: 'Qwen 2.5 32B Instruct' },
  { value: 'qwen/qwen-2.5-14b-instruct:free', label: 'Qwen 2.5 14B Instruct' },
  { value: 'qwen/qwen-2.5-7b-instruct:free', label: 'Qwen 2.5 7B Instruct' },
  { value: 'mistralai/mistral-small-3.1-24b-instruct:free', label: 'Mistral Small 3.1 24B' },
  { value: 'mistralai/mistral-small-3.1-9b-instruct:free', label: 'Mistral Small 3.1 9B' },
  { value: 'mistralai/mistral-7b-instruct:free', label: 'Mistral 7B Instruct' },
  { value: 'mistralai/mistral-saba-24b-instruct:free', label: 'Mistral Saba 24B' },
  { value: 'deepseek/deepseek-chat:free', label: 'DeepSeek Chat' },
  { value: 'deepseek/deepseek-r1-zero:free', label: 'DeepSeek R1 Zero' },
  { value: 'deepseek/deepseek-r1-distill-llama-70b:free', label: 'DeepSeek R1 Distill Llama 70B' },
  { value: 'microsoft/phi-3.5-mini-128k-instruct:free', label: 'Phi 3.5 Mini 128K' },
  { value: 'microsoft/phi-3-medium-128k-instruct:free', label: 'Phi 3 Medium 128K' },
  { value: 'cohere/command-r7b-12-2024:free', label: 'Cohere Command R7B' },
  { value: 'cohere/command-r:free', label: 'Cohere Command R' },
  { value: 'nvidia/llama-3.1-nemotron-nano-8b-v1:free', label: 'Nemotron Nano 8B' },
  { value: 'nvidia/llama-3.1-nemotron-70b-instruct:free', label: 'Nemotron 70B' },
  { value: 'sophosympatheia/rogue-rose-103b-v0.2:free', label: 'Rogue Rose 103B' },
  { value: 'cognitivecomputations/dolphin-llama-3.1-70b:free', label: 'Dolphin Llama 3.1 70B' },
  { value: 'cognitivecomputations/samantha-llama-3.1-8b:free', label: 'Samantha Llama 3.1 8B' },
];

const DEFAULT_MISTRAL_MODELS = [
  { value: 'mistral-small-latest', label: 'Mistral Small (Latest)' },
  { value: 'mistral-medium-latest', label: 'Mistral Medium (Latest)' },
  { value: 'mistral-large-latest', label: 'Mistral Large (Latest)' },
  { value: 'codestral-latest', label: 'Codestral (Latest)' },
  { value: 'open-mistral-nemo', label: 'Open Mistral Nemo' },
  { value: 'open-mistral-7b', label: 'Open Mistral 7B' },
  { value: 'open-mixtral-8x7b', label: 'Open Mixtral 8x7B' },
  { value: 'open-mixtral-8x22b', label: 'Open Mixtral 8x22B' },
];
const DEFAULT_GEMINI_MODELS = [
  { value: 'gemini-2.5-pro-exp-03-25', label: 'Gemini 2.5 Pro Exp' },
  { value: 'gemini-2.0-flash', label: 'Gemini 2.0 Flash' },
  { value: 'gemini-2.0-flash-lite-preview-02-05', label: 'Gemini 2.0 Flash Lite Preview' },
  { value: 'gemini-2.0-flash-lite', label: 'Gemini 2.0 Flash Lite' },
  { value: 'gemini-1.5-flash', label: 'Gemini 1.5 Flash' },
  { value: 'gemini-1.5-flash-8b', label: 'Gemini 1.5 Flash 8B' },
  { value: 'gemini-1.5-pro', label: 'Gemini 1.5 Pro' },
];

export async function fetchAvailableModels(
  provider: 'openrouter' | 'gemini' | 'mistral',
  apiKey: string
): Promise<{ value: string; label: string }[]> {
  const defaults = provider === 'openrouter' ? DEFAULT_OPENROUTER_MODELS : provider === 'gemini' ? DEFAULT_GEMINI_MODELS : DEFAULT_MISTRAL_MODELS;
  try {
    if (provider === 'openrouter') {
      // OpenRouter models API can work without auth for listing
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (apiKey) headers['Authorization'] = `Bearer ${apiKey}`;
      const response = await fetch('https://openrouter.ai/api/v1/models', { headers });
      if (response.ok) {
        const data = await response.json();
        const freeModels = (data.data || [])
          .filter((m: any) => m.id?.includes(':free'))
          .map((m: any) => ({ value: m.id, label: m.name || m.id }));
        if (freeModels.length > 0) {
          // MERGE defaults WITH API models to get ALL free models
          // Put defaults FIRST so they always appear even if the API fetch changes
          const seen = new Set<string>();
          const merged: { value: string; label: string }[] = [];
          // First add all defaults
          for (const m of defaults) {
            if (!seen.has(m.value)) {
              seen.add(m.value);
              merged.push(m);
            }
          }
          // Then add any API models not already in the defaults list
          for (const m of freeModels) {
            if (!seen.has(m.value)) {
              seen.add(m.value);
              merged.push(m);
            }
          }
          return merged;
        }
      }
    } else if (provider === 'gemini') {
      if (!apiKey) return DEFAULT_GEMINI_MODELS;
      // Fetch available Gemini models via the list API
      const url = `https://generativelanguage.googleapis.com/v1beta/models?key=${encodeURIComponent(apiKey)}`;
      const response = await fetch(url);
      if (response.ok) {
        const data = await response.json();
        const geminiModels = (data.models || [])
          .filter((m: any) => {
            const name = m.name?.replace('models/', '') || '';
            return name.startsWith('gemini-') && m.supportedGenerationMethods?.includes('generateContent');
          })
          .map((m: any) => ({
            value: m.name.replace('models/', ''),
            label: m.displayName || m.name.replace('models/', ''),
          }));
        if (geminiModels.length > 0) {
          // MERGE defaults WITH API models to ensure all models appear
          const seen = new Set<string>();
          const merged: { value: string; label: string }[] = [];
          for (const m of defaults) {
            if (!seen.has(m.value)) {
              seen.add(m.value);
              merged.push(m);
            }
          }
          for (const m of geminiModels) {
            if (!seen.has(m.value)) {
              seen.add(m.value);
              merged.push(m);
            }
          }
          return merged;
        }
      }
    } else if (provider === 'mistral') {
      // Mistral AI models - use defaults as they're stable
      return DEFAULT_MISTRAL_MODELS;
    }
  } catch {}
  // Fallback: use comprehensive defaults
  return defaults;
}






