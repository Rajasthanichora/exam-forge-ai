import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, ActivityIndicator, ScrollView, Alert, TextInput, AppState
} from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Clipboard from 'expo-clipboard';
import { Ionicons } from '@expo/vector-icons';
import { Question, TestConfig, TestResult, SimilarityReport, Section, SavedDocument, Group, Difficulty, Language } from '../lib/types';
import { useTheme, Spacing, BorderRadius, FontSize } from '../lib/theme';
import Header from '../components/Header';
import SectionSidebar from '../components/SectionSidebar';
import QuizInterface from '../components/QuizInterface';
import TestResults from '../components/TestResults';
import SectionHistory from '../components/SectionHistory';
import SimilarityIndicator from '../components/SimilarityIndicator';
import {
  initializeData,
  createSection, getAllSections, getSection, setActiveSection,
  renameSection, deleteSection,
  addDocumentToSection, removeDocumentFromSection, updateSectionNotes,
  saveTestResultToSection, updateTestResultInSection,
  renameTestResult, deleteTestResult,
  generateSimilarityReportForSection, getSectionStats, clearSectionData,
  getAllGroups, createGroup as storeCreateGroup, renameGroup, deleteGroup,
} from '../lib/section-store';
import { generateTest } from '../lib/api';
import { AppStorage, getItem } from '../lib/storage';
import { persistLog } from '../lib/logs';
import { generateScoreReport } from '../lib/score-report';

const DEFAULT_OR_MODEL = 'meta-llama/llama-3.3-70b-instruct:free';
const DEFAULT_GEMINI_MODEL = 'gemini-2.0-flash';

