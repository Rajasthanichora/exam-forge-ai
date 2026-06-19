import React, { useState, useEffect, useRef } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, ScrollView, ActivityIndicator, Alert, Platform, Linking } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useTheme, Spacing, BorderRadius, FontSize } from '../lib/theme';
import { AppStorage } from '../lib/storage';
import { testModel, fetchAvailableModels } from '../lib/api';
import { WorkingModel } from '../lib/types';
import * as FileSystem from 'expo-file-system';
import { Paths } from 'expo-file-system';
import { persistLog } from '../lib/logs';

const DEFAULT_OR_MODELS: WorkingModel[] = [
  { provider: 'openrouter', model: 'meta-llama/llama-3.3-70b-instruct:free', label: 'Llama 3.3 70B Instruct', working: false, lastTested: '' },
  { provider: 'openrouter', model: 'google/gemma-3-27b-it:free', label: 'Gemma 3 27B IT', working: false, lastTested: '' },
  { provider: 'openrouter', model: 'google/gemma-3-12b-it:free', label: 'Gemma 3 12B IT', working: false, lastTested: '' },
  { provider: 'openrouter', model: 'google/gemma-3-4b-it:free', label: 'Gemma 3 4B IT', working: false, lastTested: '' },
  { provider: 'openrouter', model: 'google/gemma-2-9b-it:free', label: 'Gemma 2 9B IT', working: false, lastTested: '' },
  { provider: 'openrouter', model: 'google/gemma-2-2b-it:free', label: 'Gemma 2 2B IT', working: false, lastTested: '' },
  { provider: 'openrouter', model: 'qwen/qwen3-32b:free', label: 'Qwen 3 32B', working: false, lastTested: '' },
  { provider: 'openrouter', model: 'qwen/qwen3-14b:free', label: 'Qwen 3 14B', working: false, lastTested: '' },
  { provider: 'openrouter', model: 'qwen/qwen3-8b:free', label: 'Qwen 3 8B', working: false, lastTested: '' },
  { provider: 'openrouter', model: 'qwen/qwen3-4b:free', label: 'Qwen 3 4B', working: false, lastTested: '' },
  { provider: 'openrouter', model: 'qwen/qwen-2.5-72b-instruct:free', label: 'Qwen 2.5 72B Instruct', working: false, lastTested: '' },
  { provider: 'openrouter', model: 'qwen/qwen-2.5-32b-instruct:free', label: 'Qwen 2.5 32B Instruct', working: false, lastTested: '' },
  { provider: 'openrouter', model: 'qwen/qwen-2.5-14b-instruct:free', label: 'Qwen 2.5 14B Instruct', working: false, lastTested: '' },
  { provider: 'openrouter', model: 'qwen/qwen-2.5-7b-instruct:free', label: 'Qwen 2.5 7B Instruct', working: false, lastTested: '' },
  { provider: 'openrouter', model: 'mistralai/mistral-small-3.1-24b-instruct:free', label: 'Mistral Small 3.1 24B', working: false, lastTested: '' },
  { provider: 'openrouter', model: 'mistralai/mistral-small-3.1-9b-instruct:free', label: 'Mistral Small 3.1 9B', working: false, lastTested: '' },
  { provider: 'openrouter', model: 'mistralai/mistral-7b-instruct:free', label: 'Mistral 7B Instruct', working: false, lastTested: '' },
  { provider: 'openrouter', model: 'mistralai/mistral-saba-24b-instruct:free', label: 'Mistral Saba 24B', working: false, lastTested: '' },
  { provider: 'openrouter', model: 'deepseek/deepseek-chat:free', label: 'DeepSeek Chat', working: false, lastTested: '' },
  { provider: 'openrouter', model: 'deepseek/deepseek-r1-zero:free', label: 'DeepSeek R1 Zero', working: false, lastTested: '' },
  { provider: 'openrouter', model: 'deepseek/deepseek-r1-distill-llama-70b:free', label: 'DeepSeek R1 Distill Llama 70B', working: false, lastTested: '' },
  { provider: 'openrouter', model: 'microsoft/phi-3.5-mini-128k-instruct:free', label: 'Phi 3.5 Mini 128K', working: false, lastTested: '' },
  { provider: 'openrouter', model: 'microsoft/phi-3-medium-128k-instruct:free', label: 'Phi 3 Medium 128K', working: false, lastTested: '' },
  { provider: 'openrouter', model: 'cohere/command-r7b-12-2024:free', label: 'Cohere Command R7B', working: false, lastTested: '' },
  { provider: 'openrouter', model: 'cohere/command-r:free', label: 'Cohere Command R', working: false, lastTested: '' },
  { provider: 'openrouter', model: 'nvidia/llama-3.1-nemotron-nano-8b-v1:free', label: 'Nemotron Nano 8B', working: false, lastTested: '' },
  { provider: 'openrouter', model: 'nvidia/llama-3.1-nemotron-70b-instruct:free', label: 'Nemotron 70B', working: false, lastTested: '' },
  { provider: 'openrouter', model: 'sophosympatheia/rogue-rose-103b-v0.2:free', label: 'Rogue Rose 103B', working: false, lastTested: '' },
  { provider: 'openrouter', model: 'cognitivecomputations/dolphin-llama-3.1-70b:free', label: 'Dolphin Llama 3.1 70B', working: false, lastTested: '' },
  { provider: 'openrouter', model: 'cognitivecomputations/samantha-llama-3.1-8b:free', label: 'Samantha Llama 3.1 8B', working: false, lastTested: '' },
];

