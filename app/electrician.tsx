import React, { useState, useEffect, useRef } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, ActivityIndicator,
  Alert, Platform, ScrollView, TextInput, Animated, Modal, Image,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useTheme, Spacing, BorderRadius, FontSize } from '../lib/theme';
import { getItem } from '../lib/storage';
import {
  insertMCQRows, getMCQCount, getTopicCounts,
  clearMCQTable, getMCQByIndex, MCQRow,
  getMCQRowsByTag, updateMCQRow,
} from '../lib/electrician-db';
import { removeQuestionTag } from '../lib/electrician-db';
import { Question } from '../lib/types';
import ShuffleScreen from '../components/ShuffleScreen';
import QuizInterface from '../components/QuizInterface';

const N8N_WEBHOOK_KEY = 'examforge_n8n_webhook_url';
const N8N_PARAMS_KEY = 'examforge_n8n_params';

// ─── Module definitions ───
const MODULES: { title: string; color: string; icon: any; topics: string[] }[] = [
  {
    title: 'Module 1 — Basics', color: '#F59E0B', icon: 'flash-outline',
    topics: [
      'Basic_Electricity', 'Resistor', 'DC_Theory', 'Capacitor_and_Inductor',
      'AC_Theory', 'Poly_Phase_System', 'Electrolysis_Cell_and_Battery', 'Magnetism',
    ],
  },
  {
    title: 'Module 2 — Components', color: '#4F46E5', icon: 'construct-outline',
    topics: [
      'Occupational_Safety_and_Health', 'Common_Tools_for_an_Electrician', 'Electrical_Symbol',
      'Conductor_Semi_Conductor_and_Insulator', 'Soldering', 'Electrical_Appliances',
      'Earthing_and_Underground_Cable', 'Cable_and_Joints', 'Wiring', 'Electrical_Accessories',
    ],
  },
  {
    title: 'Module 3 — Machines', color: '#3B82F6', icon: 'settings-outline',
    topics: [
      'DC_Machine', 'DC_Generator', 'DC_Motor', 'Alternator', 'Transformer',
      'Single_Phase_Motor', 'Three_Phase_Induction_Motor', 'Three_Phase_Synchronous_Motor', 'Winding',
    ],
  },
  {
    title: 'Module 4 — Electronics', color: '#10B981', icon: 'hardware-chip-outline',
    topics: [
      'Digital_Electronics', 'Basic_Electronics', 'Diodes', 'Rectifier',
      'Transistor_and_FET', 'Amplifier_and_Oscillator', 'CRO', 'Power_Electronics',
    ],
  },
  {
    title: 'Module 5 — Power System', color: '#F43F5E', icon: 'flash',
    topics: [
      'Electrical_Measuring_Instruments', 'Generation', 'Transmission_and_Distribution',
      'Protection_Devices', 'Illumination',
    ],
  },
];

const ALL_TOPICS = MODULES.flatMap(m => m.topics);

type TopicMap = Record<string, number>;

function fmtTopic(raw: string): string {
  return raw.replace(/_/g, ' ');
}

/** Convert MCQRow (Hindi) → Question format */
function mcqRowToQuestion(row: MCQRow): Question {
  const options = [row.a_hindi, row.b_hindi, row.c_hindi, row.d_hindi, row.e_hindi].filter(Boolean);
  const answerText = row.answer?.trim().toLowerCase() || '';
  let correctIdx = 0;
  if (answerText === row.a_hindi?.trim().toLowerCase()) correctIdx = 0;
  else if (answerText === row.b_hindi?.trim().toLowerCase()) correctIdx = 1;
  else if (answerText === row.c_hindi?.trim().toLowerCase()) correctIdx = 2;
  else if (answerText === row.d_hindi?.trim().toLowerCase()) correctIdx = 3;
  else if (row.e_hindi && answerText === row.e_hindi.trim().toLowerCase()) correctIdx = 4;
  else {
    const letterMatch = answerText.match(/^([a-e])/);
    if (letterMatch) correctIdx = letterMatch[1].charCodeAt(0) - 97;
  }
  return {
    id: `ecq_${row.id}`,
    question: row.question || row.question_en || '',
    options,
    correctAnswer: correctIdx,
    explanation: row.explanation || row.explaination_en || '',
    difficulty: 'medium' as const,
    topic: row.index || '',
  };
}