type AppView = 'config' | 'quiz' | 'results' | 'history' | 'similarity';
export default function HomeScreen() {
  const router = useRouter();
  const { colors: C } = useTheme();
  const [view, setView] = useState<AppView>('config');
  const [isLoading, setIsLoading] = useState(false);
  const [isDataLoading, setIsDataLoading] = useState(true);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [answers, setAnswers] = useState<Record<string, number>>({});
  const [currentConfig, setCurrentConfig] = useState<TestConfig | null>(null);
  const [timeTaken, setTimeTaken] = useState(0);
  const [similarityReport, setSimilarityReport] = useState<SimilarityReport | null>(null);
  const [aiUniqueMessage, setAiUniqueMessage] = useState<string | null>(null);
  const [retakingTestId, setRetakingTestId] = useState<string | null>(null);

  const [apiKey, setApiKey] = useState('');
  const [geminiApiKey, setGeminiApiKey] = useState('');
  const [mistralApiKey, setMistralApiKey] = useState('');
  const [aiProvider, setAiProvider] = useState<'openrouter' | 'gemini' | 'mistral'>('openrouter');
  const [openRouterModel, setOpenRouterModel] = useState(DEFAULT_OR_MODEL);
  const [geminiModel, setGeminiModel] = useState(DEFAULT_GEMINI_MODEL);
  const [mistralModel, setMistralModel] = useState('mistral-small-latest');

  const [sections, setSections] = useState<Section[]>([]);
  const [groups, setGroups] = useState<Group[]>([]);
  const [activeSectionId, setActiveSectionIdState] = useState<string | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const [savedDocuments, setSavedDocuments] = useState<SavedDocument[]>([]);
  const [pastedNotes, setPastedNotes] = useState('');
  const [selectedDocIds, setSelectedDocIds] = useState<string[]>([]);

  // AI Test Generate state
  const [aiDifficulty, setAiDifficulty] = useState<Difficulty>('medium');
  const [aiTestExpanded, setAiTestExpanded] = useState(false);
  const [aiCount, setAiCount] = useState(20);
  const [aiLanguage, setAiLanguage] = useState<Language>('english');
  const [customPrompt, setCustomPrompt] = useState('');
  const [oneLinerMode, setOneLinerMode] = useState(false);

  // Manual Test Generate state
  const [manualLanguage, setManualLanguage] = useState<Language>('english');
  const [manualDifficulty, setManualDifficulty] = useState<Difficulty>('medium');
  const [manualCount, setManualCount] = useState(20);
  const [manualOneLinerMode, setManualOneLinerMode] = useState(false);
  const [pastedManualJson, setPastedManualJson] = useState('');
  const [manualParseError, setManualParseError] = useState<string | null>(null);

  // Logs centralized in Settings screen

  const logAction = (text: string, color?: string) => {
    persistLog('home', text, color);
  };

  // Check for pending retake from results-history
  const checkForRetake = useCallback(async () => {
    try {
      const retakeData = await AsyncStorage.getItem('examforge_retake_test');
      if (retakeData) {
        await AsyncStorage.removeItem('examforge_retake_test');
        await AsyncStorage.removeItem('examforge_retake_pending');
        const parsed = JSON.parse(retakeData);
        if (parsed.testId && parsed.sectionId) {
          const section = getSection(parsed.sectionId);
          if (section) {
            const test = section.testResults.find((t: any) => t.id === parsed.testId);
            if (test) {
              setActiveSectionIdState(parsed.sectionId);
              await setActiveSection(parsed.sectionId);
              setTimeout(() => {
                setQuestions(test.questions);
                setAnswers({});
                setCurrentConfig(test.config);
                setRetakingTestId(test.id);
                setView('quiz');
                logAction(`Retaking test: "${test.name}" from results history.`, '#10B981');
              }, 300);
              return true;
            } else {
              logAction('Retake failed: test not found in section.', '#F43F5E');
            }
          } else {
            logAction('Retake failed: section not found.', '#F43F5E');
          }
        }
      }
    } catch {
      logAction('Retake failed: could not process retake data.', '#F43F5E');
    }
    return false;
  }, []);

  const activeSection = activeSectionId ? getSection(activeSectionId) : null;
  const sectionStats = activeSectionId ? getSectionStats(activeSectionId) : null;

  // Content from saved docs + pasted notes
  const totalContent = useMemo(() => {
    const savedContent = savedDocuments
      .filter(doc => selectedDocIds.includes(doc.id))
      .map(doc => doc.content).join('\n\n---\n\n');
    const pastedContent = pastedNotes?.trim() || '';
    if (savedContent && pastedContent) return `${savedContent}\n\n---\n\n${pastedContent}`;
    return savedContent || pastedContent;
  }, [savedDocuments, selectedDocIds, pastedNotes]);

  const hasContent = totalContent.trim().length > 0;
  const hasApiKey = aiProvider === 'gemini' ? !!geminiApiKey : aiProvider === 'mistral' ? !!mistralApiKey : !!apiKey;

  // Manual test prompt - built from backend settings and loaded study material
  const manualPrompt = useMemo(() => {
    const diffDesc = manualDifficulty === 'easy'
      ? 'Create straightforward questions focusing on basic recall and fundamental concepts. Suitable for beginners and quick revision.'
      : manualDifficulty === 'medium'
      ? 'Create moderately challenging questions designed for competitive government exam preparation, focusing on conceptual understanding, application, and exam-style reasoning. Include questions that test analytical thinking, elimination skills, and connection of related ideas.'
      : 'Create highly challenging questions that test deep understanding, analytical reasoning, and advanced problem-solving. Include multi-step questions, data interpretation, and critical thinking scenarios typical of top-tier competitive exams.';

    const langLabel = manualLanguage === 'hindi' ? 'Hindi' : manualLanguage === 'hinglish' ? 'Hinglish' : 'English';

    let text = `Generate ${manualCount} UNIQUE multiple-choice questions.\n\n`;
    text += `DIFFICULTY LEVEL: ${manualDifficulty.toUpperCase()}\n`;
    text += `${diffDesc}\n\n`;
    text += `QUESTION FORMAT: ${manualOneLinerMode ? 'ONE LINER' : 'STANDARD DETAILED FORMAT'}\n\n`;
    text += `LANGUAGE: ${langLabel}\n\n`;
    text += `=== INSTRUCTIONS ===\n`;
    text += `Based on the study material you provide:\n`;
    text += `1. Generate exactly ${manualCount} unique questions\n`;
    text += `2. Each question must have exactly 4 options (A, B, C, D)\n`;
    text += `3. Only one option should be correct\n`;
    text += `4. Include an explanation for each answer\n`;
    text += `5. Add a topic tag for each question\n`;
    text += `6. Do NOT repeat any concepts across questions\n`;
    text += `7. IMPORTANT: Randomize the position of correct answers across all questions. Do NOT place correct answers only in positions 0, 1, or 2. Distribute correct answers randomly among indices 0, 1, 2, and 3 for different questions.\n\n`;
    text += `OUTPUT FORMAT - Return ONLY valid JSON:\n{\n  "questions": [\n    {\n      "question": "What is the capital of France?",\n      "options": ["London", "Paris", "Berlin", "Madrid"],\n      "correctAnswer": 1,\n      "explanation": "Paris has been the capital of France since...",\n      "topic": "Geography"\n    }\n  ]\n}`;
    return text;
  }, [manualOneLinerMode, manualCount, manualDifficulty, manualLanguage]);
  const handleManualGenerate = () => {
    setManualParseError(null);
    if (!activeSectionId) return;
    logAction('Processing manual test generation...', C.primary);
    try {
      const trimmed = pastedManualJson.trim();
      let parsed: any;
      try { parsed = JSON.parse(trimmed); }
      catch {
        const jsonMatch = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/);
        if (jsonMatch) parsed = JSON.parse(jsonMatch[1].trim());
        else throw new Error('Invalid JSON format');
      }
      let questionsData: any[];
      if (parsed.questions && Array.isArray(parsed.questions)) questionsData = parsed.questions;
      else if (Array.isArray(parsed)) questionsData = parsed;
      else throw new Error('Response must contain a "questions" array');
      if (questionsData.length === 0) throw new Error('No questions found');
      const maxCount = Math.min(manualCount, 200);
      const validated: Question[] = questionsData.slice(0, maxCount).map((q: any, i: number) => ({
        id: `q-manual-${Date.now()}-${i}`,
        question: String(q.question || ''),
        options: Array.isArray(q.options) ? q.options.map(String) : [],
        correctAnswer: typeof q.correctAnswer === 'number' ? q.correctAnswer : 0,
        explanation: String(q.explanation || ''),
        difficulty: manualDifficulty,
        topic: String(q.topic || 'General'),
      })).filter((q: Question) => q.question && q.options.length === 4);
      if (validated.length === 0) throw new Error('No valid questions with 4 options found');
      logAction(`Manual test: ${validated.length} questions parsed successfully.`, '#10B981');
      handleManualTestGenerate(validated, {
        studyNotes: '', difficulty: manualDifficulty, questionCount: validated.length, language: manualLanguage, customPrompt: '', oneLinerMode: manualOneLinerMode, sectionName: activeSection?.name || 'Section',
      });
      setPastedManualJson('');
    } catch (err: any) {
      setManualParseError(err.message);
      logAction(`Manual test parse error: ${err.message}`, '#F43F5E');
    }
  };

  useEffect(() => {
    (async () => {
      const data = await initializeData();
      setGroups(data.groups);
      setSections(data.sections);
      setActiveSectionIdState(data.activeSectionId || data.sections[0]?.id || null);

      const orKey = await AppStorage.getOpenRouterKey() || '';
      const mKey = await AppStorage.getMistralKey() || '';
      const gKey = await AppStorage.getGeminiKey() || '';
      const provider = await AppStorage.getAiProvider();
      const orModel = await AppStorage.getOpenRouterModel() || DEFAULT_OR_MODEL;
      const gModel = await AppStorage.getGeminiModel() || DEFAULT_GEMINI_MODEL;
      const mMistralModel = await AppStorage.getMistralModel() || 'mistral-small-latest';

      setApiKey(orKey);
      setGeminiApiKey(gKey);
      setMistralApiKey(mKey);
      setAiProvider(provider);
      setOpenRouterModel(orModel);
      setGeminiModel(gModel);
      setMistralModel(mMistralModel);

      // Load AI Test Configuration settings from settings page
      try {
        const savedConfigNotes = await getItem('examforge_ai_config_notes');
        const savedConfigDifficulty = await getItem('examforge_ai_config_difficulty');
        const savedConfigCount = await getItem('examforge_ai_config_count');
        const savedCustomPrompt = await getItem('examforge_ai_custom_prompt');
        const savedOneLiner = await getItem('examforge_ai_one_liner');
        const savedDocIds = await getItem('examforge_ai_selected_doc_ids');
        const savedDocumentsData = await getItem('examforge_ai_saved_documents');

        // Load documents from settings if available
        if (savedDocumentsData) {
          try {
            const docs = JSON.parse(savedDocumentsData);
            if (Array.isArray(docs) && docs.length > 0) {
              setSavedDocuments(docs);
            }
          } catch (e) {}
        }

        if (savedConfigNotes) setPastedNotes(savedConfigNotes);
        if (savedConfigDifficulty) setAiDifficulty(savedConfigDifficulty as Difficulty);
        if (savedConfigCount) setAiCount(parseInt(savedConfigCount, 10) || 20);
        if (savedCustomPrompt) setCustomPrompt(savedCustomPrompt);
        if (savedOneLiner) setOneLinerMode(savedOneLiner === 'true');
        if (savedDocIds) {
          try {
            const ids = JSON.parse(savedDocIds);
            if (Array.isArray(ids)) setSelectedDocIds(ids);
          } catch (e) {}
        }
        // Load Manual Test Configuration settings
        const savedManualLanguage = await getItem('examforge_manual_config_language');
        const savedManualDifficulty = await getItem('examforge_manual_config_difficulty');
        const savedManualCount = await getItem('examforge_manual_config_count');
        if (savedManualLanguage) setManualLanguage(savedManualLanguage as Language);
        if (savedManualDifficulty) setManualDifficulty(savedManualDifficulty as Difficulty);
        if (savedManualCount) setManualCount(parseInt(savedManualCount, 10) || 20);
        logAction('Manual config settings loaded from storage.', '#10B981');
      } catch (e) {
        // Ignore loading errors
      }

      logAction('Application initialized.', '#10B981');

      // Check for pending retake from results-history
      await checkForRetake();

      setIsDataLoading(false);
    })();
  }, []);

  // Reload settings from AsyncStorage when screen regains focus (e.g., returning from settings page)
  useFocusEffect(
    useCallback(() => {
      // Skip on initial mount (data already loaded)
      if (isDataLoading) return;
      (async () => {
        try {
          const savedConfigNotes = await getItem('examforge_ai_config_notes');
          const savedDocIds = await getItem('examforge_ai_selected_doc_ids');
          const savedDocumentsData = await getItem('examforge_ai_saved_documents');
          const savedConfigDifficulty = await getItem('examforge_ai_config_difficulty');
          const savedConfigCount = await getItem('examforge_ai_config_count');
          const savedCustomPrompt = await getItem('examforge_ai_custom_prompt');
          const savedOneLiner = await getItem('examforge_ai_one_liner');
          const savedManualLanguage = await getItem('examforge_manual_config_language');
          const savedManualDifficulty = await getItem('examforge_manual_config_difficulty');
          const savedManualCount = await getItem('examforge_manual_config_count');

          // Reload API keys from storage (user may have updated them in settings)
          const orKey = await AppStorage.getOpenRouterKey() || '';
      const mKey = await AppStorage.getMistralKey() || '';
          const gKey = await AppStorage.getGeminiKey() || '';
          if (orKey !== apiKey) setApiKey(orKey);
          if (gKey !== geminiApiKey) setGeminiApiKey(gKey);
      setMistralApiKey(mKey);

          if (savedDocumentsData) {
            try {
              const docs = JSON.parse(savedDocumentsData);
              if (Array.isArray(docs) && docs.length > 0) {
                setSavedDocuments(docs);
              }
            } catch (e) {}
          }
          if (savedConfigNotes) setPastedNotes(savedConfigNotes);
          if (savedConfigDifficulty) setAiDifficulty(savedConfigDifficulty as Difficulty);
          if (savedConfigCount) setAiCount(parseInt(savedConfigCount, 10) || 20);
          if (savedCustomPrompt) setCustomPrompt(savedCustomPrompt);
          if (savedOneLiner) setOneLinerMode(savedOneLiner === 'true');
          if (savedDocIds) {
            try {
              const ids = JSON.parse(savedDocIds);
              if (Array.isArray(ids)) setSelectedDocIds(ids);
            } catch (e) {}
          }
          if (savedManualLanguage) setManualLanguage(savedManualLanguage as Language);
          if (savedManualDifficulty) setManualDifficulty(savedManualDifficulty as Difficulty);
          if (savedManualCount) setManualCount(parseInt(savedManualCount, 10) || 20);
          logAction('Settings reloaded from storage on focus.', '#10B981');
          // Check for pending retake when returning from results-history screen
          await checkForRetake();
        } catch (e) {
          // Ignore reload errors
        }
      })();
    }, [isDataLoading, checkForRetake])
  );

  // Listen for retake data when app becomes active (from results-history)
  useEffect(() => {
    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') {
        checkForRetake();
      }
    });
    return () => {
      subscription.remove();
    };
  }, [checkForRetake]);

  useEffect(() => {
    if (activeSectionId) {
      const section = getSection(activeSectionId);
      if (section) {
        // Merge saved documents: start with section docs, then add any from settings that aren't already in section
        setSavedDocuments(prev => {
          const sectionDocIds = new Set(section.savedDocuments.map(d => d.id));
          const merged = [...section.savedDocuments];
          // Add settings docs that aren't already in section
          for (const doc of prev) {
            if (!sectionDocIds.has(doc.id)) {
              merged.push(doc);
            }
          }
          return merged;
        });
        // Only set pasted notes from section if there's no settings notes loaded
        setPastedNotes(prev => prev || section.pastedNotes || '');
        // Only auto-select if no documents are already selected
        setSelectedDocIds(prev => {
          if (prev.length === 0 && section.savedDocuments.length > 0) {
            logAction(`Auto-selected ${section.savedDocuments.length} document(s) for test generation.`, '#10B981');
            return section.savedDocuments.map(d => d.id);
          }
          return prev;
        });
      }
    }
  }, [activeSectionId]);

  const handleSelectSection = async (sectionId: string) => {
    await setActiveSection(sectionId);
    setActiveSectionIdState(sectionId);
    setView('config');
    setSidebarOpen(false);
    setQuestions([]);
    setAnswers({});
    setCurrentConfig(null);
    setSimilarityReport(null);
    const section = getSection(sectionId);
    logAction(`Switched to section: "${section?.name || sectionId}"`, '#10B981');
  };

  const handleCreateSection = async (name: string, groupId: string) => {
    const newSection = await createSection(name, groupId);
    setSections(getAllSections());
    setActiveSectionIdState(newSection.id);
    logAction(`Section created: "${name}"`, '#10B981');
  };

  const handleCreateGroup = async (name: string) => {
    await storeCreateGroup(name);
    setGroups(getAllGroups());
  };

  const handleDeleteGroup = async (groupId: string) => {
    await deleteGroup(groupId);
    setGroups(getAllGroups());
    setSections(getAllSections());
  };

  const handleRenameGroup = async (groupId: string, newName: string) => {
    await renameGroup(groupId, newName);
    setGroups(getAllGroups());
  };

  const handleSaveDocument = async (doc: { name: string; content: string; size: number }) => {
    if (!activeSectionId) return;
    const savedDoc = await addDocumentToSection(activeSectionId, doc);
    setSavedDocuments(prev => [...prev, savedDoc]);
    logAction(`Document saved to section: "${doc.name}"`, '#10B981');
  };

  const handleRemoveDocument = async (docId: string) => {
    if (!activeSectionId) return;
    const doc = savedDocuments.find(d => d.id === docId);
    await removeDocumentFromSection(activeSectionId, docId);
    setSavedDocuments(prev => prev.filter(d => d.id !== docId));
    if (doc) logAction(`Document removed: "${doc.name}"`, '#F43F5E');
  };

  const handleSelectDocuments = (docs: SavedDocument[]) => {
    setSelectedDocIds(docs.map(d => d.id));
    if (docs.length > 0) {
      logAction(`Selected ${docs.length} document(s) for test.`, '#10B981');
    } else {
      logAction('All documents deselected.', '#F59E0B');
    }
  };

  const handleNotesChange = useCallback((notes: string) => {
    setPastedNotes(notes);
    if (activeSectionId) updateSectionNotes(activeSectionId, notes);
  }, [activeSectionId]);

  const handleStartTest = async (config: TestConfig) => {
    if (!activeSectionId || !activeSection) return;
    setIsLoading(true);
    logAction(`Starting AI test generation for "${activeSection.name}"...`, C.primary);

    const latestApiKey = await AppStorage.getOpenRouterKey() || apiKey || '';
    const latestGeminiKey = await AppStorage.getGeminiKey() || geminiApiKey || '';
    const latestMistralKey = await AppStorage.getMistralKey() || mistralApiKey || '';
    const latestProvider = await AppStorage.getAiProvider();
    const latestORModel = await AppStorage.getOpenRouterModel() || openRouterModel || DEFAULT_OR_MODEL;
    const latestGModel = await AppStorage.getGeminiModel() || geminiModel || DEFAULT_GEMINI_MODEL;
    const latestMistralModel = await AppStorage.getMistralModel() || mistralModel || 'mistral-small-latest';

    logAction(`Provider: ${latestProvider}, Model: ${latestProvider === 'gemini' ? latestGModel : latestProvider === 'mistral' ? latestMistralModel : latestORModel}`, C.warning);
    logAction(`Config: Difficulty=${config.difficulty}, Count=${config.questionCount}, Language=${config.language}`, C.warning);

    const enhancedConfig: TestConfig = {
      ...config,
      aiModel: latestProvider === 'gemini' ? latestGModel : latestProvider === 'mistral' ? latestMistralModel : latestORModel,
      sectionId: activeSectionId,
      sectionName: activeSection.name,
    };
    setCurrentConfig(enhancedConfig);

    const allStored = activeSection.storedQuestions;
    const storedQuestions = allStored.slice(0, 20);

    try {
      logAction('Sending request to AI provider...', C.primary);
      const result = await generateTest(
        enhancedConfig, latestProvider, enhancedConfig.aiModel!,
        latestApiKey, latestGeminiKey, latestMistralKey, storedQuestions, allStored.length,
      );

      logAction(`AI response received: ${result.questions.length} questions generated.`, '#10B981');

      const questionTexts = result.questions.map(q => q.question);
      const report = generateSimilarityReportForSection(activeSectionId, questionTexts);
      setSimilarityReport(report);

      setQuestions(result.questions);
      setAnswers({});
      setAiUniqueMessage(result.message);

      if (result.message) {
        logAction(`AI Message: ${result.message}`, '#F59E0B');
      }

      if (storedQuestions.length > 0) {
        logAction(`Similarity check: ${report.uniqueQuestions}/${report.totalNewQuestions} unique`, '#10B981');
        setView('similarity');
      } else {
        logAction('No stored questions to compare — proceeding to quiz.', '#10B981');
        setView('quiz');
      }
    } catch (error: any) {
      logAction(`Test generation failed: ${error.message}`, '#F43F5E');
      if (error.message === 'GEMINI_QUOTA_EXCEEDED' && latestApiKey) {
        try {
          logAction('Gemini quota exceeded. Falling back to OpenRouter...', '#F59E0B');
          const fallbackResult = await generateTest(
            { ...enhancedConfig, aiModel: latestORModel }, 'openrouter', latestORModel,
            latestApiKey, latestGeminiKey, latestMistralKey, storedQuestions, activeSection.storedQuestions.length,
          );
          setAiProvider('openrouter');
          await AppStorage.setAiProvider('openrouter');
          const qt = fallbackResult.questions.map((q: any) => q.question);
          const report = generateSimilarityReportForSection(activeSectionId, qt);
          setSimilarityReport(report);
          setQuestions(fallbackResult.questions);
          setAnswers({});
          setAiUniqueMessage(fallbackResult.message);
          logAction('Fallback to OpenRouter successful.', '#10B981');
          setView('similarity');
        } catch (fallbackError: any) {
          logAction(`Fallback also failed: ${fallbackError.message}`, '#F43F5E');
          Alert.alert('Error', error.message || 'Failed to generate test');
        }
      } else {
        Alert.alert('Error', error.message || 'Failed to generate test');
      }
    } finally {
      setIsLoading(false);
      logAction('Test generation process complete.', '#10B981');
    }
  };

  const handleStartQuizFromSimilarity = () => { setView('quiz'); }

  const handleQuizComplete = async (userAnswers: Record<string, number>, time: number) => {
    if (!activeSectionId || !currentConfig) return;
    setAnswers(userAnswers);
    setTimeTaken(time);

    const correctCount = questions.filter(q => userAnswers[q.id] === q.correctAnswer).length;
    const totalTime = time;
    logAction(`Quiz completed: ${correctCount}/${questions.length} correct (${Math.round((correctCount / questions.length) * 100)}%) in ${Math.floor(totalTime / 60)}m ${totalTime % 60}s`, C.warning);

    if (retakingTestId) {
      const section = getSection(activeSectionId);
      const existing = section?.testResults.find(t => t.id === retakingTestId);
      if (existing) {
        const updated = {
          ...existing,
          date: new Date().toISOString(),
          answers: userAnswers,
          score: correctCount,
          timeTaken: time,
          scoreReport: generateScoreReport({
            ...existing,
            date: new Date().toISOString(),
            answers: userAnswers,
            score: correctCount,
            timeTaken: time,
            questions: existing.questions,
            config: existing.config,
          }),
        };
        await updateTestResultInSection(activeSectionId, retakingTestId, updated);
        logAction(`Retake test updated: "${existing.name}"`, '#10B981');
      }
      setRetakingTestId(null);
    } else {
      const result: TestResult = {
        id: `test-${Date.now()}`,
        name: `Test - ${new Date().toLocaleDateString()}`,
        date: new Date().toISOString(),
        config: currentConfig,
        questions,
        answers: userAnswers,
        score: correctCount,
        totalQuestions: questions.length,
        timeTaken: time,
      };
      result.scoreReport = generateScoreReport(result);
      await saveTestResultToSection(activeSectionId, result);
      logAction(`Test result saved: "${result.name}"`, '#10B981');
    }
    setSections(getAllSections());
    setView('results');
  };

  const handleRetry = () => {
    setAnswers({}); setView('quiz');
    logAction('Retrying current test...', '#10B981');
  };
  const handleNewTest = () => {
    setQuestions([]); setAnswers({}); setCurrentConfig(null);
    setSimilarityReport(null); setAiUniqueMessage(null); setView('config');
    setRetakingTestId(null);
    logAction('Starting new test configuration.', '#10B981');
  };

  const handleShowHistory = () => {
    router.push('/results-history' as any);
  };
  const handleCloseHistory = () => { setView('config'); }

  const handleRenameTest = async (testId: string, newName: string) => {
    if (!activeSectionId) return;
    await renameTestResult(activeSectionId, testId, newName);
    setSections(getAllSections());
  };

  const handleDeleteTest = async (testId: string) => {
    if (!activeSectionId) return;
    await deleteTestResult(activeSectionId, testId);
    setSections(getAllSections());
  };

  const handleRetakeTest = (test: TestResult) => {
    setQuestions(test.questions);
    setAnswers({});
    setCurrentConfig(test.config);
    setRetakingTestId(test.id);
    setView('quiz');
  };

  const handleClearAll = async () => {
    if (!activeSectionId) return;
    await clearSectionData(activeSectionId);
    setSections(getAllSections());
    setSavedDocuments([]);
    setSelectedDocIds([]);
    logAction('All section data cleared (documents, questions, history).', '#F43F5E');
  };

  const handleManualTestGenerate = (questions: Question[], config: TestConfig) => {
    if (!activeSectionId) return;
    setCurrentConfig(config);
    setQuestions(questions);
    setAnswers({});
    setRetakingTestId(null);
    const qTexts = questions.map(q => q.question);
    const report = generateSimilarityReportForSection(activeSectionId, qTexts);
    setSimilarityReport(report);
    const section = getSection(activeSectionId);
    logAction(`Manual test: ${questions.length} questions ready for section "${section?.name}"`, '#10B981');
    setView(section && section.storedQuestions.length > 0 ? 'similarity' : 'quiz');
  };

  if (isDataLoading) {
    return (
      <View style={[styles.loading, { backgroundColor: C.background }]}>
        <ActivityIndicator size="large" color={C.primary} />
        <Text style={{ fontSize: FontSize.md, color: C.mutedForeground }}>Loading your data...</Text>
      </View>
    );
  }

  const s = makeStyles(C);

  return (
    <View style={[s.container, { backgroundColor: C.background }]}>
      <Header
        sectionName={activeSection?.name}
        onShowHistory={handleShowHistory}
        onOpenSidebar={() => { setSidebarOpen(true); }}
      />

      <SectionSidebar
        groups={groups}
        sections={sections}
        activeSectionId={activeSectionId}
        onSelectSection={handleSelectSection}
        onCreateSection={handleCreateSection}
        onRenameSection={async (id, name) => { await renameSection(id, name); setSections(getAllSections()); }}
        onDeleteSection={async (id) => {
          await deleteSection(id);
          const updated = getAllSections();
          setSections(updated);
          if (id === activeSectionId) setActiveSectionIdState(updated[0]?.id || null);
        }}
        onCreateGroup={handleCreateGroup}
        onRenameGroup={handleRenameGroup}
        onDeleteGroup={handleDeleteGroup}
        isOpen={sidebarOpen}
        onClose={() => { setSidebarOpen(false); }}
      />

      <ScrollView style={s.content} contentContainerStyle={[s.contentInner, { paddingBottom: Spacing.xxxl * 2 }]}>
        {view === 'config' && (
          <>
            <View style={{ gap: Spacing.lg }}>
              <View style={{ gap: Spacing.sm }}>
                <Text style={{ fontSize: FontSize.xxl, fontWeight: 'bold', color: C.foreground, textAlign: 'center' }}>
                  {activeSection?.name || 'AI-Powered Test Generator'}
                </Text>
                <Text style={{ fontSize: FontSize.md, color: C.mutedForeground, textAlign: 'center', lineHeight: 22 }}>
                  Transform your study notes into unique practice tests. Each section maintains its own memory.
                </Text>
              </View>

              {sectionStats && (
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.md }}>
                  {[
                    { icon: 'bar-chart-outline' as const, label: 'Tests Taken', value: sectionStats.totalTests, color: C.primary },
                    { icon: 'trophy-outline' as const, label: 'Avg Score', value: `${sectionStats.averageScore}%`, color: '#10B981' },
                    { icon: 'layers-outline' as const, label: 'Questions Tracked', value: sectionStats.questionsStored, color: C.warning },
                    { icon: 'document-text-outline' as const, label: 'Saved Docs', value: sectionStats.documentsCount, color: C.primary },
                  ].map((stat, i) => (
                    <View key={i} style={[s.statCard, { width: '48%', backgroundColor: C.card, borderColor: C.border }]}>
                      <Ionicons name={stat.icon} size={16} color={stat.color} />
                      <Text style={{ fontSize: FontSize.xxl, fontWeight: 'bold', color: C.foreground }}>{stat.value}</Text>
                      <Text style={{ fontSize: FontSize.xs, color: C.mutedForeground }}>{stat.label}</Text>
                    </View>
                  ))}
                </View>
              )}

              {/* AI Test Generate Section */}
              <View style={[styles.aiTestCard, { backgroundColor: C.card, borderColor: C.border }]}>
                <TouchableOpacity
                  style={[styles.sectionHeaderTest, { borderBottomColor: C.border }]}
                  onPress={() => setAiTestExpanded(!aiTestExpanded)}
                  activeOpacity={0.7}
                >
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: Spacing.md, flex: 1 }}>
                    <View style={[styles.aiIconBox, { backgroundColor: '#10B981' + '15' }]}>
                      <Ionicons name="sparkles-outline" size={20} color="#10B981" />
                    </View>
                    <Text style={[styles.aiSectionTitle, { color: C.foreground }]} numberOfLines={1}>AI Test Generate</Text>
                  </View>
                  <Ionicons name={aiTestExpanded ? "chevron-up" : "chevron-down"} size={20} color={C.mutedForeground} />
                </TouchableOpacity>
                {aiTestExpanded && (
                <View style={{ gap: Spacing.md, padding: Spacing.md }}>
                  {/* Custom Instructions */}
                  <View>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                      <Ionicons name="create-outline" size={14} color={C.primary} />
                      <Text style={[styles.fieldLabel, { color: C.mutedForeground }]}>Custom Instruction (optional)</Text>
                    </View>
                    <TextInput
                      style={[styles.aiTextArea, { backgroundColor: C.background, borderColor: C.border, color: C.foreground }]}
                      multiline
                      placeholder="Add specific instructions for the AI..."
                      placeholderTextColor={C.mutedForeground + '60'}
                      value={customPrompt}
                      onChangeText={setCustomPrompt}
                      textAlignVertical="top"
                    />
                  </View>
                  {/* One-Liner Mode + Generate */}
                  <View style={[styles.switchCard, { backgroundColor: C.muted + '60', borderColor: C.border }]}>
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.switchLabel, { color: C.foreground }]}>One-liner Mode</Text>
                      <Text style={[styles.switchDesc, { color: C.mutedForeground }]}>Short, concise questions only</Text>
                    </View>
                    <TouchableOpacity
                      style={[styles.customToggle, oneLinerMode ? { backgroundColor: '#10B981' } : { backgroundColor: C.muted, borderColor: C.border }]}
                      onPress={() => setOneLinerMode(!oneLinerMode)}
                    >
                      <View style={[styles.customToggleDot, oneLinerMode ? { transform: [{ translateX: 16 }] } : {}]} />
                    </TouchableOpacity>
                  </View>
                  {/* Saved Documents Status */}
                  {savedDocuments.length > 0 && (
                    <View style={{ gap: Spacing.xs }}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                        <Ionicons name="folder-outline" size={14} color={C.primary} />
                        <Text style={[styles.fieldLabel, { color: C.mutedForeground }]}>Study Documents</Text>
                      </View>
                      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.xs }}>
                        {savedDocuments.map(doc => (
                          <TouchableOpacity
                            key={doc.id}
                            style={{
                              flexDirection: 'row', alignItems: 'center', gap: 4,
                              paddingVertical: Spacing.xs, paddingHorizontal: Spacing.sm,
                              borderRadius: BorderRadius.md, borderWidth: 1,
                              borderColor: selectedDocIds.includes(doc.id) ? C.primary : C.border,
                              backgroundColor: selectedDocIds.includes(doc.id) ? C.primary + '12' : 'transparent',
                            }}
                            onPress={() => {
                              setSelectedDocIds(prev =>
                                prev.includes(doc.id)
                                  ? prev.filter(id => id !== doc.id)
                                  : [...prev, doc.id]
                              );
                              logAction(`Toggled document: "${doc.name}"`, C.warning);
                            }}
                          >
                            <Ionicons
                              name={selectedDocIds.includes(doc.id) ? "checkbox" : "square-outline"}
                              size={14}
                              color={selectedDocIds.includes(doc.id) ? C.primary : C.mutedForeground}
                            />
                            <Text style={{
                              fontSize: 11, color: selectedDocIds.includes(doc.id) ? C.primary : C.foreground,
                              fontWeight: selectedDocIds.includes(doc.id) ? '600' : '400',
                            }} numberOfLines={1}>
                              {doc.name}
                            </Text>
                          </TouchableOpacity>
                        ))}
                      </View>
                    </View>
                  )}
                  {/* Pasted Notes Status */}
                  {pastedNotes.trim() && (
                    <View style={[styles.switchCard, { backgroundColor: '#10B981' + '08', borderColor: '#10B981' + '20' }]}>
                      <Ionicons name="document-text-outline" size={16} color="#10B981" />
                      <Text style={{ fontSize: 11, color: '#10B981', flex: 1 }}>
                        Notes ready ({pastedNotes.length.toLocaleString()} chars)
                      </Text>
                      <TouchableOpacity onPress={() => { setPastedNotes(''); logAction('Pasted notes cleared.', '#F59E0B'); }}>
                        <Ionicons name="close-circle" size={16} color={C.mutedForeground} />
                      </TouchableOpacity>
                    </View>
                  )}
                  {/* Generate Test Button */}
                  {!hasApiKey && (
                    <View style={{ padding: Spacing.sm, backgroundColor: '#F43F5E' + '12', borderRadius: BorderRadius.md, borderWidth: 1, borderColor: '#F43F5E' + '30' }}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
                        <Ionicons name="warning" size={14} color="#F43F5E" />
                        <Text style={{ fontSize: FontSize.sm, color: '#F43F5E', fontWeight: '600' }}>Configure your API key in Settings to generate tests.</Text>
                      </View>
                    </View>
                  )}
                  {!hasContent && hasApiKey && (
                    <View style={{ padding: Spacing.sm, backgroundColor: C.warning + '12', borderRadius: BorderRadius.md, borderWidth: 1, borderColor: C.warning + '30' }}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
                        <Ionicons name="document-outline" size={14} color={C.warning} />
                        <Text style={{ fontSize: FontSize.sm, color: C.warning, fontWeight: '600' }}>Add study material (notes or documents) to generate a test.</Text>
                      </View>
                    </View>
                  )}
                  <TouchableOpacity
                    style={[styles.generateBtn, { backgroundColor: C.primary },
                      (!hasContent || isLoading || !hasApiKey) && { opacity: 0.5 }]}
                    onPress={() => {
                      if (!hasApiKey) {
                        logAction('Cannot generate: No API key configured. Go to Settings → API & Model Configuration.', '#F43F5E');
                        Alert.alert('API Key Required', 'Please configure your API key in Settings > API & Model Configuration.');
                        return;
                      }
                      if (!hasContent) {
                        logAction('Cannot generate: No study material. Paste notes or upload documents.', '#F43F5E');
                        Alert.alert('No Study Material', 'Please add study notes or upload documents first.');
                        return;
                      }
                      logAction(`Starting test generation with ${totalContent.length.toLocaleString()} chars of content...`, '#10B981');
                      logAction(`Using AI settings: Difficulty=${aiDifficulty}, Count=${aiCount}, Language=${aiLanguage}`, C.warning);
                      handleStartTest({
                        studyNotes: totalContent, difficulty: aiDifficulty, questionCount: aiCount, language: aiLanguage, customPrompt, oneLinerMode,
                      });
                    }}
                    disabled={!hasContent || isLoading || !hasApiKey}
                  >
                    {isLoading ? (
                      <ActivityIndicator size="small" color={C.primaryForeground} />
                    ) : (
                      <>
                        <Ionicons name="sparkles" size={18} color={C.primaryForeground} />
                        <Text style={[styles.generateBtnText, { color: C.primaryForeground }]}>  Generate Test</Text>
                      </>
                    )}
                  </TouchableOpacity>
                </View>
                )}
              </View>

              {/* Manual Test Generate Section */}
              <View style={[styles.aiTestCard, { backgroundColor: C.card, borderColor: C.border }]}>
                <View style={[styles.sectionHeaderTest, { borderBottomColor: C.border }]}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: Spacing.md }}>
                    <View style={[styles.aiIconBox, { backgroundColor: '#8B5CF6' + '15' }]}>
                      <Ionicons name="code-slash-outline" size={20} color="#8B5CF6" />
                    </View>
                    <Text style={[styles.aiSectionTitle, { color: C.foreground }]} numberOfLines={1}>Manual Test Generate</Text>
                  </View>
                </View>
                <View style={{ gap: Spacing.md, padding: Spacing.md }}>
                  {/* One-Liner Mode */}
                  <View style={[styles.switchCard, { backgroundColor: C.muted + '60', borderColor: C.border }]}>
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.switchLabel, { color: C.foreground }]}>One-liner Mode</Text>
                      <Text style={[styles.switchDesc, { color: C.mutedForeground }]}>Short, concise questions only</Text>
                    </View>
                    <TouchableOpacity
                      style={[styles.customToggle, manualOneLinerMode ? { backgroundColor: '#8B5CF6' } : { backgroundColor: C.muted, borderColor: C.border }]}
                      onPress={() => setManualOneLinerMode(!manualOneLinerMode)}
                    >
                      <View style={[styles.customToggleDot, manualOneLinerMode ? { transform: [{ translateX: 16 }] } : {}]} />
                    </TouchableOpacity>
                  </View>
                  {/* Copy Prompt Button */}
                  <TouchableOpacity style={[styles.copyBtn, { backgroundColor: C.secondary || C.muted }]} onPress={async () => {
                    try {
                      if (typeof navigator !== 'undefined' && navigator.clipboard) {
                        await navigator.clipboard.writeText(manualPrompt);
                      } else {
                        await Clipboard.setStringAsync(manualPrompt);
                      }
                      logAction('Manual test prompt copied to clipboard.', '#10B981');
                      Alert.alert('Copied', 'Prompt copied to clipboard!');
                    } catch (err) {
                      console.warn('Clipboard copy failed:', err);
                      logAction('Failed to copy prompt to clipboard.', '#F43F5E');
                      Alert.alert('Error', 'Failed to copy prompt. Your device may not support clipboard access.');
                    }
                  }}>
                    <Ionicons name="copy-outline" size={16} color={C.foreground} />
                    <Text style={[styles.copyBtnText, { color: C.foreground }]}>  Copy Prompt</Text>
                  </TouchableOpacity>
                  {/* Show prompt preview */}
                  <View style={{ padding: Spacing.sm, backgroundColor: C.muted, borderRadius: BorderRadius.md }}>
                    <Text style={{ fontSize: FontSize.xs, color: C.mutedForeground, fontFamily: 'monospace' }} numberOfLines={4}>{manualPrompt}</Text>
                  </View>
                  {/* Paste AI JSON */}
                  <View>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                      <Ionicons name="code-outline" size={14} color="#8B5CF6" />
                      <Text style={[styles.fieldLabel, { color: C.mutedForeground }]}>Paste AI JSON Response Here</Text>
                    </View>
                    <TextInput
                      style={[styles.aiTextArea, { minHeight: 80, backgroundColor: C.background, borderColor: C.border, color: C.foreground }]}
                      multiline
                      placeholder='paste ai json response here'
                      placeholderTextColor={C.mutedForeground + '60'}
                      value={pastedManualJson}
                      onChangeText={setPastedManualJson}
                      textAlignVertical="top"
                    />
                  </View>
                  {manualParseError && (
                    <Text style={{ fontSize: FontSize.sm, color: C.destructive }}>{manualParseError}</Text>
                  )}
                  {/* Generate Test Button */}
                  <TouchableOpacity
                    style={[styles.generateBtn, { backgroundColor: '#8B5CF6' }]}
                    onPress={handleManualGenerate}
                    disabled={!pastedManualJson.trim()}
                  >
                    <Ionicons name="play-outline" size={18} color={C.primaryForeground} />
                    <Text style={[styles.generateBtnText, { color: C.primaryForeground }]}>  Generate Test</Text>
                  </TouchableOpacity>
                </View>
              </View>
            </View>

          </>
        )}

        {view === 'similarity' && similarityReport && (
          <View style={{ gap: Spacing.lg }}>
            <View style={{ alignItems: 'center', gap: Spacing.xs }}>
              <Text style={{ fontSize: FontSize.xxl, fontWeight: 'bold', color: C.foreground, textAlign: 'center' }}>
                Test Generated Successfully
              </Text>
              <Text style={{ fontSize: FontSize.sm, color: C.mutedForeground, textAlign: 'center' }}>
                Review the uniqueness report for {activeSection?.name} before starting
              </Text>
            </View>
            {aiUniqueMessage && (
              <View style={[s.notice, { backgroundColor: C.warning + '15', borderColor: C.warning + '30' }]}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: Spacing.xs }}>
                  <Ionicons name="warning" size={16} color={C.warning} />
                  <Text style={{ fontSize: FontSize.md, fontWeight: '600', color: C.warning }}>Uniqueness Notice</Text>
                </View>
                <Text style={{ fontSize: FontSize.sm, color: C.warning + 'CC' }}>{aiUniqueMessage}</Text>
              </View>
            )}
            <SimilarityIndicator report={similarityReport} />
            <View style={{ flexDirection: 'row', gap: Spacing.md }}>
              <TouchableOpacity style={[s.newTestBtn, { flex: 1, paddingVertical: Spacing.lg, borderRadius: BorderRadius.md, borderWidth: 1, borderColor: C.border }]} onPress={handleNewTest}>
                <Text style={{ fontSize: FontSize.md, color: C.foreground, textAlign: 'center' }}>Generate New Test</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[s.startBtn, { flex: 1, paddingVertical: Spacing.lg, borderRadius: BorderRadius.md, backgroundColor: C.primary }]} onPress={handleStartQuizFromSimilarity}>
                <Text style={{ fontSize: FontSize.md, color: C.primaryForeground, fontWeight: '600', textAlign: 'center' }}>
                  Start Test ({questions.length} Questions)
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        )}
        {view === 'quiz' && (
          <QuizInterface questions={questions} onComplete={handleQuizComplete} />
        )}

        {view === 'results' && currentConfig && (
          <TestResults
            questions={questions}
            answers={answers}
            config={currentConfig}
            timeTaken={timeTaken}
            onRetry={handleRetry}
            onNewTest={handleNewTest}
            uniquenessMessage={aiUniqueMessage}
          />
        )}

        {view === 'history' && activeSection && sectionStats && (
          <SectionHistory
            testResults={activeSection.testResults}
            sectionName={activeSection.name}
            questionsStored={sectionStats.questionsStored}
            documentsCount={sectionStats.documentsCount}
            onRenameTest={handleRenameTest}
            onDeleteTest={handleDeleteTest}
            onRetakeTest={handleRetakeTest}
            onClearAll={handleClearAll}
            onBack={handleCloseHistory}
          />
        )}

        <View style={{ height: 40 }} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  loading: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: Spacing.lg },
  container: { flex: 1 },
  content: { flex: 1 },
  contentInner: { padding: Spacing.md, gap: Spacing.md },
  notice: { borderRadius: BorderRadius.md, padding: Spacing.md, borderWidth: 1, gap: 4 },
  statCard: { borderRadius: BorderRadius.lg, borderWidth: 1, padding: Spacing.lg, alignItems: 'center', justifyContent: 'center', gap: Spacing.sm },
  newTestBtn: { alignItems: 'center', justifyContent: 'center', paddingHorizontal: Spacing.xs, flexShrink: 1 },
  startBtn: { alignItems: 'center', justifyContent: 'center', paddingHorizontal: Spacing.xs, flexShrink: 1 },
  // AI / Manual Test Section Styles
  aiTestCard: { borderRadius: BorderRadius.lg, borderWidth: 1, overflow: 'hidden' },
  sectionHeaderTest: { flexDirection: 'row', alignItems: 'center', padding: Spacing.lg, borderBottomWidth: 1, flexWrap: 'wrap', gap: Spacing.sm, minHeight: 56 },
  aiIconBox: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  aiSectionTitle: { fontSize: FontSize.lg, fontWeight: '700', letterSpacing: -0.3 },
  fieldLabel: { fontSize: 12, fontWeight: '600', letterSpacing: 0.5, marginBottom: Spacing.sm, textTransform: 'uppercase' },
  aiTextArea: { minHeight: 80, borderRadius: BorderRadius.lg, padding: Spacing.md, fontSize: 13, borderWidth: 1, fontFamily: 'monospace' },
  switchCard: { flexDirection: 'row', alignItems: 'center', borderRadius: BorderRadius.lg, padding: Spacing.lg, borderWidth: 1, gap: Spacing.md, flexWrap: 'wrap' },
  switchLabel: { fontSize: FontSize.md, fontWeight: '500' },
  switchDesc: { fontSize: FontSize.xs, marginTop: 2 },
  customToggle: { width: 44, height: 24, borderRadius: 12, justifyContent: 'center', paddingHorizontal: 2, borderWidth: 1, borderColor: 'transparent' },
  customToggleDot: { width: 18, height: 18, borderRadius: 9, backgroundColor: '#FFFFFF', boxShadow: '0 2px 4px rgba(0,0,0,0.2)' },
  generateBtn: { paddingVertical: Spacing.lg, borderRadius: BorderRadius.lg, alignItems: 'center', justifyContent: 'center', flexDirection: 'row', boxShadow: '0 3px 6px rgba(0,0,0,0.15)' },
  generateBtnText: { fontSize: FontSize.md, fontWeight: '600' },
  copyBtn: { paddingVertical: Spacing.md, borderRadius: BorderRadius.md, alignItems: 'center', justifyContent: 'center', flexDirection: 'row' },
  copyBtnText: { fontSize: FontSize.md, fontWeight: '500' },

});

const makeStyles = (C: any) => {
  // Dynamic styles are handled inline for theme-aware properties
  return styles;
};






