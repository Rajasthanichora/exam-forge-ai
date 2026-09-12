import React, { useState, useEffect } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, ScrollView, TextInput,
  Alert, ActivityIndicator, Platform,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useTheme, Spacing, BorderRadius, FontSize } from '../lib/theme';
import { getItem, setItem } from '../lib/storage';
import { Subject, getAllSubjects, getSubjectN8nConfig, setSubjectN8nConfig, SubjectN8nConfig } from '../lib/subject-store';

const N8N_WEBHOOK_KEY = 'examforge_n8n_webhook_url';
const N8N_PARAMS_KEY = 'examforge_n8n_params';

interface WebhookParam {
  id: string;
  buttonLabel: string;
  method: 'GET' | 'POST';
  paramName: string;       // custom param name (user sets value)
  paramType: 'query' | 'body';
  paramValue: string;      // custom param value (user editable)
  defaultParamName?: string; // system param (auto-populated, read-only)
}

const DEFAULT_PARAMS: WebhookParam[] = [
  {
    id: 'fetch',
    buttonLabel: 'Fetch',
    method: 'GET',
    paramName: '',
    paramType: 'query',
    paramValue: '',
  },
  {
    id: 'delete',
    buttonLabel: 'Delete Question',
    method: 'GET',
    paramName: 'delete_question',
    paramType: 'query',
    paramValue: '',
    defaultParamName: 'question',
  },
  {
    id: 'edit',
    buttonLabel: 'Edit Question',
    method: 'GET',
    paramName: 'edit_question',
    paramType: 'query',
    paramValue: '',
    defaultParamName: 'question_data',
  },
];