export default function ElectricianScreen() {
  const router = useRouter();
  const { colors: C } = useTheme();

  // ─── Overview state ───
  const [loading, setLoading] = useState(true);
  const [fetching, setFetching] = useState(false);
  const [totalCount, setTotalCount] = useState(0);
  const [topicCount, setTopicCount] = useState(0);
  const [topicMap, setTopicMap] = useState<TopicMap>({});
  const [webhookUrl, setWebhookUrl] = useState('');
  const [clearing, setClearing] = useState(false);

  // ─── Quiz state ───
  const [view, setView] = useState<'overview' | 'shuffle' | 'quiz' | 'results' | 'edit'>('overview');
  const [quizQuestions, setQuizQuestions] = useState<Question[]>([]);
  const [quizAnswers, setQuizAnswers] = useState<Record<string, number>>({});
  const [quizTime, setQuizTime] = useState(0);
  const [quizTitle, setQuizTitle] = useState('');
  const [quizBilingual, setQuizBilingual] = useState<Record<string, { question_en: string; options_en: string[]; explanation_en: string }>>({});

  // ─── Edit state ───
  const [editQuestions, setEditQuestions] = useState<MCQRow[]>([]);
  const [editExpandedId, setEditExpandedId] = useState<number | null>(null);
  const [editForm, setEditForm] = useState<Record<string, string>>({});
  const [editSaving, setEditSaving] = useState(false);
  const [editSaveStatus, setEditSaveStatus] = useState<'idle' | 'sending' | 'done'>('idle');
  const [editTab, setEditTab] = useState<'hindi' | 'english'>('hindi');
  const [topicModalVisible, setTopicModalVisible] = useState(false);
  const [topicModalPrefix, setTopicModalPrefix] = useState('');
  // Ref always kept in sync via updateEditField — avoids stale state on save
  const editFormRef = useRef<Record<string, string>>({});
  const updateEditField = (key: string, value: string) => {
    editFormRef.current = { ...editFormRef.current, [key]: value };
    setEditForm(prev => ({ ...prev, [key]: value }));
  };

  const loadOverview = async () => {
    setLoading(true);
    try {
      const url = await getItem(N8N_WEBHOOK_KEY);
      setWebhookUrl(url || '');
      const count = await getMCQCount();
      setTotalCount(count);
      if (count > 0) {
        const tc = await getTopicCounts();
        const map: TopicMap = {};
        for (const t of tc) map[t.name] = t.count;
        setTopicMap(map);
        setTopicCount(tc.length);
      } else { setTopicMap({}); setTopicCount(0); }
    } catch { setTotalCount(0); setTopicCount(0); setTopicMap({}); }
    finally { setLoading(false); }
  };

  useEffect(() => { loadOverview(); }, []);

  const handleEditOpen = async () => {
    try {
      const rows = await getMCQRowsByTag('edit');
      setEditQuestions(rows);
      setEditExpandedId(null);
      setEditForm({});
      setView('edit');
    } catch (e: any) {
      Alert.alert('Error', e?.message || 'Failed to load tagged questions');
    }
  };

  const handleEditSave = async (row: MCQRow) => {
    setEditSaving(true);
    setEditSaveStatus('sending');
    try {
      const prefix = `ecq_${row.id}_`;
      // Always read from ref to get latest form data (avoids stale state)
      const currentForm = { ...editFormRef.current };
      const fields: Record<string, string> = {};
      for (const [k, v] of Object.entries(currentForm)) {
        if (k.startsWith(prefix)) fields[k.slice(prefix.length)] = v;
      }
      if (Object.keys(fields).length > 0) {
        await updateMCQRow(row.id, fields);
      }
      // Merge edited fields into row before sending so n8n gets updated data on first click
      const mergedRow = { ...row, ...fields } as MCQRow;
      await sendN8NEdit(mergedRow);
      // Update local list with merged data
      setEditQuestions(prev => prev.map(r => r.id === row.id ? mergedRow : r));
      setEditSaveStatus('done');
      setEditExpandedId(null);
      setEditForm({});
      editFormRef.current = {};
      setTimeout(() => setEditSaveStatus('idle'), 1500);
    } catch (e: any) {
      setEditSaveStatus('idle');
      Alert.alert('Error', e?.message || 'Save failed');
    } finally { setEditSaving(false); }
  };

  const handleUntag = async (row: MCQRow) => {
    try {
      await removeQuestionTag(`ecq_${row.id}`, 'edit');
      setEditQuestions(prev => prev.filter(r => r.id !== row.id));
      setEditExpandedId(null);
    } catch (e: any) {
      Alert.alert('Error', e?.message || 'Untag failed');
    }
  };

  const sendN8NEdit = async (row: MCQRow) => {
    try {
      const url = await getItem(N8N_WEBHOOK_KEY);
      if (!url) return;
      const paramsJson = await getItem(N8N_PARAMS_KEY);
      let customParamName = 'edit_question';
      let customParamValue = '';
      let defaultParamName = 'question_data';
      let method = 'GET';
      if (paramsJson) {
        try {
          const params = JSON.parse(paramsJson);
          const p = params.find((x: any) => x.id === 'edit');
          if (p) {
            if (p.paramName) customParamName = p.paramName;
            if (p.paramValue !== undefined) customParamValue = p.paramValue;
            if (p.defaultParamName) defaultParamName = p.defaultParamName;
            if (p.method) method = p.method;
          }
        } catch {}
      }
      // Build full question JSON for default param
      const questionData = {
        id: row.id,
        question: row.question, a_hindi: row.a_hindi, b_hindi: row.b_hindi,
        c_hindi: row.c_hindi, d_hindi: row.d_hindi, answer: row.answer,
        explanation: row.explanation, question_en: row.question_en,
        a_eng: row.a_eng, b_eng: row.b_eng, c_eng: row.c_eng,
        d_eng: row.d_eng, answer_en: row.answer_en,
        explaination_en: row.explaination_en, index: row.index || '',
      };
      // Custom param: user's number
      let fullUrl = `${url}${url.includes('?') ? '&' : '?'}${encodeURIComponent(customParamName)}=${encodeURIComponent(customParamValue || String(row.id))}`;
      // Default param: full question JSON
      fullUrl += `&${encodeURIComponent(defaultParamName)}=${encodeURIComponent(JSON.stringify(questionData))}`;
      fetch(fullUrl, { method: method as any, headers: { Accept: 'application/json' } }).catch(() => {});
    } catch {}
  };

  const handleFetch = async () => {
    if (!webhookUrl) { Alert.alert('No Webhook', 'Configure in Settings → N8N.'); return; }
    setFetching(true);
    try {
      const savedParamsJson = await getItem(N8N_PARAMS_KEY);
      let fetchParam: { method: string; paramName: string; paramValue: string } | null = null;
      if (savedParamsJson) {
        try { fetchParam = JSON.parse(savedParamsJson).find((p: any) => p.id === 'fetch') || null; } catch {}
      }
      let url = webhookUrl;
      if (fetchParam?.paramName) {
        url += `${url.includes('?') ? '&' : '?'}${encodeURIComponent(fetchParam.paramName)}=${encodeURIComponent(fetchParam.paramValue)}`;
      }
      const ctrl = new AbortController();
      const t = setTimeout(() => ctrl.abort(), 60000);
      const res = await fetch(url, { method: (fetchParam?.method || 'GET') as any, signal: ctrl.signal, headers: { Accept: 'application/json' } });
      clearTimeout(t);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      const items: any[] = Array.isArray(data) ? data : data.questions || data.data || [];
      if (!items.length) { Alert.alert('Empty', 'N8N returned 0 records.'); setFetching(false); return; }
      await clearMCQTable();
      await insertMCQRows(items);
      await loadOverview();
      Alert.alert('Fetched', `${items.length} questions stored.`);
    } catch (err: any) {
      Alert.alert('Failed', err?.name === 'AbortError' ? 'Timed out.' : err?.message || 'Fetch error.');
    } finally { setFetching(false); }
  };

  const handleClear = async () => {
    setClearing(true);
    try {
      await clearMCQTable();
      setTotalCount(0); setTopicCount(0); setTopicMap({});
    } catch (e: any) { Alert.alert('Error', e?.message); } finally { setClearing(false); }
  };

  // ─── Topic click → start quiz ───
  const handleTopicPress = async (name: string) => {
    try {
      const rows = await getMCQByIndex(name);
      if (rows.length === 0) { Alert.alert('No Questions', `No questions found for "${fmtTopic(name)}".`); return; }
      const questions = rows.map(mcqRowToQuestion);
      // Build bilingual data
      const bi: Record<string, { question_en: string; options_en: string[]; explanation_en: string }> = {};
      for (let i = 0; i < rows.length; i++) {
        const r = rows[i];
        bi[questions[i].id] = {
          question_en: r.question_en || '',
          options_en: [r.a_eng, r.b_eng, r.c_eng, r.d_eng, r.e_engl].filter(Boolean),
          explanation_en: r.explaination_en || '',
        };
      }
      setQuizBilingual(bi);
      setQuizQuestions(questions);
      setQuizTitle(fmtTopic(name));
      setView('shuffle');
    } catch (e: any) {
      Alert.alert('Error', e?.message || 'Failed to load questions');
    }
  };

  const handleShuffleConfirm = (shuffled: Question[]) => {
    setQuizQuestions(shuffled);
    setView('quiz');
  };

  const handleShuffleCancel = () => {
    setView('overview');
    setQuizQuestions([]);
  };

  const handleQuizComplete = (answers: Record<string, number>, time: number) => {
    setQuizAnswers(answers);
    setQuizTime(time);
    setView('results');
  };

  const handleRetry = () => {
    setQuizAnswers({});
    setView('shuffle');
  };

  const handleNewTest = () => {
    setView('overview');
    setQuizQuestions([]);
    setQuizAnswers({});
  };

  const hasData = totalCount > 0;

  // ─── Quiz views ───
  if (view === 'shuffle') {
    return <ShuffleScreen questions={quizQuestions} onConfirm={handleShuffleConfirm} onCancel={handleShuffleCancel} testTitle={quizTitle} />;
  }
  if (view === 'quiz') {
    return (
      <QuizInterface
        questions={quizQuestions}
        onComplete={handleQuizComplete}
        bilingualData={quizBilingual}
        onQuestionDeleted={(qid) => {
          setQuizQuestions(prev => prev.filter(q => q.id !== qid));
          setQuizBilingual(prev => { const n = { ...prev }; delete n[qid]; return n; });
        }}
      />
    );
  }
  if (view === 'results') {
    return (
      <View style={[styles.container, { backgroundColor: C.background }]}>
        <View style={[styles.header, { backgroundColor: C.card, borderBottomColor: C.border }]}>
          <TouchableOpacity onPress={handleNewTest} style={styles.backBtn}>
            <Ionicons name="arrow-back" size={24} color={C.foreground} />
          </TouchableOpacity>
          <Text style={[styles.headerTitle, { color: C.foreground }]}>Results</Text>
          <View style={{ width: 36 }} />
        </View>
        {(() => {
          const correctCount = quizQuestions.filter(q => quizAnswers[q.id] === q.correctAnswer).length;
          const total = quizQuestions.length;
          const pct = total > 0 ? Math.round((correctCount / total) * 100) : 0;
          const grade = pct >= 80 ? 'A' : pct >= 60 ? 'B' : pct >= 40 ? 'C' : 'F';
          const gradeColor = pct >= 80 ? '#10B981' : pct >= 60 ? C.primary : pct >= 40 ? '#F59E0B' : '#F43F5E';
          const mins = Math.floor(quizTime / 60);
          const secs = quizTime % 60;
          return (
            <ScrollView contentContainerStyle={styles.resultsContent}>
              <View style={[styles.resultsCard, { backgroundColor: C.card, borderColor: C.border }]}>
                <View style={[styles.resultsGradeCircle, { backgroundColor: gradeColor + '18', borderColor: gradeColor }]}>
                  <Text style={[styles.resultsGrade, { color: gradeColor }]}>{grade}</Text>
                </View>
                <Text style={[styles.resultsScore, { color: C.foreground }]}>{correctCount}/{total}</Text>
                <Text style={{ fontSize: 13, color: C.mutedForeground }}>{pct}% correct · {mins}m {secs}s</Text>
                <Text style={{ fontSize: 12, color: C.mutedForeground, marginTop: 4 }}>{quizTitle}</Text>
              </View>

              {/* Per-question review */}
              {quizQuestions.map((q, i) => {
                const userAns = quizAnswers[q.id];
                const isCorrect = userAns === q.correctAnswer;
                return (
                  <View key={q.id} style={[styles.reviewCard, { backgroundColor: C.card, borderColor: isCorrect ? '#10B98140' : '#F43F5E40' }]}>
                    <View style={styles.reviewHeader}>
                      <View style={[styles.reviewBadge, { backgroundColor: isCorrect ? '#10B98120' : '#F43F5E20' }]}>
                        <Ionicons name={isCorrect ? 'checkmark' : 'close'} size={12} color={isCorrect ? '#10B981' : '#F43F5E'} />
                      </View>
                      <Text style={[styles.reviewQ, { color: C.foreground }]} numberOfLines={2}>{i + 1}. {q.question}</Text>
                    </View>
                    {q.options.map((opt, oi) => {
                      const isThis = oi === userAns;
                      const isAnswer = oi === q.correctAnswer;
                      return (
                        <View key={oi} style={[styles.reviewOpt, {
                          backgroundColor: isAnswer ? '#10B98112' : isThis ? '#F43F5E12' : 'transparent',
                          borderColor: isAnswer ? '#10B98130' : isThis ? '#F43F5E30' : C.border,
                        }]}>
                          <Text style={{ fontSize: 10, fontWeight: '700', color: isAnswer ? '#10B981' : isThis ? '#F43F5E' : C.mutedForeground }}>
                            {String.fromCharCode(65 + oi)}
                          </Text>
                          <Text style={{ fontSize: 11, color: C.foreground, flex: 1 }} numberOfLines={2}>{opt}</Text>
                          {isAnswer && <Ionicons name="checkmark-circle" size={14} color="#10B981" />}
                          {isThis && !isAnswer && <Ionicons name="close-circle" size={14} color="#F43F5E" />}
                        </View>
                      );
                    })}
                    {q.explanation ? (
                      <Text style={{ fontSize: 10, color: C.mutedForeground, marginTop: 4, lineHeight: 15 }}>{q.explanation}</Text>
                    ) : null}
                  </View>
                );
              })}

              <View style={styles.resultsActions}>
                <TouchableOpacity style={[styles.resultsBtn, { backgroundColor: C.primary }]} onPress={handleRetry}>
                  <Ionicons name="refresh" size={16} color="#FFF" />
                  <Text style={{ fontSize: 13, fontWeight: '700', color: '#FFF' }}>  Retry</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[styles.resultsBtn, { backgroundColor: C.muted }]} onPress={handleNewTest}>
                  <Ionicons name="arrow-back" size={16} color={C.foreground} />
                  <Text style={{ fontSize: 13, fontWeight: '700', color: C.foreground }}>  Back</Text>
                </TouchableOpacity>
              </View>
            </ScrollView>
          );
        })()}
      </View>
    );
  }

  // ─── Edit View ───
  if (view === 'edit') {
    return (
      <View style={[styles.container, { backgroundColor: C.background }]}>
        {/* Header */}
        <View style={[styles.header, { backgroundColor: C.card, borderBottomColor: C.border }]}>
          <TouchableOpacity onPress={() => setView('overview')} style={styles.backBtn}>
            <Ionicons name="arrow-back" size={24} color={C.foreground} />
          </TouchableOpacity>
          <Text style={[styles.headerTitle, { color: C.foreground }]}>Edit Questions ({editQuestions.length})</Text>
          <View style={{ width: 40 }} />
        </View>

        {/* Success indicator */}
        {editSaveStatus === 'done' && (
          <View style={[styles.editSuccessBanner, { backgroundColor: '#10B98118', borderBottomColor: '#10B98130' }]}>
            <Ionicons name="checkmark-circle" size={16} color="#10B981" />
            <Text style={{ fontSize: 12, fontWeight: '600', color: '#10B981', marginLeft: 6 }}>Saved & sent to n8n</Text>
          </View>
        )}

        {editQuestions.length === 0 ? (
          <View style={styles.center}>
            <Ionicons name="checkmark-circle-outline" size={48} color="#10B981" />
            <Text style={{ fontSize: 14, fontWeight: '600', color: C.foreground, marginTop: 8 }}>All clear!</Text>
            <Text style={{ fontSize: 12, color: C.mutedForeground, marginTop: 4 }}>No questions tagged for editing</Text>
          </View>
        ) : (
          <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: Spacing.md, gap: Spacing.md, paddingBottom: 40 }}>
            {editQuestions.map((row) => {
              const isExpanded = editExpandedId === row.id;
              const prefix = `ecq_${row.id}_`;
              return (
                <View key={row.id} style={[styles.editCard, { backgroundColor: C.card, borderColor: isExpanded ? '#F59E0B40' : C.border }]}>
                  {/* Card header */}
                  <TouchableOpacity
                    style={styles.editCardHeader}
                    onPress={() => {
                      if (isExpanded) { setEditExpandedId(null); setEditForm({}); editFormRef.current = {}; }
                      else {
                        setEditExpandedId(row.id);
                        const initForm = {
                          [`${prefix}index`]: row.index || '',
                          [`${prefix}question`]: row.question || '',
                          [`${prefix}a_hindi`]: row.a_hindi || '',
                          [`${prefix}b_hindi`]: row.b_hindi || '',
                          [`${prefix}c_hindi`]: row.c_hindi || '',
                          [`${prefix}d_hindi`]: row.d_hindi || '',
                          [`${prefix}answer`]: row.answer || '',
                          [`${prefix}explanation`]: row.explanation || '',
                          [`${prefix}question_en`]: row.question_en || '',
                          [`${prefix}a_eng`]: row.a_eng || '',
                          [`${prefix}b_eng`]: row.b_eng || '',
                          [`${prefix}c_eng`]: row.c_eng || '',
                          [`${prefix}d_eng`]: row.d_eng || '',
                          [`${prefix}answer_en`]: row.answer_en || '',
                          [`${prefix}explaination_en`]: row.explaination_en || '',
                        };
                        editFormRef.current = initForm;
                        setEditForm(initForm);
                      }
                    }}
                    activeOpacity={0.7}
                  >
                    <View style={[styles.editCardIcon, { backgroundColor: '#F59E0B18' }]}>
                      <Ionicons name="pencil" size={14} color="#F59E0B" />
                    </View>
                    <Text style={[styles.editCardText, { color: C.foreground }]} numberOfLines={2}>
                      {row.question || row.question_en || 'Untitled'}
                    </Text>
                    {row.index ? (
                      <View style={[styles.editIndexBadge, { backgroundColor: '#F59E0B15' }]}>
                        <Text style={{ fontSize: 9, fontWeight: '700', color: '#F59E0B' }} numberOfLines={1}>{row.index}</Text>
                      </View>
                    ) : null}
                    <Ionicons name={isExpanded ? 'chevron-up' : 'chevron-down'} size={18} color={C.mutedForeground} />
                  </TouchableOpacity>

                  {/* Expanded form */}
                  {isExpanded && (
                    <View style={styles.editCardBody}>
                      {/* Index / Topic Dropdown */}
                      <View style={[styles.editSection, { backgroundColor: C.background, borderColor: C.border }]}>
                        <View style={styles.editSectionHeader}>
                          <Ionicons name="pricetag-outline" size={12} color="#F59E0B" />
                          <Text style={[styles.editSectionTitle, { color: '#F59E0B' }]}>Index / Topic</Text>
                        </View>
                        <TouchableOpacity
                          style={[styles.editInputFull, {
                            backgroundColor: C.card, borderColor: C.border,
                            flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
                          }]}
                          activeOpacity={0.7}
                          onPress={() => { setTopicModalPrefix(`${prefix}index`); setTopicModalVisible(true); }}
                        >
                          <Text style={{
                            fontSize: 13, flex: 1,
                            color: editForm[`${prefix}index`] ? C.foreground : C.mutedForeground + '80',
                          }} numberOfLines={1}>
                            {editForm[`${prefix}index`] ? fmtTopic(editForm[`${prefix}index`]) : 'Select topic...'}
                          </Text>
                          <Ionicons name="chevron-down" size={16} color={C.mutedForeground} />
                        </TouchableOpacity>
                      </View>

                      {/* Hindi Section */}
                      <View style={[styles.editSection, { backgroundColor: '#FEF3C708', borderColor: '#F59E0B20' }]}>
                        <View style={styles.editSectionHeader}>
                          <Ionicons name="language-outline" size={12} color="#F59E0B" />
                          <Text style={[styles.editSectionTitle, { color: '#F59E0B' }]}>हिंदी (Hindi)</Text>
                        </View>
                        {[
                          { key: 'question', label: 'प्रश्न', multiline: true },
                          { key: 'a_hindi', label: 'A' },
                          { key: 'b_hindi', label: 'B' },
                          { key: 'c_hindi', label: 'C' },
                          { key: 'd_hindi', label: 'D' },
                          { key: 'answer', label: 'उत्तर' },
                          { key: 'explanation', label: 'व्याख्या', multiline: true },
                        ].map(({ key, label, multiline }) => (
                          <View key={key} style={{ marginBottom: Spacing.sm }}>
                            <Text style={[styles.editFieldLabel, { color: C.mutedForeground }]}>{label}</Text>
                            <TextInput
                              style={[
                                styles.editInputFull,
                                { color: C.foreground, backgroundColor: C.card, borderColor: C.border },
                                multiline && { height: 64, textAlignVertical: 'top' },
                              ]}
                              multiline={multiline}
                              value={editForm[`${prefix}${key}`] || ''}
                              onChangeText={(t) => updateEditField(`${prefix}${key}`, t)}
                            />
                          </View>
                        ))}
                      </View>

                      {/* English Section */}
                      <View style={[styles.editSection, { backgroundColor: '#EEF2FF08', borderColor: '#6366F120' }]}>
                        <View style={styles.editSectionHeader}>
                          <Ionicons name="language-outline" size={12} color={C.primary} />
                          <Text style={[styles.editSectionTitle, { color: C.primary }]}>English</Text>
                        </View>
                        {[
                          { key: 'question_en', label: 'Question', multiline: true },
                          { key: 'a_eng', label: 'A' },
                          { key: 'b_eng', label: 'B' },
                          { key: 'c_eng', label: 'C' },
                          { key: 'd_eng', label: 'D' },
                          { key: 'answer_en', label: 'Answer' },
                          { key: 'explaination_en', label: 'Explanation', multiline: true },
                        ].map(({ key, label, multiline }) => (
                          <View key={key} style={{ marginBottom: Spacing.sm }}>
                            <Text style={[styles.editFieldLabel, { color: C.mutedForeground }]}>{label}</Text>
                            <TextInput
                              style={[
                                styles.editInputFull,
                                { color: C.foreground, backgroundColor: C.card, borderColor: C.border },
                                multiline && { height: 64, textAlignVertical: 'top' },
                              ]}
                              multiline={multiline}
                              value={editForm[`${prefix}${key}`] || ''}
                              onChangeText={(t) => updateEditField(`${prefix}${key}`, t)}
                            />
                          </View>
                        ))}
                      </View>

                      {/* Action Buttons */}
                      <View style={styles.editActions}>
                        <TouchableOpacity
                          style={[styles.editSaveBtn, { opacity: editSaving ? 0.6 : 1 }]}
                          onPress={() => handleEditSave(row)} disabled={editSaving}
                        >
                          {editSaving ? (
                            <Ionicons name="sync" size={15} color="#FFF" />
                          ) : (
                            <Ionicons name="checkmark-circle" size={15} color="#FFF" />
                          )}
                          <Text style={{ fontSize: 13, fontWeight: '700', color: '#FFF' }}>
                            {editSaving ? '  Saving...' : '  Save & Send'}
                          </Text>
                        </TouchableOpacity>
                        <TouchableOpacity style={styles.editUntagBtn} onPress={() => handleUntag(row)}>
                          <Ionicons name="close-circle-outline" size={15} color="#F43F5E" />
                          <Text style={{ fontSize: 12, fontWeight: '600', color: '#F43F5E' }}> Remove</Text>
                        </TouchableOpacity>
                      </View>
                    </View>
                  )}
                </View>
              );
            })}
          </ScrollView>
        )}

        {/* Topic Picker Modal */}
        <Modal visible={topicModalVisible} animationType="slide" transparent>
          <View style={styles.topicModalOverlay}>
            <View style={[styles.topicModalSheet, { backgroundColor: C.card, height: '65%' }]}>
              <View style={[styles.topicModalHeader, { borderBottomColor: C.border }]}>
                <Text style={{ fontSize: 15, fontWeight: '700', color: C.foreground }}>Select Topic</Text>
                <TouchableOpacity onPress={() => setTopicModalVisible(false)} style={{ padding: 4 }}>
                  <Ionicons name="close" size={22} color={C.mutedForeground} />
                </TouchableOpacity>
              </View>
              <ScrollView contentContainerStyle={{ paddingBottom: 40 }} showsVerticalScrollIndicator>
                {MODULES.map((mod) => (
                  <View key={mod.title}>
                    <View style={[styles.topicModalSection, { backgroundColor: mod.color + '10' }]}>
                      <Ionicons name={mod.icon} size={13} color={mod.color} />
                      <Text style={{ fontSize: 11, fontWeight: '800', color: mod.color }}>{mod.title}</Text>
                    </View>
                    {mod.topics.map((topic) => {
                      const currentVal = editForm[topicModalPrefix] || '';
                      const isSelected = currentVal === topic;
                      return (
                        <TouchableOpacity
                          key={topic}
                          style={[styles.topicModalItem, {
                            backgroundColor: isSelected ? mod.color + '15' : 'transparent',
                            borderLeftColor: isSelected ? mod.color : 'transparent',
                          }]}
                          onPress={() => {
                            updateEditField(topicModalPrefix, topic);
                            setTopicModalVisible(false);
                          }}
                          activeOpacity={0.6}
                        >
                          <Text style={{
                            fontSize: 13, fontWeight: isSelected ? '700' : '500',
                            color: isSelected ? mod.color : C.foreground, flex: 1,
                          }} numberOfLines={1}>{fmtTopic(topic)}</Text>
                          {isSelected && <Ionicons name="checkmark-circle" size={16} color={mod.color} />}
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                ))}
              </ScrollView>
            </View>
          </View>
        </Modal>
      </View>
    );
  }

  // ─── Loading ───
  if (loading) {
    return (
      <View style={[styles.container, { backgroundColor: C.background }]}>
        <View style={[styles.header, { backgroundColor: C.card, borderBottomColor: C.border }]}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
            <Ionicons name="arrow-back" size={24} color={C.foreground} />
          </TouchableOpacity>
          <Text style={[styles.headerTitle, { color: C.foreground }]}>Electrician</Text>
          <View style={{ width: 36 }} />
        </View>
        <View style={styles.center}>
          <ActivityIndicator size="large" color="#F59E0B" />
          <Text style={{ fontSize: 13, color: C.mutedForeground, marginTop: 8 }}>Loading...</Text>
        </View>
      </View>
    );
  }

  // ─── Empty ───
  if (!hasData) {
    return (
      <View style={[styles.container, { backgroundColor: C.background }]}>
        <View style={[styles.header, { backgroundColor: C.card, borderBottomColor: C.border }]}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
            <Ionicons name="arrow-back" size={24} color={C.foreground} />
          </TouchableOpacity>
          <Text style={[styles.headerTitle, { color: C.foreground }]}>Electrician</Text>
          <View style={{ width: 36 }} />
        </View>
        <View style={styles.center}>
          <View style={[styles.logoOuter, { backgroundColor: '#F59E0B10' }]}>
            <View style={[styles.logoInner, { backgroundColor: '#F59E0B18', overflow: 'hidden' }]}>
              <Image source={require('../assets/exam-forge-transparant.png')} style={{ width: 72, height: 72, resizeMode: 'contain' }} />
            </View>
          </View>
          <Text style={[styles.title, { color: C.foreground }]}>N8N Data Fetcher</Text>
          <Text style={[styles.subtitle, { color: C.mutedForeground }]}>Fetch MCQ questions from your{'\n'}N8N workflow</Text>
          {!webhookUrl && (
            <TouchableOpacity style={[styles.setupBtn, { backgroundColor: '#EF4444' }]} onPress={() => router.push('/n8n')}>
              <Ionicons name="settings-outline" size={16} color="#FFF" />
              <Text style={{ fontSize: 13, fontWeight: '700', color: '#FFF' }}>  Setup Webhook</Text>
            </TouchableOpacity>
          )}
          {webhookUrl && (
            <TouchableOpacity style={[styles.fetchBtn, { backgroundColor: '#F59E0B', opacity: fetching ? 0.5 : 1 }]}
              onPress={handleFetch} disabled={fetching}>
              {fetching ? <ActivityIndicator size="small" color="#FFF" /> : <Ionicons name="cloud-download-outline" size={20} color="#FFF" />}
              <Text style={{ fontSize: 15, fontWeight: '700', color: '#FFF' }}>{fetching ? '  Fetching...' : '  Fetch Data'}</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>
    );
  }

  // ─── Has Data: Modules ───
  return (
    <View style={[styles.container, { backgroundColor: C.background }]}>
      <View style={[styles.header, { backgroundColor: C.card, borderBottomColor: C.border }]}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={24} color={C.foreground} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: C.foreground }]}>Electrician</Text>
        <TouchableOpacity onPress={handleEditOpen} style={{ padding: Spacing.xs }}>
          <Ionicons name="pencil-outline" size={20} color="#F59E0B" />
        </TouchableOpacity>
      </View>

      <ScrollView style={{ flex: 1 }} contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {/* Stats */}
        <View style={styles.statsRow}>
          <View style={[styles.statCard, { backgroundColor: '#F59E0B10', borderColor: '#F59E0B25' }]}>
            <View style={[styles.statIcon, { backgroundColor: '#F59E0B18' }]}>
              <Ionicons name="document-text-outline" size={20} color="#F59E0B" />
            </View>
            <View>
              <Text style={[styles.statNum, { color: '#F59E0B' }]}>{totalCount.toLocaleString()}</Text>
              <Text style={[styles.statLbl, { color: C.mutedForeground }]}>Questions</Text>
            </View>
          </View>
          <View style={[styles.statCard, { backgroundColor: '#8B5CF610', borderColor: '#8B5CF625' }]}>
            <View style={[styles.statIcon, { backgroundColor: '#8B5CF618' }]}>
              <Ionicons name="folder-open-outline" size={20} color="#8B5CF6" />
            </View>
            <View>
              <Text style={[styles.statNum, { color: '#8B5CF6' }]}>{topicCount}</Text>
              <Text style={[styles.statLbl, { color: C.mutedForeground }]}>Topics</Text>
            </View>
          </View>
        </View>

        {/* Actions */}
        <View style={styles.actionRow}>
          <TouchableOpacity style={[styles.actionBtn, { backgroundColor: '#F59E0B', opacity: fetching ? 0.5 : 1 }]}
            onPress={handleFetch} disabled={fetching}>
            {fetching ? <ActivityIndicator size="small" color="#FFF" /> : <Ionicons name="cloud-download-outline" size={14} color="#FFF" />}
            <Text style={{ fontSize: 12, fontWeight: '700', color: '#FFF' }}>{fetching ? '  Syncing...' : '  Re-fetch'}</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.actionBtn, { backgroundColor: '#F43F5E12', borderColor: '#F43F5E30', opacity: clearing ? 0.5 : 1 }]}
            onPress={handleClear} disabled={clearing}>
            {clearing ? <ActivityIndicator size="small" color="#F43F5E" /> : <Ionicons name="trash-outline" size={14} color="#F43F5E" />}
            <Text style={{ fontSize: 12, fontWeight: '700', color: '#F43F5E' }}>{clearing ? '  Clearing...' : '  Clear'}</Text>
          </TouchableOpacity>
        </View>

        {/* Modules */}
        {MODULES.map((mod) => {
          const modTopics = mod.topics
            .map((t) => ({ name: t, count: topicMap[t] || 0 }))
            .filter((t) => t.count > 0);
          if (modTopics.length === 0) return null;
          const totalQ = modTopics.reduce((s, t) => s + t.count, 0);
          return (
            <View key={mod.title} style={styles.moduleSection}>
              <View style={[styles.moduleHeader, { backgroundColor: mod.color + '0D', borderLeftColor: mod.color }]}>
                <View style={[styles.moduleIconBox, { backgroundColor: mod.color + '20' }]}>
                  <Ionicons name={mod.icon} size={16} color={mod.color} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.moduleTitle, { color: mod.color }]}>{mod.title}</Text>
                  <Text style={{ fontSize: 10, color: C.mutedForeground }}>{modTopics.length} topics · {totalQ} Q</Text>
                </View>
              </View>
              <View style={styles.topicGrid}>
                {modTopics.map((topic) => (
                  <TouchableOpacity key={topic.name}
                    style={[styles.topicCard, { backgroundColor: C.card, borderColor: C.border }]}
                    onPress={() => handleTopicPress(topic.name)} activeOpacity={0.7}>
                    <View style={[styles.topicIconWrap, { backgroundColor: mod.color + '15' }]}>
                      <Ionicons name={mod.icon} size={14} color={mod.color} />
                    </View>
                    <Text style={[styles.topicName, { color: C.foreground }]} numberOfLines={1}>
                      {fmtTopic(topic.name)}
                    </Text>
                    <View style={[styles.topicBadge, { backgroundColor: mod.color + '18' }]}>
                      <Text style={{ fontSize: 10, fontWeight: '800', color: mod.color }}>{topic.count}</Text>
                    </View>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          );
        })}

        {/* Unknown topics */}
        {(() => {
          const knownSet = new Set(MODULES.flatMap(m => m.topics));
          const unknown = Object.entries(topicMap).filter(([k]) => !knownSet.has(k));
          if (unknown.length === 0) return null;
          return (
            <View style={styles.moduleSection}>
              <View style={[styles.moduleHeader, { backgroundColor: C.muted + '10', borderLeftColor: C.mutedForeground }]}>
                <View style={[styles.moduleIconBox, { backgroundColor: C.muted + '20' }]}>
                  <Ionicons name="help-circle-outline" size={16} color={C.mutedForeground} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.moduleTitle, { color: C.mutedForeground }]}>Other Topics</Text>
                  <Text style={{ fontSize: 10, color: C.mutedForeground }}>{unknown.length} topics</Text>
                </View>
              </View>
              <View style={styles.topicGrid}>
                {unknown.map(([name, count]) => (
                  <TouchableOpacity key={name}
                    style={[styles.topicCard, { backgroundColor: C.card, borderColor: C.border }]}
                    onPress={() => handleTopicPress(name)} activeOpacity={0.7}>
                    <View style={[styles.topicIconWrap, { backgroundColor: C.muted + '20' }]}>
                      <Ionicons name="help-circle-outline" size={14} color={C.mutedForeground} />
                    </View>
                    <Text style={[styles.topicName, { color: C.foreground }]} numberOfLines={1}>{fmtTopic(name)}</Text>
                    <View style={[styles.topicBadge, { backgroundColor: C.muted + '18' }]}>
                      <Text style={{ fontSize: 10, fontWeight: '800', color: C.mutedForeground }}>{count}</Text>
                    </View>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          );
        })()}
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
  headerTitle: { fontSize: FontSize.lg, fontWeight: '700', flex: 1, textAlign: 'center' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: Spacing.xxxl, gap: Spacing.lg },
  scrollContent: { padding: Spacing.md, paddingBottom: 40 },

  // Empty
  logoOuter: { width: 120, height: 120, borderRadius: 60, alignItems: 'center', justifyContent: 'center' },
  logoInner: { width: 96, height: 96, borderRadius: 48, alignItems: 'center', justifyContent: 'center' },
  title: { fontSize: FontSize.xxl, fontWeight: '700', textAlign: 'center' },
  subtitle: { fontSize: FontSize.sm, textAlign: 'center', lineHeight: 20 },
  setupBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    paddingVertical: Spacing.md, paddingHorizontal: Spacing.xl,
    borderRadius: BorderRadius.lg, boxShadow: '0 2px 8px rgba(239,68,68,0.3)',
  },
  fetchBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    paddingVertical: Spacing.lg, paddingHorizontal: Spacing.xxl,
    borderRadius: BorderRadius.lg, minWidth: 200,
    boxShadow: '0 4px 12px rgba(245,158,11,0.35)',
  },

  // Stats
  statsRow: { flexDirection: 'row', gap: Spacing.sm, marginBottom: Spacing.md },
  statCard: {
    flex: 1, flexDirection: 'row', alignItems: 'center', gap: Spacing.md,
    padding: Spacing.md, borderRadius: BorderRadius.lg, borderWidth: 1,
  },
  statIcon: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  statNum: { fontSize: 20, fontWeight: '800' },
  statLbl: { fontSize: 11, fontWeight: '500' },

  // Actions
  actionRow: { flexDirection: 'row', gap: Spacing.sm, marginBottom: Spacing.lg },
  actionBtn: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    paddingVertical: Spacing.md, borderRadius: BorderRadius.lg, borderWidth: 1,
  },

  // Modules
  moduleSection: { marginBottom: Spacing.lg },
  moduleHeader: {
    flexDirection: 'row', alignItems: 'center', gap: Spacing.md,
    padding: Spacing.md, borderRadius: BorderRadius.md, borderLeftWidth: 3,
    marginBottom: Spacing.sm,
  },
  moduleIconBox: {
    width: 32, height: 32, borderRadius: BorderRadius.sm,
    alignItems: 'center', justifyContent: 'center',
  },
  moduleTitle: { fontSize: 13, fontWeight: '800' },

  // Topic grid
  topicGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.xs },
  topicCard: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm + 2,
    borderRadius: BorderRadius.md, borderWidth: 1,
    minWidth: '48%', flex: 1, maxWidth: '49.5%',
  },
  topicIconWrap: {
    width: 24, height: 24, borderRadius: 12,
    alignItems: 'center', justifyContent: 'center',
  },
  topicName: { fontSize: 11, fontWeight: '600', flex: 1 },
  topicBadge: { paddingHorizontal: 7, paddingVertical: 2, borderRadius: 8 },

  // Results
  resultsContent: { padding: Spacing.md, gap: Spacing.sm, paddingBottom: 40 },
  resultsCard: {
    alignItems: 'center', padding: Spacing.xl, borderRadius: BorderRadius.xl,
    borderWidth: 1, gap: Spacing.sm, marginBottom: Spacing.sm,
  },
  resultsGradeCircle: {
    width: 64, height: 64, borderRadius: 32, borderWidth: 2,
    alignItems: 'center', justifyContent: 'center',
  },
  resultsGrade: { fontSize: 28, fontWeight: '900' },
  resultsScore: { fontSize: 24, fontWeight: '800' },

  reviewCard: { borderRadius: BorderRadius.md, borderWidth: 1, padding: Spacing.md, gap: Spacing.xs },
  reviewHeader: { flexDirection: 'row', alignItems: 'flex-start', gap: Spacing.sm },
  reviewBadge: {
    width: 20, height: 20, borderRadius: 10,
    alignItems: 'center', justifyContent: 'center', marginTop: 1,
  },
  reviewQ: { fontSize: 12, fontWeight: '600', flex: 1, lineHeight: 17 },
  reviewOpt: {
    flexDirection: 'row', alignItems: 'center', gap: Spacing.sm,
    paddingHorizontal: Spacing.sm, paddingVertical: 4,
    borderRadius: BorderRadius.sm, borderWidth: 1,
  },

  resultsActions: { flexDirection: 'row', gap: Spacing.sm, marginTop: Spacing.sm },
  resultsBtn: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    paddingVertical: Spacing.md, borderRadius: BorderRadius.lg,
  },

  // Edit view
  editCard: { borderRadius: BorderRadius.xl, borderWidth: 1, overflow: 'hidden' },
  editCardHeader: {
    flexDirection: 'row', alignItems: 'center', gap: Spacing.sm,
    padding: Spacing.md, paddingVertical: Spacing.md + 2,
  },
  editCardIcon: { width: 30, height: 30, borderRadius: BorderRadius.sm + 2, alignItems: 'center', justifyContent: 'center' },
  editCardText: { flex: 1, fontSize: 12.5, fontWeight: '600', lineHeight: 18 },
  editIndexBadge: {
    paddingHorizontal: 6, paddingVertical: 2, borderRadius: BorderRadius.sm,
    maxWidth: 80,
  },
  editCardBody: { paddingHorizontal: Spacing.md, paddingBottom: Spacing.lg, gap: Spacing.md },
  editSection: {
    borderRadius: BorderRadius.lg, borderWidth: 1, padding: Spacing.md, gap: Spacing.xs,
  },
  editSectionHeader: { flexDirection: 'row', alignItems: 'center', gap: 5, marginBottom: Spacing.xs },
  editSectionTitle: { fontSize: 11, fontWeight: '800', letterSpacing: 0.3 },
  editFieldLabel: { fontSize: 10.5, fontWeight: '600', marginBottom: 3 },
  editInputFull: {
    borderRadius: BorderRadius.md, borderWidth: 1,
    paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm,
    fontSize: 13, lineHeight: 18,
  },
  editActions: { flexDirection: 'row', gap: Spacing.sm, marginTop: Spacing.xs },
  editSaveBtn: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    paddingVertical: Spacing.md - 1, borderRadius: BorderRadius.lg,
    backgroundColor: '#10B981',
  },
  editUntagBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    paddingVertical: Spacing.md - 1, paddingHorizontal: Spacing.md,
    borderRadius: BorderRadius.lg, borderWidth: 1, borderColor: '#F43F5E30', backgroundColor: '#F43F5E08',
  },
  editSuccessBanner: {
    flexDirection: 'row', alignItems: 'center', paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.md, borderBottomWidth: 1,
  },
  // Topic picker modal
  topicModalOverlay: {
    flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.4)',
  },
  topicModalSheet: {
    borderTopLeftRadius: BorderRadius.xl, borderTopRightRadius: BorderRadius.xl,
    maxHeight: '70%', paddingTop: Spacing.md,
  },
  topicModalHeader: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: Spacing.lg, paddingBottom: Spacing.md, borderBottomWidth: 1,
  },
  topicModalSection: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingHorizontal: Spacing.lg, paddingVertical: Spacing.sm,
    marginTop: Spacing.sm,
  },
  topicModalItem: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: Spacing.lg, paddingVertical: Spacing.sm + 2,
    borderLeftWidth: 3, marginLeft: 0,
  },
});