const DEFAULT_GEMINI_MODELS: WorkingModel[] = [
  { provider: 'gemini', model: 'gemini-2.5-pro-exp-03-25', label: 'Gemini 2.5 Pro Exp', working: false, lastTested: '' },
  { provider: 'gemini', model: 'gemini-2.0-flash', label: 'Gemini 2.0 Flash', working: false, lastTested: '' },
  { provider: 'gemini', model: 'gemini-2.0-flash-lite', label: 'Gemini 2.0 Flash Lite', working: false, lastTested: '' },
  { provider: 'gemini', model: 'gemini-2.0-flash-lite-preview-02-05', label: 'Gemini 2.0 Flash Lite Preview', working: false, lastTested: '' },
  { provider: 'gemini', model: 'gemini-1.5-flash', label: 'Gemini 1.5 Flash', working: false, lastTested: '' },
  { provider: 'gemini', model: 'gemini-1.5-flash-8b', label: 'Gemini 1.5 Flash 8B', working: false, lastTested: '' },
  { provider: 'gemini', model: 'gemini-1.5-pro', label: 'Gemini 1.5 Pro', working: false, lastTested: '' },
];

interface LogEntry {
  time: string;
  text: string;
  color?: string;
}

function addLog(logs: LogEntry[], text: string, color?: string): LogEntry[] {
  const time = new Date().toLocaleTimeString('en-US', { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' });
  return [...logs, { time, text, color }];
}

export default function ApiSettingsScreen() {
  const router = useRouter();
  const { colors: C, isDark } = useTheme();
  const logsRef = useRef<ScrollView>(null);

  // OpenRouter state
  const [orKey, setOrKey] = useState('');
  const [orSaved, setOrSaved] = useState(false);
  const [showORKey, setShowORKey] = useState(false);
  const [selectedOR, setSelectedOR] = useState('');
  const [orModels, setOrModels] = useState<WorkingModel[]>([]);
  const [showORSelector, setShowORSelector] = useState(false);
  const [orSaving, setOrSaving] = useState(false);

  // Gemini state
  const [geminiKey, setGeminiKey] = useState('');
  const [geminiSaved, setGeminiSaved] = useState(false);
  const [showGeminiKey, setShowGeminiKey] = useState(false);
  const [selectedGemini, setSelectedGemini] = useState('');
  const [geminiModels, setGeminiModels] = useState<WorkingModel[]>([]);
  const [showGeminiSelector, setShowGeminiSelector] = useState(false);
  const [geminiSaving, setGeminiSaving] = useState(false);

  // Active provider state
  const [activeProvider, setActiveProvider] = useState<'openrouter' | 'gemini'>('openrouter');
  const [activating, setActivating] = useState<'openrouter' | 'gemini' | null>(null);

  // Shared state
  const [isSaving, setIsSaving] = useState(false);
  const [testingModels, setTestingModels] = useState<Record<string, boolean>>({});
  const [testAllRunning, setTestAllRunning] = useState<Record<string, boolean>>({});
  const [allApiModels, setAllApiModels] = useState<Record<string, any[]>>({ openrouter: [], gemini: [] });
  const [diagLogs, setDiagLogs] = useState<LogEntry[]>([]);

  // Log helper
  const logAction = (text: string, color?: string) => {
    setDiagLogs(prev => addLog(prev, text, color));
    persistLog('api-settings', text, color);
  };

  useEffect(() => {
    (async () => {
      const storedOR = await AppStorage.getOpenRouterKey() || '';
      const storedGemini = await AppStorage.getGeminiKey() || '';
      const orModel = await AppStorage.getOpenRouterModel() || '';
      const gModel = await AppStorage.getGeminiModel() || '';
      const provider = await AppStorage.getAiProvider();

      setOrKey(storedOR); setOrSaved(!!storedOR);
      setGeminiKey(storedGemini); setGeminiSaved(!!storedGemini);
      setSelectedOR(orModel); setSelectedGemini(gModel);
      setActiveProvider(provider);

      logAction('Initializing secure diagnostic sequence...', C.primary);

      const orTested = await AppStorage.getTestedModels('openrouter');
      const gTested = await AppStorage.getTestedModels('gemini');
      if (orTested.length > 0) setOrModels(orTested);
      if (gTested.length > 0) setGeminiModels(gTested);

      if (storedOR) {
        logAction('Pinging OpenRouter API gateway...');
      }
      // Always fetch OpenRouter models (public endpoint works without key)
      fetchAvailableModels('openrouter', storedOR).then(m => {
        setAllApiModels(p => ({...p, openrouter: m}));
        logAction(`Fetched ${m.length} OpenRouter free models.`, '#10B981');
      }).catch(() => {
        logAction('OpenRouter: Using default model list.', '#F59E0B');
      });
      if (storedGemini) {
        logAction('Pinging Google AI Studio endpoint...');
        fetchAvailableModels('gemini', storedGemini).then(m => {
          setAllApiModels(p => ({...p, gemini: m}));
          logAction(`Fetched ${m.length} Gemini models.`, '#10B981');
        }).catch(() => {
          logAction('Gemini: Using default model list.', '#F59E0B');
        });
      }
      logAction(`Active operator: ${provider === 'openrouter' ? 'OpenRouter' : 'Gemini'}`, C.warning);
      logAction('Diagnostic sequence complete.', C.mutedForeground);
    })();
  }, []);

  // Auto-scroll logs
  useEffect(() => {
    if (diagLogs.length > 0) {
      setTimeout(() => logsRef.current?.scrollToEnd({ animated: true }), 100);
    }
  }, [diagLogs.length]);

  const handleSaveKey = async (provider: 'openrouter' | 'gemini') => {
    setIsSaving(true);
    try {
      const key = provider === 'openrouter' ? orKey : geminiKey;
      if (!key) return;
      if (provider === 'openrouter') {
        await AppStorage.setOpenRouterKey(key);
        setOrSaved(true);
        logAction('OpenRouter API key saved successfully.', '#10B981');
      } else {
        await AppStorage.setGeminiKey(key);
        setGeminiSaved(true);
        logAction('Gemini API key saved successfully.', '#10B981');
      }
    } catch (err) {
      logAction(`Failed to save ${provider} API key.`, '#F43F5E');
    } finally { setIsSaving(false); }
  };

  const handleDeleteKey = async (provider: 'openrouter' | 'gemini') => {
    if (provider === 'openrouter') {
      await AppStorage.removeOpenRouterKey();
      setOrKey('');
      setOrSaved(false);
      logAction('OpenRouter API key removed from storage.', '#F43F5E');
    } else {
      await AppStorage.removeGeminiKey();
      setGeminiKey('');
      setGeminiSaved(false);
      logAction('Gemini API key removed from storage.', '#F43F5E');
    }
  };

  const handleSetActiveProvider = async (provider: 'openrouter' | 'gemini') => {
    setActivating(provider);
    try {
      await AppStorage.setAiProvider(provider);
      setActiveProvider(provider);
      logAction(`Operator activated: ${provider === 'openrouter' ? 'OpenRouter' : 'Gemini'} — active app-wide.`, '#10B981');
      setTimeout(() => setActivating(null), 1500);
    } catch {
      logAction(`Failed to activate ${provider}.`, '#F43F5E');
      setActivating(null);
    }
  };

  const handleSelectModel = async (provider: 'openrouter' | 'gemini', model: string) => {
    if (provider === 'openrouter') {
      setSelectedOR(model);
      await AppStorage.setOpenRouterModel(model);
      setShowORSelector(false);
    } else {
      setSelectedGemini(model);
      await AppStorage.setGeminiModel(model);
      setShowGeminiSelector(false);
    }
    const label = model.split('/').pop() || model;
    logAction(`Model selected: ${label} via ${provider}`, '#10B981');
  };

  const handleTestSingle = async (model: WorkingModel) => {
    const apiKey = model.provider === 'openrouter' ? orKey : geminiKey;
    if (!apiKey) return;
    setTestingModels(p => ({...p, [model.model]: true}));
    logAction(`Testing: ${model.label}...`);
    try {
      const result = await testModel(model.provider, model.model, apiKey);
      const models = model.provider === 'openrouter' ? [...orModels] : [...geminiModels];
      const setter = model.provider === 'openrouter' ? setOrModels : setGeminiModels;
      const idx = models.findIndex(m => m.model === model.model);
      if (idx !== -1) {
        models[idx] = {...models[idx], working: result, lastTested: new Date().toISOString()};
        setter(models);
      }
      // Only keep models that tested successfully in persistent storage
      // Failed models are kept in local state but NOT saved (so they drop to bottom of list)
      const workingModels = models.filter(m => m.working && m.lastTested);
      if (workingModels.length > 0) await AppStorage.setTestedModels(model.provider, workingModels);
      if (result) {
        logAction(`✓ ${model.label} — working (saved in memory).`, '#10B981');
      } else {
        logAction(`✗ ${model.label} — failed (not kept in memory).`, '#F43F5E');
      }
    } catch {
      logAction(`✗ ${model.label} — error during test.`, '#F43F5E');
    } finally { setTestingModels(p => ({...p, [model.model]: false})); }
  };

  const handleTestAll = async (provider: 'openrouter' | 'gemini') => {
    setTestAllRunning(p => ({...p, [provider]: true}));
    logAction(`Testing all ${provider} models...`, C.primary);
    const models = provider === 'openrouter' ? [...orModels] : [...geminiModels];
    const setter = provider === 'openrouter' ? setOrModels : setGeminiModels;
    const apiKey = provider === 'openrouter' ? orKey : geminiKey;
    for (let i = 0; i < models.length; i++) {
      setTestingModels(p => ({...p, [models[i].model]: true}));
      try {
        const result = await testModel(provider, models[i].model, apiKey);
        models[i] = {...models[i], working: result, lastTested: new Date().toISOString()};
        setter([...models]);
      } catch {
        models[i] = {...models[i], working: false, lastTested: new Date().toISOString()};
        setter([...models]);
      } finally { setTestingModels(p => ({...p, [models[i].model]: false})); }
    }
    // Only persist working models (failed models are dropped from memory)
    const workingModels = models.filter(m => m.working && m.lastTested);
    if (workingModels.length > 0) await AppStorage.setTestedModels(provider, workingModels);
    const working = models.filter(m => m.working).length;
    logAction(`Test All complete: ${working}/${models.length} models working (${working} saved in memory).`, working > 0 ? '#10B981' : '#F43F5E');
    setTestAllRunning(p => ({...p, [provider]: false}));
  };

  const handleClearLog = () => {
    setDiagLogs([]);
  };

  const handleExportLog = async () => {
    try {
      const logText = diagLogs.map(l => `[${l.time}] ${l.text}`).join('\n');
      const isWeb = typeof window !== 'undefined' && typeof window.document !== 'undefined';
      if (isWeb) {
        const blob = new Blob([logText], { type: 'text/plain' });
        const url = URL.createObjectURL(blob);
        const a = window.document.createElement('a');
        a.href = url;
        a.download = `examforge_system_log_${Date.now()}.txt`;
        window.document.body.appendChild(a);
        a.click();
        window.document.body.removeChild(a);
        URL.revokeObjectURL(url);
        Alert.alert('Log Exported', 'System log downloaded.');
      } else {
        const file = new FileSystem.File(Paths.cache, `examforge_system_log_${Date.now()}.txt`);
        await file.write(logText);
        Alert.alert('Log Exported', `System log saved to:\n${file.uri}`);
      }
      logAction('System log exported successfully.', '#10B981');
    } catch (err) {
      Alert.alert('Error', 'Failed to export system log');
      logAction('Failed to export system log.', '#F43F5E');
    }
  };

  // Build model lists for each provider with priority sorting:
  // 1. Working (tested successfully) at top with "retest" button
  // 2. Currently selected model (if not tested yet)
  // 3. Untested in middle
  // 4. Failed (tested but not working) at bottom (not saved in memory)
  const buildModelList = (provider: 'openrouter' | 'gemini', tested: WorkingModel[]) => {
    // Merge hardcoded defaults with API-fetched models to ensure ALL models are shown
    const apiPool = allApiModels[provider] || [];
    const defaultPool = provider === 'openrouter' ? DEFAULT_OR_MODELS : DEFAULT_GEMINI_MODELS;

    // Merge: defaults FIRST so all 30+ default models always appear,
    // then append any extra API-only models not in defaults
    const seen = new Set<string>();
    const mergedPool: { value?: string; model?: string; label: string }[] = [];
    for (const m of defaultPool) {
      const id = m.model;
      if (id && !seen.has(id)) {
        seen.add(id);
        mergedPool.push({ value: id, label: m.label });
      }
    }
    for (const m of apiPool) {
      const id = m.value || m.model || '';
      if (id && !seen.has(id)) {
        seen.add(id);
        mergedPool.push(m);
      }
    }

    const untested = mergedPool.filter((api: any) => !tested.some((t: any) => t.model === (api.value || api.model)));
    const untestedModels = untested.map((api: any) => ({
      provider, model: api.value || api.model, label: api.label || api.model, working: false, lastTested: '',
    }));
    const workingModels = tested.filter(m => m.working);
    const failedModels = tested.filter(m => !m.working);
    // Priority: working (top) → untested (middle) → failed (bottom)
    return [...workingModels, ...untestedModels, ...failedModels];
  };

  const orAllList = buildModelList('openrouter', orModels);
  const geminiAllList = buildModelList('gemini', geminiModels);

  const getSelectedLabel = (provider: 'openrouter' | 'gemini') => {
    const modelList = provider === 'openrouter' ? orModels : geminiModels;
    const allList = provider === 'openrouter' ? orAllList : geminiAllList;
    const selected = provider === 'openrouter' ? selectedOR : selectedGemini;
    // Search in modelList first (tested), then in allList (all available)
    return modelList.find(m => m.model === selected)?.label ||
           allList.find(m => m.model === selected)?.label ||
           selected || 'None selected';
  };

  // Render a provider key section
  const renderCredentialSection = (
    provider: 'openrouter' | 'gemini',
    keyValue: string,
    setKeyValue: (v: string) => void,
    keySaved: boolean,
    saving: boolean,
    showKey: boolean,
    setShowKey: (v: boolean) => void,
    title: string,
    placeholder: string,
  ) => (
    <View style={[styles.credentialBlock, { borderColor: C.border }]}>
      <View style={styles.credentialHeader}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: Spacing.sm }}>
          <View style={[styles.providerBadge, { backgroundColor: provider === 'openrouter' ? C.primary + '15' : '#10B981' + '15' }]}>
            <Ionicons
              name={provider === 'openrouter' ? 'globe-outline' : 'logo-google'}
              size={16}
              color={provider === 'openrouter' ? C.primary : '#10B981'}
            />
          </View>
          <Text style={[styles.credentialTitle, { color: C.foreground }]}>{title}</Text>
        </View>
      </View>

      <View style={[styles.keyInputRow, { backgroundColor: C.card, borderColor: C.border }]}>
        <TextInput
          style={[styles.keyInput, { color: C.foreground }]}
          secureTextEntry={!showKey}
          placeholder={placeholder}
          placeholderTextColor={C.mutedForeground}
          value={keyValue}
          onChangeText={(t) => {
            setKeyValue(t);
            if (provider === 'openrouter') setOrSaved(false);
            else setGeminiSaved(false);
          }}
        />
        <TouchableOpacity style={styles.eyeBtn} onPress={() => setShowKey(!showKey)}>
          <Ionicons name={showKey ? 'eye-off' : 'eye'} size={22} color={C.mutedForeground} />
        </TouchableOpacity>
      </View>

      <View style={styles.credentialActions}>
        <TouchableOpacity
          style={[
            styles.saveKeyBtn,
            {
              backgroundColor: keySaved ? (provider === 'openrouter' ? C.primary : '#10B981') : (provider === 'openrouter' ? C.primary : '#10B981'),
              opacity: !keyValue || isSaving ? 0.5 : 1,
            },
          ]}
          onPress={() => handleSaveKey(provider)}
          disabled={!keyValue || isSaving}>
          <Ionicons
            name={keySaved ? 'checkmark-circle' : 'save-outline'}
            size={16}
            color={C.primaryForeground}
          />
          <Text style={[styles.keyBtnText, { color: C.primaryForeground }]}>
            {keySaved ? '  Key Successfully Saved' : '  Save Key'}
          </Text>
        </TouchableOpacity>

        {keySaved && (
          <>
            <TouchableOpacity
              style={[styles.activateBtn, {
                backgroundColor: activeProvider === provider ? '#10B981' : C.muted,
                borderColor: activeProvider === provider ? '#10B981' : C.border,
              }]}
              onPress={() => handleSetActiveProvider(provider)}
              disabled={activeProvider === provider}
            >
              <Ionicons
                name={activeProvider === provider ? 'checkmark-circle' : 'flash-outline'}
                size={14}
                color={activeProvider === provider ? '#FFFFFF' : C.foreground}
              />
              <Text style={[styles.keyBtnText, {
                color: activeProvider === provider ? '#FFFFFF' : C.foreground,
                fontSize: 11,
              }]}>
                {activating === provider ? '...' : activeProvider === provider ? '  Active' : '  Activate'}
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.removeKeyBtn, { backgroundColor: C.destructive + '10', borderColor: C.destructive + '20' }]}
              onPress={() => handleDeleteKey(provider)}>
              <Ionicons name="trash-outline" size={16} color={C.destructive} />
              <Text style={[styles.keyBtnText, { color: C.destructive }]}>  Remove</Text>
            </TouchableOpacity>
          </>
        )}
      </View>

      {keySaved && (
        <View style={styles.savedIndicator}>
          <Ionicons name="shield-checkmark" size={14} color="#10B981" />
          <Text style={[styles.savedText, { color: '#10B981' }]}>
            API key stored securely on device
          </Text>
        </View>
      )}
    </View>
  );

  // Render model selector for a provider
  const renderModelSelector = (
    provider: 'openrouter' | 'gemini',
    selected: string,
    showSelector: boolean,
    setShowSelector: (v: boolean) => void,
    allList: WorkingModel[],
    accentColor: string,
  ) => (
    <View>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, marginBottom: Spacing.sm }}>
        <View style={[styles.providerBadge, { backgroundColor: provider === 'openrouter' ? C.primary + '15' : '#10B981' + '15' }]}>
          <Ionicons
            name={provider === 'openrouter' ? 'globe-outline' : 'logo-google'}
            size={16}
            color={accentColor}
          />
        </View>
        <Text style={[styles.providerHeading, { color: C.foreground }]}>
          {provider === 'openrouter' ? 'OpenRouter' : 'Gemini'}
        </Text>
      </View>

      <TouchableOpacity
        style={[styles.selectorBtn, { backgroundColor: C.card, borderColor: C.border }]}
        onPress={() => setShowSelector(!showSelector)}>
        <View style={{ flex: 1 }}>
          <Text style={[styles.selectorLabel, { color: C.foreground }]}>
            {getSelectedLabel(provider)}
          </Text>
          <Text style={[styles.selectorSub, { color: C.mutedForeground }]}>
            Tap to select a model
          </Text>
        </View>
        <Ionicons name="chevron-down" size={18} color={C.mutedForeground} />
      </TouchableOpacity>

      {showSelector && (
        <View style={[styles.modelList, { backgroundColor: isDark ? C.muted : C.card, borderColor: C.border }]}>
          <View style={styles.modelListHeader}>
            <Text style={[styles.modelListTitle, { color: C.mutedForeground }]}>Free Models</Text>
            <TouchableOpacity
              style={[styles.testAllSmBtn, { borderColor: C.border }]}
              onPress={() => handleTestAll(provider)}
              disabled={!(provider === 'openrouter' ? orKey : geminiKey) || testAllRunning[provider]}>
              {testAllRunning[provider] ? (
                <ActivityIndicator size="small" color={C.foreground} />
              ) : (
                <Text style={[styles.testAllSmText, { color: C.mutedForeground }]}>Test All</Text>
              )}
            </TouchableOpacity>
          </View>
          {allList.map((model: WorkingModel) => (
            <TouchableOpacity key={model.model}
              style={[styles.modelItem, selected === model.model && { backgroundColor: accentColor + '12', borderColor: accentColor + '40' }]}
              onPress={() => handleSelectModel(provider, model.model)}>
              <View style={[styles.radio, selected === model.model && { borderColor: accentColor, backgroundColor: accentColor + '20' }]}>
                {selected === model.model && <View style={[styles.radioInner, { backgroundColor: accentColor }]} />}
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[styles.modelName, { color: C.foreground }]}>{model.label}</Text>
                <Text style={[styles.modelId, { color: C.mutedForeground }]} numberOfLines={1}>{model.model}</Text>
              </View>
              {model.lastTested && model.working ? (
                // Show "Retest" for previously tested working models
                <TouchableOpacity style={[styles.testSmBtn, { backgroundColor: '#10B981' + '15', borderColor: '#10B981' + '40' }]}
                  onPress={() => handleTestSingle(model)}
                  disabled={!(provider === 'openrouter' ? orKey : geminiKey) || testingModels[model.model]}>
                  {testingModels[model.model] ? (
                    <ActivityIndicator size="small" color="#10B981" />
                  ) : (
                    <>
                      <Ionicons name="checkmark-circle" size={14} color="#10B981" />
                      <Text style={[styles.testSmBtnText, { color: '#10B981', marginLeft: 4 }]}>Retest</Text>
                    </>
                  )}
                </TouchableOpacity>
              ) : (
                <TouchableOpacity style={[styles.testSmBtn, { backgroundColor: C.card, borderColor: C.border }]}
                  onPress={() => handleTestSingle(model)}
                  disabled={!(provider === 'openrouter' ? orKey : geminiKey) || testingModels[model.model]}>
                  {testingModels[model.model] ? (
                    <ActivityIndicator size="small" color={C.foreground} />
                  ) : (
                    <Text style={[styles.testSmBtnText, { color: C.foreground }]}>⚡Test</Text>
                  )}
                </TouchableOpacity>
              )}
            </TouchableOpacity>
          ))}
        </View>
      )}
    </View>
  );

  return (
    <View style={[styles.container, { backgroundColor: C.background }]}>
      <View style={[styles.header, { backgroundColor: C.card, borderBottomColor: C.border }]}>
        <View style={styles.headerRow}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
            <Ionicons name="arrow-back" size={22} color={C.foreground} />
          </TouchableOpacity>
          <View>
            <Text style={[styles.headerTitle, { color: C.foreground }]}>AI & Model Configuration</Text>
            <Text style={[styles.headerSub, { color: C.mutedForeground }]}>
              Authentication keys & model preferences
            </Text>
          </View>
        </View>
      </View>

      <ScrollView style={styles.content} contentContainerStyle={styles.contentInner}>
        <View style={{ gap: Spacing.sm }}>
          <Text style={[styles.sectionTitle, { color: C.foreground }]}>AI & Model Configuration</Text>
          <Text style={[styles.sectionDesc, { color: C.mutedForeground }]}>
            Manage authentication keys and model preferences for high-fidelity test generation.
          </Text>
        </View>

        <View style={[styles.card, { backgroundColor: C.card, borderColor: C.border }]}>
          <View style={[styles.cardHeader, { borderBottomColor: C.border }]}>
            <View style={[styles.cardIcon, { backgroundColor: isDark ? 'transparent' : C.primary + '12' }]}>
              <Ionicons name="toggle-outline" size={18} color={C.primary} />
            </View>
            <Text style={[styles.cardHeaderText, { color: C.foreground }]}>
              Active Operator
            </Text>
          </View>
          <View style={{ flexDirection: 'row', gap: Spacing.sm }}>
            {(['openrouter', 'gemini'] as const).map(provider => {
              const isActive = activeProvider === provider;
              const accentColor = provider === 'openrouter' ? C.primary : '#10B981';
              return (
                <TouchableOpacity
                  key={provider}
                  style={[styles.operatorCard, {
                    flex: 1,
                    backgroundColor: isActive ? accentColor + '15' : C.muted,
                    borderColor: isActive ? accentColor : C.border,
                    borderWidth: isActive ? 2 : 1,
                  }]}
                  onPress={() => handleSetActiveProvider(provider)}
                >
                  <Ionicons
                    name={provider === 'openrouter' ? 'globe-outline' : 'logo-google'}
                    size={24}
                    color={isActive ? accentColor : C.mutedForeground}
                  />
                  <Text style={{
                    fontSize: FontSize.md, fontWeight: '700',
                    color: isActive ? accentColor : C.foreground,
                    marginTop: Spacing.xs,
                  }}>
                    {provider === 'openrouter' ? 'OpenRouter' : 'Gemini'}
                  </Text>
                  {isActive && (
                    <View style={[styles.activeBadge, { backgroundColor: '#10B981' }]}>
                      <Ionicons name="checkmark-circle" size={12} color="#FFFFFF" />
                      <Text style={{ fontSize: 9, fontWeight: '800', color: '#FFFFFF', letterSpacing: 0.5 }}>
                        {' '}ACTIVE
                      </Text>
                    </View>
                  )}
                </TouchableOpacity>
              );
            })}
          </View>
          {activeProvider && (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: Spacing.xs, marginTop: Spacing.sm }}>
              <Ionicons name="checkmark-circle" size={16} color="#10B981" />
              <Text style={{ fontSize: FontSize.sm, color: '#10B981', fontWeight: '600' }}>
                {activeProvider === 'openrouter' ? 'OpenRouter' : 'Gemini'} is active app-wide
              </Text>
            </View>
          )}
        </View>

        <View style={[styles.card, { backgroundColor: C.card, borderColor: C.border }]}>
          <View style={[styles.cardHeader, { borderBottomColor: C.border }]}>
            <View style={[styles.cardIcon, { backgroundColor: isDark ? 'transparent' : C.primary + '12' }]}>
              <Ionicons name="key-outline" size={18} color={C.primary} />
            </View>
            <Text style={[styles.cardHeaderText, { color: C.foreground }]}>
              Authentication Credentials
            </Text>
          </View>

          {renderCredentialSection(
            'openrouter',
            orKey, setOrKey, orSaved, orSaving, showORKey, setShowORKey,
            'OpenRouter API Access',
            'sk-or-v1-...',
          )}

          <View style={[styles.providerDivider, { backgroundColor: C.border }]} />

          {renderCredentialSection(
            'gemini',
            geminiKey, setGeminiKey, geminiSaved, geminiSaving, showGeminiKey, setShowGeminiKey,
            'Google Gemini API',
            'Enter your Google AI Studio key...',
          )}
        </View>

        <View style={[styles.card, { backgroundColor: C.card, borderColor: C.border }]}>
          <View style={[styles.cardHeader, { borderBottomColor: C.border }]}>
            <View style={[styles.cardIcon, { backgroundColor: isDark ? 'transparent' : '#10B981' + '12' }]}>
              <Ionicons name="server-outline" size={18} color="#10B981" />
            </View>
            <Text style={[styles.cardHeaderText, { color: C.foreground }]}>Model Architecture</Text>
          </View>

          {renderModelSelector('openrouter', selectedOR, showORSelector, setShowORSelector, orAllList, C.primary)}

          {selectedOR && (
            <View style={[styles.selectedModelInfo, { backgroundColor: C.muted, borderColor: C.border }]}>
              <Ionicons name="checkmark-circle" size={14} color="#10B981" />
              <Text style={[styles.selectedModelInfoText, { color: '#10B981' }]}>
                Model selected: {getSelectedLabel('openrouter')}
              </Text>
            </View>
          )}

          <View style={[styles.providerDivider, { backgroundColor: C.border }]} />

          {renderModelSelector('gemini', selectedGemini, showGeminiSelector, setShowGeminiSelector, geminiAllList, '#10B981')}

          {selectedGemini && (
            <View style={[styles.selectedModelInfo, { backgroundColor: C.muted, borderColor: C.border }]}>
              <Ionicons name="checkmark-circle" size={14} color="#10B981" />
              <Text style={[styles.selectedModelInfoText, { color: '#10B981' }]}>
                Model selected: {getSelectedLabel('gemini')}
              </Text>
            </View>
          )}
        </View>

        <View style={[styles.card, { backgroundColor: C.card, borderColor: C.border }]}>
          <View style={[styles.cardHeader, { borderBottomColor: C.border }]}>
            <View style={[styles.cardIcon, { backgroundColor: isDark ? C.muted : '#1E293B' }]}>
              <Ionicons name="terminal-outline" size={18} color={isDark ? C.foreground : '#FFFFFF'} />
            </View>
            <Text style={[styles.cardHeaderText, { color: C.foreground }]}>System Diagnostics</Text>
            <TouchableOpacity style={[styles.diagBtn, { backgroundColor: C.muted, borderColor: C.border }]}
              onPress={handleClearLog}>
              <Ionicons name="trash-outline" size={14} color={C.foreground} />
              <Text style={[styles.diagBtnText, { color: C.foreground }]}>  Clear Log</Text>
            </TouchableOpacity>
          </View>

          <View style={[styles.terminal, { backgroundColor: '#09090B', borderColor: '#27272A', maxHeight: 250 }]}>
            <ScrollView ref={logsRef} style={{ maxHeight: 180 }} nestedScrollEnabled>
              {diagLogs.length === 0 ? (
                <View style={{ padding: Spacing.md, alignItems: 'center' }}>
                  <Text style={[styles.terminalText, { color: '#71717A', textAlign: 'center' }]}>
                    No diagnostic logs. Save an API key or test a model to generate logs.
                  </Text>
                </View>
              ) : (
                diagLogs.map((log, i) => (
                  <View key={i} style={styles.terminalLine}>
                    <Text style={[styles.terminalTime, { color: '#71717A' }]}>{log.time}</Text>
                    <Text style={[styles.terminalText, { color: log.color || '#D4D4D8' }]}>
                      {log.text}
                    </Text>
                  </View>
                ))
              )}
            </ScrollView>
            {diagLogs.length > 0 && (
              <View style={[styles.terminalFooter, { borderTopColor: '#27272A' }]}>
                <TouchableOpacity onPress={handleExportLog}>
                  <Text style={[styles.exportText, { color: C.primary }]}>
                    <Ionicons name="download-outline" size={12} color={C.primary} />  Export System Log
                  </Text>
                </TouchableOpacity>
              </View>
            )}
          </View>
        </View>

        <View style={[styles.notice, {
          backgroundColor: isDark ? C.primary + '06' : '#EEF2FF',
          borderColor: isDark ? C.primary + '15' : '#C7D2FE',
        }]}>
          <View style={[styles.noticeWatermark, { opacity: isDark ? 0.05 : 0.08 }]}>
            <Ionicons name="shield-checkmark" size={120} color={C.primary} />
          </View>
          <View style={[styles.noticeIconBox, {
            backgroundColor: isDark ? C.card : '#FFFFFF',
            borderColor: isDark ? C.primary + '20' : '#C7D2FE',
          }]}>
            <Ionicons name="lock-closed" size={24} color={C.primary} />
          </View>
          <View style={{ flex: 1, zIndex: 1 }}>
            <Text style={[styles.noticeTitle, { color: isDark ? C.foreground : '#0F172A' }]}>
              End-to-End Local Encryption
            </Text>
            <Text style={[styles.noticeDesc, { color: isDark ? C.mutedForeground : '#475569' }]}>
              Your API keys are secured using AES-256 and stored exclusively on your device.
              ExamForge AI never transmits these credentials to our servers.
            </Text>
          </View>
        </View>

        <View style={{ height: 40 }} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    borderBottomWidth: 1, paddingTop: Spacing.lg, paddingBottom: Spacing.md, paddingHorizontal: Spacing.lg,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
  },
  headerRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md },
  backBtn: { padding: Spacing.xs },
  headerTitle: { fontSize: 16, fontWeight: 'bold' },
  headerSub: { fontSize: 10, letterSpacing: 0.5, marginTop: 1 },
  content: { flex: 1 },
  contentInner: { padding: Spacing.md, gap: Spacing.md, paddingBottom: Spacing.xxxl * 2 },
  sectionTitle: { fontSize: 20, fontWeight: 'bold', letterSpacing: -0.5, textAlign: 'center' },
  sectionDesc: { fontSize: 15, lineHeight: 22 },
  card: { borderRadius: BorderRadius.lg, borderWidth: 1, padding: Spacing.lg, gap: Spacing.md },
  cardHeader: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, paddingBottom: Spacing.md, borderBottomWidth: 1 },
  cardIcon: { width: 36, height: 36, borderRadius: Spacing.sm, alignItems: 'center', justifyContent: 'center' },
  cardHeaderText: { fontSize: 11, fontWeight: '800', letterSpacing: 1 },

  // Active Operator Selector
  activeBadge: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: Spacing.sm, paddingVertical: 2,
    borderRadius: BorderRadius.full, marginTop: Spacing.xs,
  },
  operatorCard: {
    borderRadius: BorderRadius.lg, padding: Spacing.lg,
    alignItems: 'center', justifyContent: 'center',
  },

  // Credentials
  credentialBlock: {
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    padding: Spacing.lg,
    gap: Spacing.md,
    marginTop: Spacing.sm,
  },
  credentialHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  providerBadge: {
    width: 32, height: 32, borderRadius: 16,
    alignItems: 'center', justifyContent: 'center',
  },
  credentialTitle: { fontSize: 14, fontWeight: '700' },
  keyInputRow: {
    flexDirection: 'row', alignItems: 'center',
    borderRadius: BorderRadius.xxl, borderWidth: 1,
    paddingHorizontal: Spacing.lg, height: 50,
  },
  keyInput: { flex: 1, fontSize: 13, fontWeight: '500', height: '100%' },
  eyeBtn: { padding: Spacing.sm },
  credentialActions: { flexDirection: 'row', gap: Spacing.sm, alignItems: 'center', flexWrap: 'wrap' },
  saveKeyBtn: {
    flexDirection: 'row', alignItems: 'center',
    paddingVertical: Spacing.md, paddingHorizontal: Spacing.xl,
    borderRadius: BorderRadius.lg,
    boxShadow: '0 2px 4px rgba(0,0,0,0.15)',
  },
  removeKeyBtn: {
    flexDirection: 'row', alignItems: 'center',
    paddingVertical: Spacing.md, paddingHorizontal: Spacing.xl,
    borderRadius: BorderRadius.lg,
    borderWidth: 1.5,
  },
  activateBtn: {
    flexDirection: 'row', alignItems: 'center',
    paddingVertical: Spacing.md, paddingHorizontal: Spacing.md,
    borderRadius: BorderRadius.lg,
    borderWidth: 1.5,
  },
  keyBtnText: { fontSize: 13, fontWeight: '700', letterSpacing: 0.3 },
  savedIndicator: {
    flexDirection: 'row', alignItems: 'center', gap: Spacing.xs,
  },
  savedText: { fontSize: 11, fontWeight: '700', letterSpacing: 0.3 },
  providerDivider: { height: 1, marginVertical: Spacing.xs },

  // Model Architecture
  providerHeading: { fontSize: 16, fontWeight: '700', letterSpacing: -0.3 },
  selectorBtn: {
    flexDirection: 'row', alignItems: 'center', height: 48, borderRadius: BorderRadius.lg,
    paddingHorizontal: Spacing.lg, borderWidth: 1,
  },
  selectorLabel: { fontSize: 14, fontWeight: '600' },
  selectorSub: { fontSize: 10, marginTop: 2 },
  modelList: { borderRadius: BorderRadius.lg, borderWidth: 1, padding: Spacing.sm, gap: 4, marginTop: Spacing.sm },
  modelListHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: Spacing.sm, paddingVertical: Spacing.sm },
  modelListTitle: { fontSize: 10, fontWeight: '700', letterSpacing: 0.5 },
  testAllSmBtn: { paddingHorizontal: Spacing.md, paddingVertical: Spacing.xs, borderRadius: Spacing.xs, borderWidth: 1 },
  testAllSmText: { fontSize: 11, fontWeight: '500' },
  modelItem: { flexDirection: 'row', alignItems: 'center', padding: Spacing.md, borderRadius: Spacing.sm, borderWidth: 1, borderColor: 'transparent', gap: Spacing.md, flexWrap: 'wrap' },
  radio: { width: 20, height: 20, borderRadius: 10, borderWidth: 2, borderColor: '#E2E8F0', alignItems: 'center', justifyContent: 'center' },
  radioInner: { width: 10, height: 10, borderRadius: 5 },
  modelName: { fontSize: 13, fontWeight: '500' },
  modelId: { fontSize: 10, marginTop: 2, fontFamily: 'monospace' },
  workingTick: {},
  testSmBtn: { height: 32, paddingHorizontal: Spacing.md, borderRadius: Spacing.xs, alignItems: 'center', justifyContent: 'center', borderWidth: 1 },
  testSmBtnText: { fontSize: 10, fontWeight: '600' },
  selectedModelInfo: {
    flexDirection: 'row', alignItems: 'center', gap: Spacing.xs,
    paddingVertical: Spacing.sm, paddingHorizontal: Spacing.md,
    borderRadius: BorderRadius.md, borderWidth: 1,
  },
  selectedModelInfoText: { fontSize: 11, fontWeight: '600' },

  // System Diagnostics
  diagBtn: { flexDirection: 'row', alignItems: 'center', paddingVertical: Spacing.sm, paddingHorizontal: Spacing.md, borderRadius: Spacing.sm, marginLeft: 'auto', borderWidth: 1 },
  diagBtnText: { fontSize: 10, fontWeight: '700', letterSpacing: 0.5 },
  terminal: { borderRadius: BorderRadius.xl, padding: Spacing.lg, borderWidth: 1 },
  terminalLine: { flexDirection: 'row', gap: Spacing.sm, marginBottom: 6 },
  terminalTime: { fontSize: 10, fontWeight: '700', letterSpacing: 0.5, fontFamily: 'monospace' },
  terminalText: { fontSize: 11, flex: 1, fontFamily: 'monospace' },
  terminalFooter: { flexDirection: 'row', justifyContent: 'flex-end', alignItems: 'center', marginTop: Spacing.sm, paddingTop: Spacing.sm, borderTopWidth: 1 },
  statusPill: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: Spacing.md, paddingVertical: Spacing.xs, borderRadius: BorderRadius.full },
  statusDot: { width: 8, height: 8, borderRadius: 4 },
  statusText: { fontSize: 10, fontWeight: '800', letterSpacing: 0.5 },
  exportText: { fontSize: 11, fontWeight: '700' },

  // Notice
  noticeWatermark: { position: 'absolute', right: -16, bottom: -16, zIndex: 0 },
  notice: {
    borderRadius: BorderRadius.xxl, borderWidth: 1, padding: Spacing.lg,
    flexDirection: 'row', gap: Spacing.lg, alignItems: 'flex-start', overflow: 'hidden',
  },
  noticeIconBox: { width: 52, height: 52, borderRadius: BorderRadius.lg, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  noticeTitle: { fontSize: 14, fontWeight: '800', letterSpacing: 0.5, marginBottom: 4 },
  noticeDesc: { fontSize: 13, lineHeight: 20 },
});