export default function N8NScreen() {
  const router = useRouter();
  const { colors: C } = useTheme();
  const [webhookUrl, setWebhookUrl] = useState('');
  const [savedUrl, setSavedUrl] = useState('');
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<'success' | 'fail' | null>(null);
  const [saving, setSaving] = useState(false);
  const [params, setParams] = useState<WebhookParam[]>(DEFAULT_PARAMS);
  const [editingParamId, setEditingParamId] = useState<string | null>(null);
  const [paramsSaving, setParamsSaving] = useState(false);

  // ── Dynamic subjects n8n config ──
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [subConfigs, setSubConfigs] = useState<Record<string, { webhookUrl: string; params: WebhookParam[] }>>({});
  const [subEditingId, setSubEditingId] = useState<string | null>(null);
  const [subTesting, setSubTesting] = useState<string | null>(null);
  const [subTestResults, setSubTestResults] = useState<Record<string, 'success' | 'fail' | null>>({});
  const [subEditingParamId, setSubEditingParamId] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      const stored = await getItem(N8N_WEBHOOK_KEY);
      if (stored) {
        setWebhookUrl(stored);
        setSavedUrl(stored);
      }
      const savedParams = await getItem(N8N_PARAMS_KEY);
      if (savedParams) {
        try {
          const parsed = JSON.parse(savedParams);
          // Always ensure both default params exist
          const merged = DEFAULT_PARAMS.map(dp => {
            const saved = parsed.find((p: WebhookParam) => p.id === dp.id);
            return saved ? { ...dp, ...saved, id: dp.id } : dp;
          });
          setParams(merged);
        } catch {}
      }
    })();
  }, []);

  // ── Load dynamic subjects ──
  useEffect(() => {
    (async () => {
      const all = await getAllSubjects();
      setSubjects(all);
      const configs: Record<string, { webhookUrl: string; params: WebhookParam[] }> = {};
      for (const s of all) {
        const cfg = await getSubjectN8nConfig(s.id);
        const params = (cfg.params && cfg.params.length > 0)
          ? DEFAULT_PARAMS.map(dp => {
              const saved = cfg.params.find((p: WebhookParam) => p.id === dp.id);
              return saved ? { ...dp, ...saved, id: dp.id } : dp;
            })
          : DEFAULT_PARAMS;
        configs[s.id] = { webhookUrl: cfg.webhookUrl || '', params };
      }
      setSubConfigs(configs);
    })();
  }, []);

  const handleSave = async () => {
    if (!webhookUrl.trim()) return;
    setSaving(true);
    try {
      await setItem(N8N_WEBHOOK_KEY, webhookUrl.trim());
      setSavedUrl(webhookUrl.trim());
      Alert.alert('Saved', 'Webhook URL saved.');
    } catch {
      Alert.alert('Error', 'Failed to save.');
    } finally {
      setSaving(false);
    }
  };

  const handleTest = async () => {
    const url = webhookUrl.trim();
    if (!url) { Alert.alert('No URL', 'Enter a webhook URL first.'); return; }
    setTesting(true);
    setTestResult(null);
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 15000);
      const response = await fetch(url, { method: 'GET', signal: controller.signal, headers: { Accept: 'application/json' } });
      clearTimeout(timeout);
      if (response.ok) {
        setTestResult('success');
        Alert.alert('Connected', `Status: ${response.status}`);
      } else {
        setTestResult('fail');
        Alert.alert('Failed', `Status: ${response.status}`);
      }
    } catch (err: any) {
      setTestResult('fail');
      Alert.alert('Failed', err?.name === 'AbortError' ? 'Timed out (15s).' : err?.message || 'Could not reach URL.');
    } finally {
      setTesting(false);
    }
  };

  const handleSaveParams = async () => {
    setParamsSaving(true);
    try {
      await setItem(N8N_PARAMS_KEY, JSON.stringify(params));
      Alert.alert('Saved', 'Parameters saved.');
      setEditingParamId(null);
    } catch {
      Alert.alert('Error', 'Failed to save parameters.');
    } finally {
      setParamsSaving(false);
    }
  };

  const updateParam = (id: string, field: keyof WebhookParam, value: string) => {
    setParams(prev => prev.map(p => p.id === id ? { ...p, [field]: value } : p));
  };

  const removeParam = (id: string) => {
    if (id === 'fetch' || id === 'delete' || id === 'edit') return;
    setParams(prev => prev.filter(p => p.id !== id));
  };

  const isConnected = !!savedUrl;
  const editingParam = params.find(p => p.id === editingParamId);

  // ── Subject n8n handlers ──
  const handleSubSaveUrl = async (subjectId: string) => {
    const cfg = subConfigs[subjectId];
    if (!cfg?.webhookUrl.trim()) return;
    await setSubjectN8nConfig(subjectId, { webhookUrl: cfg.webhookUrl.trim(), params: cfg.params });
    Alert.alert('Saved', 'Webhook URL saved.');
  };

  const handleSubTest = async (subjectId: string) => {
    const cfg = subConfigs[subjectId];
    const url = cfg?.webhookUrl.trim();
    if (!url) { Alert.alert('No URL', 'Enter a webhook URL first.'); return; }
    setSubTesting(subjectId);
    setSubTestResults(prev => ({ ...prev, [subjectId]: null }));
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 15000);
      const res = await fetch(url, { method: 'GET', signal: controller.signal, headers: { Accept: 'application/json' } });
      clearTimeout(timeout);
      setSubTestResults(prev => ({ ...prev, [subjectId]: res.ok ? 'success' : 'fail' }));
      Alert.alert(res.ok ? 'Connected' : 'Failed', `Status: ${res.status}`);
    } catch (err: any) {
      setSubTestResults(prev => ({ ...prev, [subjectId]: 'fail' }));
      Alert.alert('Failed', err?.name === 'AbortError' ? 'Timed out (15s).' : err?.message || 'Could not reach URL.');
    } finally {
      setSubTesting(null);
    }
  };

  const handleSubSaveParams = async (subjectId: string) => {
    const cfg = subConfigs[subjectId];
    if (!cfg) return;
    await setSubjectN8nConfig(subjectId, { webhookUrl: cfg.webhookUrl, params: cfg.params });
    Alert.alert('Saved', 'Parameters saved.');
    setSubEditingParamId(null);
  };

  const updateSubParam = (subjectId: string, paramId: string, field: keyof WebhookParam, value: string) => {
    setSubConfigs(prev => ({
      ...prev,
      [subjectId]: {
        ...prev[subjectId],
        params: prev[subjectId].params.map(p => p.id === paramId ? { ...p, [field]: value } : p),
      },
    }));
  };

  return (
    <View style={[styles.container, { backgroundColor: C.background }]}>
      {/* Header */}
      <View style={[styles.header, { backgroundColor: C.card, borderBottomColor: C.border }]}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={24} color={C.foreground} />
        </TouchableOpacity>
        <View style={styles.headerCenter}>
          <Text style={[styles.headerTitle, { color: C.foreground }]} numberOfLines={1}>N8N Integration</Text>
        </View>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView style={styles.content} contentContainerStyle={styles.contentInner}>
        {/* Status */}
        <View style={[styles.statusCard, {
          backgroundColor: isConnected ? '#10B98110' : '#F59E0B10',
          borderColor: isConnected ? '#10B98130' : '#F59E0B30',
        }]}>
          <View style={[styles.statusIconBox, {
            backgroundColor: isConnected ? '#10B98120' : '#F59E0B20',
          }]}>
            <Ionicons name={isConnected ? 'checkmark-circle' : 'alert-circle'} size={28} color={isConnected ? '#10B981' : '#F59E0B'} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={[styles.statusTitle, { color: isConnected ? '#10B981' : '#F59E0B' }]}>
              {isConnected ? 'Connected' : 'Not Configured'}
            </Text>
            <Text style={[styles.statusDesc, { color: C.mutedForeground }]}>
              {isConnected ? savedUrl : 'Add webhook URL below'}
            </Text>
          </View>
        </View>

        {/* Webhook URL */}
        <View style={[styles.card, { backgroundColor: C.card, borderColor: C.border }]}>
          <View style={[styles.cardHeader, { borderBottomColor: C.border }]}>
            <View style={[styles.iconBox, { backgroundColor: '#EF444415' }]}>
              <Ionicons name="git-network-outline" size={20} color="#EF4444" />
            </View>
            <Text style={[styles.cardTitle, { color: C.foreground }]}>Webhook URL</Text>
          </View>
          <View style={styles.cardBody}>
            <View style={[styles.inputRow, { backgroundColor: C.background, borderColor: C.border }]}>
              <Ionicons name="link-outline" size={18} color={C.mutedForeground} style={{ marginRight: Spacing.sm }} />
              <TextInput
                style={[styles.input, { color: C.foreground }]}
                placeholder="https://your-n8n.com/webhook/..."
                placeholderTextColor={C.mutedForeground + '60'}
                value={webhookUrl}
                onChangeText={(t) => { setWebhookUrl(t); if (testResult) setTestResult(null); }}
                autoCapitalize="none" autoCorrect={false} keyboardType="url"
              />
              {webhookUrl.length > 0 && (
                <TouchableOpacity onPress={() => { setWebhookUrl(''); setTestResult(null); }}>
                  <Ionicons name="close-circle" size={18} color={C.mutedForeground} />
                </TouchableOpacity>
              )}
            </View>
            <View style={styles.buttonRow}>
              <TouchableOpacity
                style={[styles.saveBtn, { backgroundColor: C.primary, opacity: !webhookUrl.trim() || saving ? 0.5 : 1 }]}
                onPress={handleSave} disabled={!webhookUrl.trim() || saving}
              >
                {saving ? <ActivityIndicator size="small" color={C.primaryForeground} /> : <Ionicons name="save-outline" size={16} color={C.primaryForeground} />}
                <Text style={[styles.btnText, { color: C.primaryForeground }]}>{saving ? '  Saving...' : '  Save'}</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.testBtn, { backgroundColor: '#10B981', opacity: testing ? 0.5 : 1 }]}
                onPress={handleTest} disabled={testing}
              >
                {testing ? <ActivityIndicator size="small" color="#FFF" /> : <Ionicons name="pulse-outline" size={16} color="#FFF" />}
                <Text style={[styles.btnText, { color: '#FFF' }]}>{testing ? '  Testing...' : '  Test'}</Text>
              </TouchableOpacity>
            </View>
            {testResult && (
              <View style={[styles.resultBadge, {
                backgroundColor: testResult === 'success' ? '#10B98112' : '#F43F5E12',
                borderColor: testResult === 'success' ? '#10B98130' : '#F43F5E30',
              }]}>
                <Ionicons name={testResult === 'success' ? 'checkmark-circle' : 'close-circle'} size={16}
                  color={testResult === 'success' ? '#10B981' : '#F43F5E'} />
                <Text style={{ fontSize: FontSize.sm, fontWeight: '600',
                  color: testResult === 'success' ? '#10B981' : '#F43F5E' }}>
                  {testResult === 'success' ? 'Webhook reachable' : 'Could not reach webhook'}
                </Text>
              </View>
            )}
          </View>
        </View>

        {/* Webhook Parameters */}
        <View style={[styles.card, { backgroundColor: C.card, borderColor: C.border }]}>
          <View style={[styles.cardHeader, { borderBottomColor: C.border }]}>
            <View style={[styles.iconBox, { backgroundColor: '#8B5CF615' }]}>
              <Ionicons name="options-outline" size={20} color="#8B5CF6" />
            </View>
            <Text style={[styles.cardTitle, { color: C.foreground }]}>Webhook Parameters</Text>
          </View>
          <View style={styles.cardBody}>
            <Text style={[styles.fieldDesc, { color: C.mutedForeground }]}>
              Assign parameters to each button. These are sent when the button is triggered.
            </Text>

            {/* Param List */}
            {params.map((param) => (
              <TouchableOpacity
                key={param.id}
                style={[styles.paramRow, { backgroundColor: C.background, borderColor: editingParamId === param.id ? '#8B5CF6' : C.border }]}
                onPress={() => setEditingParamId(editingParamId === param.id ? null : param.id)}
                activeOpacity={0.7}
              >
                <View style={[styles.paramIcon, { backgroundColor: param.id === 'delete' ? '#F43F5E18' : param.id === 'edit' ? '#F59E0B18' : '#8B5CF618' }]}>
                  <Ionicons name={param.id === 'fetch' ? 'cloud-download-outline' : param.id === 'delete' ? 'trash-outline' : 'pencil-outline'} size={16} color={param.id === 'delete' ? '#F43F5E' : param.id === 'edit' ? '#F59E0B' : '#8B5CF6'} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.paramLabel, { color: C.foreground }]}>{param.buttonLabel}</Text>
                  <Text style={[styles.paramSub, { color: C.mutedForeground }]}>
                    {param.method}
                    {param.paramName ? ` · ${param.paramName}=${param.paramValue || '...'}` : ''}
                    {param.defaultParamName ? ` · +${param.defaultParamName}` : ''}
                  </Text>
                </View>
                <Ionicons name={editingParamId === param.id ? 'chevron-up' : 'chevron-down'} size={16} color={C.mutedForeground} />
              </TouchableOpacity>
            ))}

            {/* Edit Panel */}
            {editingParam && (
              <View style={[styles.editPanel, { backgroundColor: C.background, borderColor: '#8B5CF630' }]}>
                <Text style={[styles.editPanelTitle, { color: '#8B5CF6' }]}>Edit Parameters</Text>

                <Text style={[styles.fieldLabel, { color: C.mutedForeground }]}>Button Label</Text>
                <TextInput
                  style={[styles.paramInput, { color: C.foreground, backgroundColor: C.card, borderColor: C.border }]}
                  value={editingParam.buttonLabel}
                  onChangeText={(t) => updateParam(editingParam.id, 'buttonLabel', t)}
                />

                <Text style={[styles.fieldLabel, { color: C.mutedForeground }]}>Method</Text>
                <View style={styles.methodRow}>
                  {(['GET', 'POST'] as const).map((m) => (
                    <TouchableOpacity
                      key={m}
                      style={[styles.methodBtn, {
                        backgroundColor: editingParam.method === m ? '#8B5CF6' : C.card,
                        borderColor: editingParam.method === m ? '#8B5CF6' : C.border,
                      }]}
                      onPress={() => updateParam(editingParam.id, 'method', m)}
                    >
                      <Text style={{ fontSize: 12, fontWeight: '700', color: editingParam.method === m ? '#FFF' : C.foreground }}>{m}</Text>
                    </TouchableOpacity>
                  ))}
                </View>

                {/* Custom Parameter (user editable) */}
                {editingParam.id !== 'fetch' && (
                  <>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: Spacing.xs, marginTop: Spacing.xs }}>
                      <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: '#10B981' }} />
                      <Text style={[styles.fieldLabel, { color: '#10B981' }]}>Custom Parameter (you set the value)</Text>
                    </View>

                    <Text style={[styles.fieldLabel, { color: C.mutedForeground }]}>Parameter Name</Text>
                    <TextInput
                      style={[styles.paramInput, { color: C.foreground, backgroundColor: C.card, borderColor: C.border }]}
                      placeholder={editingParam.id === 'delete' ? 'e.g. delete_question' : 'e.g. edit_question'}
                      placeholderTextColor={C.mutedForeground + '60'}
                      value={editingParam.paramName}
                      onChangeText={(t) => updateParam(editingParam.id, 'paramName', t)}
                      autoCapitalize="none"
                    />

                    <Text style={[styles.fieldLabel, { color: C.mutedForeground }]}>Parameter Value</Text>
                    <TextInput
                      style={[styles.paramInput, { color: C.foreground, backgroundColor: C.card, borderColor: C.border }]}
                      placeholder="Enter a number"
                      placeholderTextColor={C.mutedForeground + '60'}
                      value={editingParam.paramValue}
                      onChangeText={(t) => updateParam(editingParam.id, 'paramValue', t)}
                      keyboardType="numeric"
                    />
                  </>
                )}

                {/* Default Parameter (auto-populated, read-only) */}
                {editingParam.defaultParamName && (
                  <>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: Spacing.xs, marginTop: Spacing.sm }}>
                      <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: '#F59E0B' }} />
                      <Text style={[styles.fieldLabel, { color: '#F59E0B' }]}>Default Parameter (auto-populated)</Text>
                    </View>

                    <Text style={[styles.fieldLabel, { color: C.mutedForeground }]}>Parameter Name</Text>
                    <TextInput
                      style={[styles.paramInput, { color: C.mutedForeground, backgroundColor: C.muted + '30', borderColor: C.border }]}
                      value={editingParam.defaultParamName}
                      editable={false}
                    />

                    <Text style={[styles.fieldLabel, { color: C.mutedForeground }]}>Parameter Value</Text>
                    <View style={[styles.paramInput, { backgroundColor: C.muted + '30', borderColor: C.border, paddingHorizontal: Spacing.md, justifyContent: 'center' }]}>
                      <Text style={{ fontSize: 12, color: C.mutedForeground, fontStyle: 'italic' }}>
                        {editingParam.id === 'delete'
                          ? 'Auto: Hindi question text of deleted question'
                          : 'Auto: Full question JSON (both languages)'}
                      </Text>
                    </View>
                  </>
                )}

                {/* Fetch button - simple param */}
                {editingParam.id === 'fetch' && (
                  <>
                    <Text style={[styles.fieldLabel, { color: C.mutedForeground }]}>Parameter Name</Text>
                    <TextInput
                      style={[styles.paramInput, { color: C.foreground, backgroundColor: C.card, borderColor: C.border }]}
                      placeholder="e.g. category, limit"
                      placeholderTextColor={C.mutedForeground + '60'}
                      value={editingParam.paramName}
                      onChangeText={(t) => updateParam(editingParam.id, 'paramName', t)}
                      autoCapitalize="none"
                    />

                    <Text style={[styles.fieldLabel, { color: C.mutedForeground }]}>Parameter Value</Text>
                    <TextInput
                      style={[styles.paramInput, { color: C.foreground, backgroundColor: C.card, borderColor: C.border }]}
                      placeholder="e.g. electrician, 100"
                      placeholderTextColor={C.mutedForeground + '60'}
                      value={editingParam.paramValue}
                      onChangeText={(t) => updateParam(editingParam.id, 'paramValue', t)}
                      autoCapitalize="none"
                    />
                  </>
                )}

              </View>
            )}

            {/* Save */}
            <View style={styles.paramActions}>
              <TouchableOpacity
                style={[styles.saveParamsBtn, { backgroundColor: '#8B5CF6', opacity: paramsSaving ? 0.5 : 1, flex: 1 }]}
                onPress={handleSaveParams} disabled={paramsSaving}
              >
                {paramsSaving ? <ActivityIndicator size="small" color="#FFF" /> : <Ionicons name="save-outline" size={14} color="#FFF" />}
                <Text style={{ fontSize: 12, fontWeight: '700', color: '#FFF' }}>{paramsSaving ? '  Saving...' : '  Save Parameters'}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>

        {/* Go to Electrician */}
        <TouchableOpacity
          style={[styles.goBtn, { backgroundColor: '#F59E0B', opacity: isConnected ? 1 : 0.5 }]}
          onPress={() => isConnected ? router.push('/electrician') : Alert.alert('Configure First', 'Save your webhook URL first.')}
          disabled={!isConnected}
        >
          <Ionicons name="flash" size={18} color="#FFF" />
          <Text style={[styles.btnText, { color: '#FFF', fontSize: FontSize.md }]}>  Go to Electrician</Text>
        </TouchableOpacity>

        {/* ── Dynamic Subject N8N Sections ── */}
        {subjects.length > 0 && (
          <>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, marginTop: Spacing.md }}>
              <View style={{ flex: 1, height: 1, backgroundColor: C.border }} />
              <Text style={{ fontSize: 11, fontWeight: '800', color: C.mutedForeground, letterSpacing: 1 }}>SUBJECTS</Text>
              <View style={{ flex: 1, height: 1, backgroundColor: C.border }} />
            </View>
          </>
        )}

        {subjects.map((subject) => {
          const cfg = subConfigs[subject.id] || { webhookUrl: '', params: DEFAULT_PARAMS };
          const testResult = subTestResults[subject.id] || null;
          const editingSubParam = subEditingParamId?.startsWith(subject.id)
            ? cfg.params.find(p => p.id === subEditingParamId.split('|')[1])
            : null;

          return (
            <View key={subject.id} style={[styles.card, { backgroundColor: C.card, borderColor: subject.color + '40', borderWidth: 1.5 }]}>
              {/* Subject header */}
              <View style={[styles.cardHeader, { borderBottomColor: C.border }]}>
                <View style={[styles.iconBox, { backgroundColor: subject.color + '20' }]}>
                  <Ionicons name="book" size={20} color={subject.color} />
                </View>
                <Text style={[styles.cardTitle, { color: subject.color, flex: 1 }]}>{subject.name}</Text>
                <TouchableOpacity onPress={() => setSubEditingId(subEditingId === subject.id ? null : subject.id)}>
                  <Ionicons name={subEditingId === subject.id ? 'chevron-up' : 'chevron-down'} size={18} color={C.mutedForeground} />
                </TouchableOpacity>
              </View>

              {subEditingId === subject.id && (
                <View style={styles.cardBody}>
                  {/* Status badge */}
                  <View style={[styles.resultBadge, {
                    backgroundColor: cfg.webhookUrl ? '#10B98112' : '#F59E0B12',
                    borderColor: cfg.webhookUrl ? '#10B98130' : '#F59E0B30',
                  }]}>
                    <Ionicons name={cfg.webhookUrl ? 'checkmark-circle' : 'alert-circle'} size={14}
                      color={cfg.webhookUrl ? '#10B981' : '#F59E0B'} />
                    <Text style={{ fontSize: 12, fontWeight: '600', color: cfg.webhookUrl ? '#10B981' : '#F59E0B' }}>
                      {cfg.webhookUrl ? 'Configured' : 'Not configured'}
                    </Text>
                  </View>

                  {/* Webhook URL */}
                  <View style={[styles.inputRow, { backgroundColor: C.background, borderColor: C.border }]}>
                    <Ionicons name="link-outline" size={18} color={C.mutedForeground} style={{ marginRight: Spacing.sm }} />
                    <TextInput
                      style={[styles.input, { color: C.foreground }]}
                      placeholder="https://your-n8n.com/webhook/..."
                      placeholderTextColor={C.mutedForeground + '60'}
                      value={cfg.webhookUrl}
                      onChangeText={(t) => {
                        setSubConfigs(prev => ({ ...prev, [subject.id]: { ...prev[subject.id], webhookUrl: t } }));
                        if (testResult) setSubTestResults(prev => ({ ...prev, [subject.id]: null }));
                      }}
                      autoCapitalize="none" autoCorrect={false} keyboardType="url"
                    />
                    {cfg.webhookUrl.length > 0 && (
                      <TouchableOpacity onPress={() => {
                        setSubConfigs(prev => ({ ...prev, [subject.id]: { ...prev[subject.id], webhookUrl: '' } }));
                        setSubTestResults(prev => ({ ...prev, [subject.id]: null }));
                      }}>
                        <Ionicons name="close-circle" size={18} color={C.mutedForeground} />
                      </TouchableOpacity>
                    )}
                  </View>

                  {/* Save + Test */}
                  <View style={styles.buttonRow}>
                    <TouchableOpacity
                      style={[styles.saveBtn, { backgroundColor: subject.color, opacity: !cfg.webhookUrl.trim() ? 0.5 : 1 }]}
                      onPress={() => handleSubSaveUrl(subject.id)} disabled={!cfg.webhookUrl.trim()}
                    >
                      <Ionicons name="save-outline" size={16} color="#FFF" />
                      <Text style={[styles.btnText, { color: '#FFF' }]}>  Save</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[styles.testBtn, { backgroundColor: '#10B981', opacity: subTesting === subject.id ? 0.5 : 1 }]}
                      onPress={() => handleSubTest(subject.id)} disabled={subTesting === subject.id}
                    >
                      {subTesting === subject.id ? <ActivityIndicator size="small" color="#FFF" /> : <Ionicons name="pulse-outline" size={16} color="#FFF" />}
                      <Text style={[styles.btnText, { color: '#FFF' }]}>{subTesting === subject.id ? '  Testing...' : '  Test'}</Text>
                    </TouchableOpacity>
                  </View>

                  {testResult && (
                    <View style={[styles.resultBadge, {
                      backgroundColor: testResult === 'success' ? '#10B98112' : '#F43F5E12',
                      borderColor: testResult === 'success' ? '#10B98130' : '#F43F5E30',
                    }]}>
                      <Ionicons name={testResult === 'success' ? 'checkmark-circle' : 'close-circle'} size={14}
                        color={testResult === 'success' ? '#10B981' : '#F43F5E'} />
                      <Text style={{ fontSize: 12, fontWeight: '600', color: testResult === 'success' ? '#10B981' : '#F43F5E' }}>
                        {testResult === 'success' ? 'Webhook reachable' : 'Could not reach webhook'}
                      </Text>
                    </View>
                  )}

                  {/* Parameters */}
                  <Text style={[styles.fieldLabel, { color: C.mutedForeground, marginTop: Spacing.xs }]}>Parameters</Text>
                  {cfg.params.map((param) => (
                    <TouchableOpacity
                      key={param.id}
                      style={[styles.paramRow, { backgroundColor: C.background, borderColor: subEditingParamId === `${subject.id}|${param.id}` ? subject.color : C.border }]}
                      onPress={() => setSubEditingParamId(subEditingParamId === `${subject.id}|${param.id}` ? null : `${subject.id}|${param.id}`)}
                      activeOpacity={0.7}
                    >
                      <View style={[styles.paramIcon, { backgroundColor: param.id === 'delete' ? '#F43F5E18' : param.id === 'edit' ? '#F59E0B18' : '#8B5CF618' }]}>
                        <Ionicons name={param.id === 'fetch' ? 'cloud-download-outline' : param.id === 'delete' ? 'trash-outline' : 'pencil-outline'} size={16} color={param.id === 'delete' ? '#F43F5E' : param.id === 'edit' ? '#F59E0B' : '#8B5CF6'} />
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={[styles.paramLabel, { color: C.foreground }]}>{param.buttonLabel}</Text>
                        <Text style={[styles.paramSub, { color: C.mutedForeground }]}>
                          {param.method}
                          {param.paramName ? ` · ${param.paramName}=${param.paramValue || '...'}` : ''}
                          {param.defaultParamName ? ` · +${param.defaultParamName}` : ''}
                        </Text>
                      </View>
                      <Ionicons name={subEditingParamId === `${subject.id}|${param.id}` ? 'chevron-up' : 'chevron-down'} size={16} color={C.mutedForeground} />
                    </TouchableOpacity>
                  ))}

                  {/* Param edit panel */}
                  {editingSubParam && (
                    <View style={[styles.editPanel, { backgroundColor: C.background, borderColor: subject.color + '40' }]}>
                      <Text style={[styles.editPanelTitle, { color: subject.color }]}>Edit Parameters</Text>

                      <Text style={[styles.fieldLabel, { color: C.mutedForeground }]}>Button Label</Text>
                      <TextInput
                        style={[styles.paramInput, { color: C.foreground, backgroundColor: C.card, borderColor: C.border }]}
                        value={editingSubParam.buttonLabel}
                        onChangeText={(t) => updateSubParam(subject.id, editingSubParam.id, 'buttonLabel', t)}
                      />

                      <Text style={[styles.fieldLabel, { color: C.mutedForeground }]}>Method</Text>
                      <View style={styles.methodRow}>
                        {(['GET', 'POST'] as const).map((m) => (
                          <TouchableOpacity
                            key={m}
                            style={[styles.methodBtn, {
                              backgroundColor: editingSubParam.method === m ? subject.color : C.card,
                              borderColor: editingSubParam.method === m ? subject.color : C.border,
                            }]}
                            onPress={() => updateSubParam(subject.id, editingSubParam.id, 'method', m)}
                          >
                            <Text style={{ fontSize: 12, fontWeight: '700', color: editingSubParam.method === m ? '#FFF' : C.foreground }}>{m}</Text>
                          </TouchableOpacity>
                        ))}
                      </View>

                      {editingSubParam.id !== 'fetch' && (
                        <>
                          <View style={{ flexDirection: 'row', alignItems: 'center', gap: Spacing.xs, marginTop: Spacing.xs }}>
                            <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: '#10B981' }} />
                            <Text style={[styles.fieldLabel, { color: '#10B981' }]}>Custom Parameter</Text>
                          </View>
                          <Text style={[styles.fieldLabel, { color: C.mutedForeground }]}>Parameter Name</Text>
                          <TextInput
                            style={[styles.paramInput, { color: C.foreground, backgroundColor: C.card, borderColor: C.border }]}
                            placeholder={editingSubParam.id === 'delete' ? 'e.g. delete_question' : 'e.g. edit_question'}
                            placeholderTextColor={C.mutedForeground + '60'}
                            value={editingSubParam.paramName}
                            onChangeText={(t) => updateSubParam(subject.id, editingSubParam.id, 'paramName', t)}
                            autoCapitalize="none"
                          />
                          <Text style={[styles.fieldLabel, { color: C.mutedForeground }]}>Parameter Value</Text>
                          <TextInput
                            style={[styles.paramInput, { color: C.foreground, backgroundColor: C.card, borderColor: C.border }]}
                            placeholder="Enter a number"
                            placeholderTextColor={C.mutedForeground + '60'}
                            value={editingSubParam.paramValue}
                            onChangeText={(t) => updateSubParam(subject.id, editingSubParam.id, 'paramValue', t)}
                            keyboardType="numeric"
                          />
                        </>
                      )}

                      {editingSubParam.defaultParamName && (
                        <>
                          <View style={{ flexDirection: 'row', alignItems: 'center', gap: Spacing.xs, marginTop: Spacing.sm }}>
                            <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: '#F59E0B' }} />
                            <Text style={[styles.fieldLabel, { color: '#F59E0B' }]}>Default Parameter (auto)</Text>
                          </View>
                          <Text style={[styles.fieldLabel, { color: C.mutedForeground }]}>Parameter Name</Text>
                          <TextInput
                            style={[styles.paramInput, { color: C.mutedForeground, backgroundColor: C.muted + '30', borderColor: C.border }]}
                            value={editingSubParam.defaultParamName}
                            editable={false}
                          />
                        </>
                      )}

                      {editingSubParam.id === 'fetch' && (
                        <>
                          <Text style={[styles.fieldLabel, { color: C.mutedForeground }]}>Parameter Name</Text>
                          <TextInput
                            style={[styles.paramInput, { color: C.foreground, backgroundColor: C.card, borderColor: C.border }]}
                            placeholder="e.g. category, limit"
                            placeholderTextColor={C.mutedForeground + '60'}
                            value={editingSubParam.paramName}
                            onChangeText={(t) => updateSubParam(subject.id, editingSubParam.id, 'paramName', t)}
                            autoCapitalize="none"
                          />
                          <Text style={[styles.fieldLabel, { color: C.mutedForeground }]}>Parameter Value</Text>
                          <TextInput
                            style={[styles.paramInput, { color: C.foreground, backgroundColor: C.card, borderColor: C.border }]}
                            placeholder="e.g. math, 100"
                            placeholderTextColor={C.mutedForeground + '60'}
                            value={editingSubParam.paramValue}
                            onChangeText={(t) => updateSubParam(subject.id, editingSubParam.id, 'paramValue', t)}
                            autoCapitalize="none"
                          />
                        </>
                      )}
                    </View>
                  )}

                  <View style={styles.paramActions}>
                    <TouchableOpacity
                      style={[styles.saveParamsBtn, { backgroundColor: subject.color, flex: 1 }]}
                      onPress={() => handleSubSaveParams(subject.id)}
                    >
                      <Ionicons name="save-outline" size={14} color="#FFF" />
                      <Text style={{ fontSize: 12, fontWeight: '700', color: '#FFF' }}>  Save Parameters</Text>
                    </TouchableOpacity>
                  </View>

                  {/* Go to subject */}
                  <TouchableOpacity
                    style={[styles.goBtn, { backgroundColor: subject.color, opacity: cfg.webhookUrl ? 1 : 0.5 }]}
                    onPress={() => cfg.webhookUrl
                      ? router.push({ pathname: '/subject', params: { subjectId: subject.id, subjectName: subject.name } })
                      : Alert.alert('Configure First', 'Save your webhook URL first.')}
                    disabled={!cfg.webhookUrl}
                  >
                    <Ionicons name="book" size={18} color="#FFF" />
                    <Text style={[styles.btnText, { color: '#FFF', fontSize: FontSize.md }]}>  Go to {subject.name}</Text>
                  </TouchableOpacity>
                </View>
              )}
            </View>
          );
        })}

        <View style={{ height: 40 }} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingTop: Platform.OS === 'ios' ? 50 : 0, paddingBottom: Spacing.sm,
    paddingHorizontal: Spacing.md, borderBottomWidth: 1,
  },
  backBtn: { padding: Spacing.xs, width: 40, alignItems: 'center' },
  headerCenter: { flex: 1, alignItems: 'center' },
  headerTitle: { fontSize: FontSize.lg, fontWeight: '700' },
  content: { flex: 1 },
  contentInner: { padding: Spacing.md, gap: Spacing.md, paddingBottom: Spacing.xxxl * 2 },

  statusCard: {
    flexDirection: 'row', alignItems: 'center', gap: Spacing.md,
    padding: Spacing.lg, borderRadius: BorderRadius.xl, borderWidth: 1.5,
  },
  statusIconBox: { width: 48, height: 48, borderRadius: BorderRadius.lg, alignItems: 'center', justifyContent: 'center' },
  statusTitle: { fontSize: FontSize.lg, fontWeight: '700' },
  statusDesc: { fontSize: FontSize.xs, marginTop: 2 },

  card: { borderRadius: BorderRadius.lg, borderWidth: 1, overflow: 'hidden' },
  cardHeader: {
    flexDirection: 'row', alignItems: 'center', gap: Spacing.sm,
    padding: Spacing.lg, borderBottomWidth: 1,
  },
  iconBox: { width: 36, height: 36, borderRadius: BorderRadius.sm, alignItems: 'center', justifyContent: 'center' },
  cardTitle: { fontSize: FontSize.md, fontWeight: '700' },
  cardBody: { padding: Spacing.lg, gap: Spacing.md },

  fieldLabel: { fontSize: 12, fontWeight: '600', letterSpacing: 0.5, textTransform: 'uppercase' },
  fieldDesc: { fontSize: 12, lineHeight: 18 },
  inputRow: {
    flexDirection: 'row', alignItems: 'center',
    borderRadius: BorderRadius.lg, borderWidth: 1,
    paddingHorizontal: Spacing.lg, height: 50,
  },
  input: { flex: 1, fontSize: 13, fontWeight: '500', height: '100%' },

  buttonRow: { flexDirection: 'row', gap: Spacing.sm },
  saveBtn: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    paddingVertical: Spacing.md, borderRadius: BorderRadius.lg,
    boxShadow: '0 2px 4px rgba(0,0,0,0.15)',
  },
  testBtn: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    paddingVertical: Spacing.md, borderRadius: BorderRadius.lg,
    boxShadow: '0 2px 4px rgba(0,0,0,0.15)',
  },
  btnText: { fontSize: 13, fontWeight: '700', letterSpacing: 0.3 },

  resultBadge: {
    flexDirection: 'row', alignItems: 'center', gap: Spacing.sm,
    padding: Spacing.md, borderRadius: BorderRadius.md, borderWidth: 1,
  },

  paramRow: {
    flexDirection: 'row', alignItems: 'center', gap: Spacing.md,
    padding: Spacing.md, borderRadius: BorderRadius.md, borderWidth: 1,
  },
  paramIcon: { width: 32, height: 32, borderRadius: BorderRadius.sm, alignItems: 'center', justifyContent: 'center' },
  paramLabel: { fontSize: 13, fontWeight: '600' },
  paramSub: { fontSize: 11, marginTop: 1 },

  editPanel: {
    padding: Spacing.md, borderRadius: BorderRadius.md, borderWidth: 1,
    gap: Spacing.sm, marginTop: Spacing.xs,
  },
  editPanelTitle: { fontSize: 13, fontWeight: '700' },
  paramInput: {
    borderRadius: BorderRadius.sm, borderWidth: 1,
    paddingHorizontal: Spacing.md, height: 40, fontSize: 13,
  },
  methodRow: { flexDirection: 'row', gap: Spacing.sm },
  methodBtn: {
    flex: 1, alignItems: 'center', paddingVertical: 8,
    borderRadius: BorderRadius.sm, borderWidth: 1,
  },
  removeParamBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    paddingVertical: 8, borderRadius: BorderRadius.sm, borderWidth: 1, marginTop: Spacing.xs,
  },
  paramActions: { flexDirection: 'row', gap: Spacing.sm },
  addParamBtn: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    paddingVertical: Spacing.md, borderRadius: BorderRadius.lg, borderWidth: 1,
  },
  saveParamsBtn: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    paddingVertical: Spacing.md, borderRadius: BorderRadius.lg,
    boxShadow: '0 2px 4px rgba(0,0,0,0.15)',
  },

  goBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    paddingVertical: Spacing.lg, borderRadius: BorderRadius.lg,
    boxShadow: '0 3px 6px rgba(245,158,11,0.3)',
  },
});
