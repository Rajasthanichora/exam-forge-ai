import React, { useState, useEffect, useRef } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, ActivityIndicator,
  Alert, Platform, ScrollView, TextInput, Animated, Modal,
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useTheme, Spacing, BorderRadius, FontSize } from '../lib/theme';
import { getSubjectById, getSubjectN8nConfig, Subject } from '../lib/subject-store';
import {
  insertSubjectMCQRows, getSubjectMCQCount, getSubjectTopicCounts,
  clearSubjectMCQTable, getSubjectMCQByIndex, SubjectMCQRow,
  getSubjectMCQRowsByTag, updateSubjectMCQRow, deleteSubjectMCQById,
  getSubjectQuestionTags, addSubjectQuestionTag, removeSubjectQuestionTag,
} from '../lib/subject-db';
import { Question } from '../lib/types';
import ShuffleScreen from '../components/ShuffleScreen';
import QuizInterface from '../components/QuizInterface';

// ─── Helpers ───

function fmtTopic(raw: string): string {
  return raw.replace(/_/g, ' ');
}

function mcqRowToQuestion(row: SubjectMCQRow, lang: 'hi' | 'en'): Question {
  const opts = lang === 'hi'
    ? [row.a_hindi, row.b_hindi, row.c_hindi, row.d_hindi, row.e_hindi].filter(Boolean)
    : [row.a_eng, row.b_eng, row.c_eng, row.d_eng, row.e_engl].filter(Boolean);
  const padded = opts.length >= 4 ? opts.slice(0, 5) : [...opts, ...Array(Math.max(0, 4 - opts.length)).fill('')];
  const answerStr = (lang === 'hi' ? row.answer : (row.answer_en || row.answer)).trim().toUpperCase();
  const answerMap: Record<string, number> = { A: 0, B: 1, C: 2, D: 3, E: 4 };
  const correctIdx = answerMap[answerStr] ?? 0;
  return {
    id: `sub_${row.id}`,
    question: lang === 'hi' ? row.question : (row.question_en || row.question),
    options: padded,
    correctAnswer: correctIdx,
    explanation: lang === 'hi' ? row.explanation : (row.explaination_en || row.explanation),
    topic: row.index || '',
  };
}

type ViewMode = 'overview' | 'shuffle' | 'quiz' | 'results' | 'edit';

// ═══════════════════════════════════════════════
//  Generic Subject Screen
// ═══════════════════════════════════════════════

export default function SubjectScreen() {
  const router = useRouter();
  const { subjectId } = useLocalSearchParams<{ subjectId: string }>();
  const { colors: C } = useTheme();

  // ── State ──
  const [view, setView] = useState<ViewMode>('overview');
  const [subject, setSubject] = useState<Subject | null>(null);
  const [topicCounts, setTopicCounts] = useState<{ name: string; count: number }[]>([]);
  const [totalQuestions, setTotalQuestions] = useState(0);
  const [fetching, setFetching] = useState(false);
  const [loading, setLoading] = useState(true);
  const [quizQuestions, setQuizQuestions] = useState<Question[]>([]);
  const [quizTopic, setQuizTopic] = useState<string>('');

  // Edit state
  const [editForm, setEditForm] = useState<Record<string, string>>({});
  const [editTaggedQuestions, setEditTaggedQuestions] = useState<SubjectMCQRow[]>([]);
  const [editExpandedId, setEditExpandedId] = useState<number | null>(null);
  const [editSaving, setEditSaving] = useState(false);
  const [editSaveStatus, setEditSaveStatus] = useState<'idle' | 'sending' | 'done'>('idle');
  const [topicModalVisible, setTopicModalVisible] = useState(false);
  const [topicModalPrefix, setTopicModalPrefix] = useState('');
  const [bilingualData, setBilingualData] = useState<Record<string, { question_en: string; options_en: string[]; explanation_en: string }>>({});

  // Results
  const [lastResults, setLastResults] = useState<{ score: number; total: number; answers: Record<string, string> } | null>(null);

  // Shuffle
  const [pendingQuestions, setPendingQuestions] = useState<Question[]>([]);

  const fadeAnim = useRef(new Animated.Value(0)).current;

  // ── Load subject data ──
  useEffect(() => {
    if (!subjectId) return;
    (async () => {
      const s = await getSubjectById(subjectId);
      setSubject(s);
      await loadOverview();
    })();
  }, [subjectId]);

  const loadOverview = async () => {
    if (!subjectId) return;
    setLoading(true);
    try {
      const tc = await getSubjectTopicCounts(subjectId);
      setTopicCounts(tc);
      const cnt = await getSubjectMCQCount(subjectId);
      setTotalQuestions(cnt);
    } catch {} finally {
      setLoading(false);
    }
  };

  // ── Fetch from n8n ──
  const handleFetch = async () => {
    if (!subjectId) return;
    const config = await getSubjectN8nConfig(subjectId);
    if (!config.webhookUrl) {
      Alert.alert('No Webhook', 'Configure n8n webhook in Settings → N8N Integration.');
      return;
    }
    setFetching(true);
    try {
      let url = config.webhookUrl;
      const fetchParam = (config.params || []).find((p: any) => p.id === 'fetch');
      if (fetchParam?.paramName) {
        url += `${url.includes('?') ? '&' : '?'}${encodeURIComponent(fetchParam.paramName)}=${encodeURIComponent(fetchParam.paramValue || '')}`;
      }
      const ctrl = new AbortController();
      const t = setTimeout(() => ctrl.abort(), 60000);
      const res = await fetch(url, {
        method: (fetchParam?.method || 'GET') as any,
        signal: ctrl.signal,
        headers: { Accept: 'application/json' },
      });
      clearTimeout(t);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      const items: any[] = Array.isArray(data) ? data : data.questions || data.data || [];
      if (!items.length) {
        Alert.alert('Empty', 'N8N returned 0 records.');
        setFetching(false);
        return;
      }
      await clearSubjectMCQTable(subjectId);
      await insertSubjectMCQRows(subjectId, items);
      await loadOverview();
      Alert.alert('Fetched', `${items.length} questions stored.`);
    } catch (err: any) {
      Alert.alert('Failed', err?.name === 'AbortError' ? 'Timed out.' : err?.message || 'Fetch error.');
    } finally {
      setFetching(false);
    }
  };

  // ── Clear all data ──
  const handleClear = () => {
    if (!subjectId) return;
    Alert.alert('Clear All?', 'Delete all stored questions for this subject?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Clear', style: 'destructive', onPress: async () => {
        await clearSubjectMCQTable(subjectId);
        await loadOverview();
      }},
    ]);
  };

  // ── Topic press → load questions ──
  const handleTopicPress = async (topicName: string) => {
    if (!subjectId) return;
    setLoading(true);
    try {
      const rows = await getSubjectMCQByIndex(subjectId, topicName);
      if (!rows.length) {
        Alert.alert('No Questions', `No questions found for "${fmtTopic(topicName)}".`);
        setLoading(false);
        return;
      }
      // Always build Hindi questions as primary
      const questions = rows.map(r => mcqRowToQuestion(r, 'hi'));
      // Build bilingualData for English toggle inside quiz
      const bi: Record<string, { question_en: string; options_en: string[]; explanation_en: string }> = {};
      for (const r of rows) {
        const qid = `sub_${r.id}`;
        bi[qid] = {
          question_en: r.question_en || r.question,
          options_en: [r.a_eng, r.b_eng, r.c_eng, r.d_eng, r.e_engl].filter(Boolean),
          explanation_en: r.explaination_en || r.explanation,
        };
      }
      setBilingualData(bi);
      setPendingQuestions(questions);
      setQuizTopic(topicName);
      setView('shuffle');
    } catch {} finally {
      setLoading(false);
    }
  };

  // ── Shuffle confirm → start quiz ──
  const handleShuffleConfirm = (shuffled: Question[]) => {
    setQuizQuestions(shuffled);
    setView('quiz');
  };

  // ── Quiz complete ──
  const handleQuizComplete = (answers: Record<string, number>, timeTaken: number) => {
    let score = 0;
    for (const q of quizQuestions) {
      if (answers[q.id] === q.correctAnswer) score++;
    }
    setLastResults({ score, total: quizQuestions.length, answers: answers as any });
    setView('results');
  };

  // ── Delete question ──
  const handleDeleteQuestion = async (row: SubjectMCQRow) => {
    if (!subjectId) return;
    Alert.alert('Delete?', 'Remove this question permanently?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: async () => {
        const config = await getSubjectN8nConfig(subjectId);
        if (config.webhookUrl) {
          const delParam = (config.params || []).find((p: any) => p.id === 'delete');
          if (delParam?.paramName) {
            let delUrl = `${config.webhookUrl}?${encodeURIComponent(delParam.paramName)}=${encodeURIComponent(delParam.paramValue || String(row.id))}`;
            if (delParam.defaultParamName) {
              delUrl += `&${encodeURIComponent(delParam.defaultParamName)}=${encodeURIComponent(row.question)}`;
            }
            fetch(delUrl).catch(() => {});
          }
        }
        await deleteSubjectMCQById(subjectId, row.id);
        await loadOverview();
      }},
    ]);
  };

  // ── Open edit-tagged questions (like Electrician) ──
  const handleEditOpenAll = async () => {
    if (!subjectId) return;
    try {
      const rows = await getSubjectMCQRowsByTag(subjectId, 'edit');
      setEditTaggedQuestions(rows);
      setEditExpandedId(null);
      setView('edit');
    } catch {
      Alert.alert('Error', 'Failed to load tagged questions');
    }
  };

  const handleEditSaveTagged = async (row: SubjectMCQRow) => {
    if (!subjectId) return;
    setEditSaving(true);
    setEditSaveStatus('sending');
    try {
      const prefix = `sub_${subjectId}_${row.id}_`;
      const fields: Record<string, string> = {};
      for (const [k, v] of Object.entries(editForm)) {
        if (k.startsWith(prefix)) fields[k.slice(prefix.length)] = v;
      }
      if (Object.keys(fields).length > 0) {
        await updateSubjectMCQRow(subjectId, row.id, fields);
      }
      // Send to n8n
      const config = await getSubjectN8nConfig(subjectId);
      if (config.webhookUrl) {
        const mergedRow = { ...row, ...fields } as SubjectMCQRow;
        const editParam = (config.params || []).find((p: any) => p.id === 'edit');
        if (editParam) {
          const customParamName = editParam.paramName || 'edit_question';
          const customParamValue = editParam.paramValue || String(row.id);
          const defaultParamName = editParam.defaultParamName || 'question_data';
          // Custom param: user's saved value (or row ID fallback)
          let editUrl = `${config.webhookUrl}?${encodeURIComponent(customParamName)}=${encodeURIComponent(customParamValue)}`;
          // Default param: full question JSON
          editUrl += `&${encodeURIComponent(defaultParamName)}=${encodeURIComponent(JSON.stringify(mergedRow))}`;
          fetch(editUrl, { method: (editParam.method || 'GET') as any, headers: { Accept: 'application/json' } }).catch(() => {});
        }
      }
      setEditSaveStatus('done');
      setTimeout(() => setEditSaveStatus('idle'), 1500);
    } catch {
      Alert.alert('Error', 'Failed to save.');
    } finally {
      setEditSaving(false);
    }
  };

  const handleEditUntag = async (row: SubjectMCQRow) => {
    if (!subjectId) return;
    await removeSubjectQuestionTag(subjectId, `sub_${row.id}`, 'edit');
    setEditTaggedQuestions(prev => prev.filter(r => r.id !== row.id));
    setEditExpandedId(null);
  };

  // ── Back ──
  const handleBack = () => {
    if (view === 'quiz') {
      Alert.alert('Exit Quiz?', 'Your progress will be lost.', [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Exit', style: 'destructive', onPress: () => { setView('overview'); setQuizQuestions([]); } },
      ]);
    } else if (view === 'edit') {
      setView('overview');
    } else if (view === 'results') {
      setView('overview');
      setLastResults(null);
    } else {
      router.back();
    }
  };

  // ── Color ──
  const subjectColor = subject?.color || '#8B5CF6';

  // ── Animate ──
  useEffect(() => {
    fadeAnim.setValue(0);
    Animated.timing(fadeAnim, { toValue: 1, duration: 300, useNativeDriver: true }).start();
  }, [view]);

  // ═══════════════════════════════════════════════
  //  RENDER: Loading
  // ═══════════════════════════════════════════════
  if (!subject) {
    return (
      <View style={[styles.container, { backgroundColor: C.background }]}>
        <View style={[styles.header, { backgroundColor: C.card, borderBottomColor: C.border }]}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
            <Ionicons name="arrow-back" size={24} color={C.foreground} />
          </TouchableOpacity>
          <Text style={[styles.headerTitle, { color: C.foreground }]} numberOfLines={1}>Subject</Text>
          <View style={{ width: 40 }} />
        </View>
        <View style={styles.center}>
          <ActivityIndicator size="large" color={subjectColor} />
        </View>
      </View>
    );
  }

  // ═══════════════════════════════════════════════
  //  RENDER: Shuffle
  // ═══════════════════════════════════════════════
  if (view === 'shuffle') {
    return (
      <ShuffleScreen
        questions={pendingQuestions}
        topic={fmtTopic(quizTopic)}
        onConfirm={handleShuffleConfirm}
        onCancel={() => { setView('overview'); setPendingQuestions([]); }}
      />
    );
  }

  // ═══════════════════════════════════════════════
  //  RENDER: Quiz
  // ═══════════════════════════════════════════════
  if (view === 'quiz') {
    return (
      <QuizInterface
        questions={quizQuestions}
        onComplete={handleQuizComplete}
        bilingualData={bilingualData}
        onGetTags={subjectId ? (qid) => getSubjectQuestionTags(subjectId, qid) : undefined}
        onAddTag={subjectId ? (qid, tag) => addSubjectQuestionTag(subjectId, qid, tag) : undefined}
        onRemoveTag={subjectId ? (qid, tag) => removeSubjectQuestionTag(subjectId, qid, tag) : undefined}
        onDeleteQuestion={subjectId ? async (qid) => {
          const numId = parseInt(qid.replace('sub_', ''), 10);
          if (!isNaN(numId)) return deleteSubjectMCQById(subjectId, numId);
          return false;
        } : undefined}
        onQuestionDeleted={(qid) => {
          setQuizQuestions(prev => prev.filter(q => q.id !== qid));
        }}
      />
    );
  }

  // ═══════════════════════════════════════════════
  //  RENDER: Results
  // ═══════════════════════════════════════════════
  if (view === 'results' && lastResults) {
    const pct = Math.round((lastResults.score / lastResults.total) * 100);
    const grade = pct >= 90 ? 'A+' : pct >= 80 ? 'A' : pct >= 70 ? 'B' : pct >= 60 ? 'C' : 'D';
    return (
      <View style={[styles.container, { backgroundColor: C.background }]}>
        <View style={[styles.header, { backgroundColor: C.card, borderBottomColor: C.border }]}>
          <TouchableOpacity onPress={handleBack} style={styles.backBtn}>
            <Ionicons name="arrow-back" size={24} color={C.foreground} />
          </TouchableOpacity>
          <Text style={[styles.headerTitle, { color: C.foreground }]} numberOfLines={1}>Results</Text>
          <View style={{ width: 40 }} />
        </View>
        <ScrollView style={{ flex: 1 }} contentContainerStyle={styles.resultsContent}>
          <View style={[styles.resultsCard, { backgroundColor: C.card, borderColor: subjectColor + '40' }]}>
            <View style={[styles.resultsGradeCircle, { borderColor: subjectColor }]}>
              <Text style={[styles.resultsGrade, { color: subjectColor }]}>{grade}</Text>
            </View>
            <Text style={[styles.resultsScore, { color: C.foreground }]}>{lastResults.score}/{lastResults.total}</Text>
            <Text style={{ fontSize: FontSize.sm, color: C.mutedForeground }}>{pct}% Correct</Text>
          </View>
          <View style={styles.resultsActions}>
            <TouchableOpacity
              style={[styles.resultsBtn, { backgroundColor: subjectColor }]}
              onPress={() => { setView('overview'); setLastResults(null); }}
            >
              <Ionicons name="grid-outline" size={16} color="#FFF" />
              <Text style={{ color: '#FFF', fontWeight: '700', marginLeft: 6 }}>Topics</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.resultsBtn, { backgroundColor: C.muted }]}
              onPress={() => {
                if (quizQuestions.length) {
                  setPendingQuestions(quizQuestions);
                  setView('shuffle');
                }
              }}
            >
              <Ionicons name="refresh-outline" size={16} color={C.foreground} />
              <Text style={{ color: C.foreground, fontWeight: '700', marginLeft: 6 }}>Retake</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </View>
    );
  }

  // ═══════════════════════════════════════════════
  //  RENDER: Edit (tagged questions list, like Electrician)
  // ═══════════════════════════════════════════════
  if (view === 'edit') {
    return (
      <View style={[styles.container, { backgroundColor: C.background }]}>
        <View style={[styles.header, { backgroundColor: C.card, borderBottomColor: C.border }]}>
          <TouchableOpacity onPress={handleBack} style={styles.backBtn}>
            <Ionicons name="arrow-back" size={24} color={C.foreground} />
          </TouchableOpacity>
          <Text style={[styles.headerTitle, { color: C.foreground }]} numberOfLines={1}>Tagged for Edit</Text>
          <View style={{ width: 40 }} />
        </View>
        {editSaveStatus === 'done' && (
          <View style={[styles.editSuccessBanner, { backgroundColor: '#10B98118', borderBottomColor: '#10B98130' }]}>
            <Ionicons name="checkmark-circle" size={16} color="#10B981" />
            <Text style={{ fontSize: 12, fontWeight: '600', color: '#10B981', marginLeft: 6 }}>Saved & sent to n8n</Text>
          </View>
        )}

        {editTaggedQuestions.length === 0 ? (
          <View style={styles.center}>
            <Ionicons name="checkmark-circle-outline" size={48} color="#10B981" />
            <Text style={{ fontSize: 14, fontWeight: '600', color: C.foreground, marginTop: 8 }}>All clear!</Text>
            <Text style={{ fontSize: 12, color: C.mutedForeground, marginTop: 4 }}>No questions tagged for editing</Text>
          </View>
        ) : (
          <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: Spacing.md, gap: Spacing.md, paddingBottom: 40 }}>
            {editTaggedQuestions.map((row) => {
              const isExpanded = editExpandedId === row.id;
              const prefix = `sub_${subjectId}_${row.id}_`;
              return (
                <View key={row.id} style={[styles.editCard, { backgroundColor: C.card, borderColor: isExpanded ? subjectColor + '40' : C.border }]}>
                  {/* Card header */}
                  <TouchableOpacity
                    style={[styles.editCardHeader, { borderBottomColor: isExpanded ? C.border : 'transparent' }]}
                    onPress={() => {
                      setEditExpandedId(isExpanded ? null : row.id);
                      if (!isExpanded) {
                        // Initialize form fields for this row
                        const form: Record<string, string> = {};
                        for (const k of ['question', 'question_en', 'a_hindi', 'b_hindi', 'c_hindi', 'd_hindi', 'e_hindi',
                          'a_eng', 'b_eng', 'c_eng', 'd_eng', 'e_engl', 'answer', 'answer_en', 'explanation', 'explaination_en', 'index']) {
                          form[`${prefix}${k}`] = String((row as any)[k] || '');
                        }
                        setEditForm(prev => ({ ...prev, ...form }));
                      }
                    }}
                  >
                    <View style={[styles.editCardIcon, { backgroundColor: subjectColor + '18' }]}>
                      <Ionicons name="pencil-outline" size={14} color={subjectColor} />
                    </View>
                    <Text style={[styles.editCardText, { color: C.foreground }]} numberOfLines={isExpanded ? undefined : 2}>
                      {row.question || row.question_en}
                    </Text>
                    {row.index ? (
                      <View style={[styles.editIndexBadge, { backgroundColor: subjectColor + '15' }]}>
                        <Text style={{ fontSize: 9, fontWeight: '700', color: subjectColor }} numberOfLines={1}>{row.index}</Text>
                      </View>
                    ) : null}
                    <Ionicons name={isExpanded ? 'chevron-up' : 'chevron-down'} size={16} color={C.mutedForeground} />
                  </TouchableOpacity>

                  {/* Expanded edit form */}
                  {isExpanded && (
                    <View style={styles.editCardBody}>
                      {/* Index / Topic Dropdown */}
                      <View style={[styles.editSection, { backgroundColor: C.background, borderColor: C.border }]}>
                        <View style={styles.editSectionHeader}>
                          <Ionicons name="pricetag-outline" size={12} color={subjectColor} />
                          <Text style={[styles.editSectionTitle, { color: subjectColor }]}>Index / Topic</Text>
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

                      {/* Hindi section */}
                      <View style={[styles.editSection, { borderColor: '#F59E0B30' }]}>
                        <View style={styles.editSectionHeader}>
                          <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: '#F59E0B' }} />
                          <Text style={[styles.editSectionTitle, { color: '#F59E0B' }]}>HINDI</Text>
                        </View>
                        <Text style={[styles.editFieldLabel, { color: C.mutedForeground }]}>प्रश्न</Text>
                        <TextInput
                          style={[styles.editInputFull, { color: C.foreground, backgroundColor: C.background, borderColor: C.border }]}
                          value={editForm[`${prefix}question`] || ''}
                          onChangeText={(t) => setEditForm(prev => ({ ...prev, [`${prefix}question`]: t }))}
                          multiline textAlignVertical="top"
                        />
                        {(['a_hindi', 'b_hindi', 'c_hindi', 'd_hindi', 'e_hindi'] as const).map((k, i) => (
                          <View key={k}>
                            <Text style={[styles.editFieldLabel, { color: C.mutedForeground }]}>{String.fromCharCode(65 + i)}</Text>
                            <TextInput
                              style={[styles.editInputFull, { color: C.foreground, backgroundColor: C.background, borderColor: C.border }]}
                              value={editForm[`${prefix}${k}`] || ''}
                              onChangeText={(t) => setEditForm(prev => ({ ...prev, [`${prefix}${k}`]: t }))}
                            />
                          </View>
                        ))}
                        <Text style={[styles.editFieldLabel, { color: C.mutedForeground }]}>सही उत्तर</Text>
                        <TextInput
                          style={[styles.editInputFull, { color: C.foreground, backgroundColor: C.background, borderColor: C.border }]}
                          value={editForm[`${prefix}answer`] || ''}
                          onChangeText={(t) => setEditForm(prev => ({ ...prev, [`${prefix}answer`]: t }))}
                        />
                      </View>

                      {/* English section */}
                      <View style={[styles.editSection, { borderColor: '#3B82F630' }]}>
                        <View style={styles.editSectionHeader}>
                          <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: '#3B82F6' }} />
                          <Text style={[styles.editSectionTitle, { color: '#3B82F6' }]}>ENGLISH</Text>
                        </View>
                        <Text style={[styles.editFieldLabel, { color: C.mutedForeground }]}>Question</Text>
                        <TextInput
                          style={[styles.editInputFull, { color: C.foreground, backgroundColor: C.background, borderColor: C.border }]}
                          value={editForm[`${prefix}question_en`] || ''}
                          onChangeText={(t) => setEditForm(prev => ({ ...prev, [`${prefix}question_en`]: t }))}
                          multiline textAlignVertical="top"
                        />
                        {(['a_eng', 'b_eng', 'c_eng', 'd_eng', 'e_engl'] as const).map((k, i) => (
                          <View key={k}>
                            <Text style={[styles.editFieldLabel, { color: C.mutedForeground }]}>{String.fromCharCode(65 + i)}</Text>
                            <TextInput
                              style={[styles.editInputFull, { color: C.foreground, backgroundColor: C.background, borderColor: C.border }]}
                              value={editForm[`${prefix}${k}`] || ''}
                              onChangeText={(t) => setEditForm(prev => ({ ...prev, [`${prefix}${k}`]: t }))}
                            />
                          </View>
                        ))}
                        <Text style={[styles.editFieldLabel, { color: C.mutedForeground }]}>Answer</Text>
                        <TextInput
                          style={[styles.editInputFull, { color: C.foreground, backgroundColor: C.background, borderColor: C.border }]}
                          value={editForm[`${prefix}answer_en`] || ''}
                          onChangeText={(t) => setEditForm(prev => ({ ...prev, [`${prefix}answer_en`]: t }))}
                        />
                      </View>

                      {/* Explanation */}
                      <View style={[styles.editSection, { borderColor: '#6366F130' }]}>
                        <View style={styles.editSectionHeader}>
                          <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: '#6366F1' }} />
                          <Text style={[styles.editSectionTitle, { color: '#6366F1' }]}>EXPLANATION</Text>
                        </View>
                        <Text style={[styles.editFieldLabel, { color: C.mutedForeground }]}>व्याख्या (Hindi)</Text>
                        <TextInput
                          style={[styles.editInputFull, { color: C.foreground, backgroundColor: C.background, borderColor: C.border }]}
                          value={editForm[`${prefix}explanation`] || ''}
                          onChangeText={(t) => setEditForm(prev => ({ ...prev, [`${prefix}explanation`]: t }))}
                          multiline textAlignVertical="top"
                        />
                        <Text style={[styles.editFieldLabel, { color: C.mutedForeground }]}>Explanation (English)</Text>
                        <TextInput
                          style={[styles.editInputFull, { color: C.foreground, backgroundColor: C.background, borderColor: C.border }]}
                          value={editForm[`${prefix}explaination_en`] || ''}
                          onChangeText={(t) => setEditForm(prev => ({ ...prev, [`${prefix}explaination_en`]: t }))}
                          multiline textAlignVertical="top"
                        />
                      </View>

                      {/* Actions */}
                      <View style={{ flexDirection: 'row', gap: Spacing.sm, marginTop: Spacing.xs }}>
                        <TouchableOpacity
                          style={[styles.editSaveBtn, { opacity: editSaving ? 0.5 : 1 }]}
                          onPress={() => handleEditSaveTagged(row)} disabled={editSaving}
                        >
                          {editSaving ? <ActivityIndicator size={14} color="#FFF" /> : <Ionicons name="checkmark" size={14} color="#FFF" />}
                          <Text style={{ color: '#FFF', fontWeight: '700', marginLeft: 6, fontSize: 12 }}>
                            {editSaving ? 'Saving...' : 'Save & Send'}
                          </Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                          style={[styles.editUntagBtn, { borderColor: '#F43F5E30', backgroundColor: '#F43F5E08' }]}
                          onPress={() => handleEditUntag(row)}
                        >
                          <Ionicons name="close-circle-outline" size={14} color="#F43F5E" />
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
                {topicCounts.map((tc) => {
                  const currentVal = editForm[topicModalPrefix] || '';
                  const isSelected = currentVal === tc.name;
                  return (
                    <TouchableOpacity
                      key={tc.name}
                      style={[styles.topicModalItem, {
                        backgroundColor: isSelected ? subjectColor + '15' : 'transparent',
                        borderLeftColor: isSelected ? subjectColor : 'transparent',
                      }]}
                      onPress={() => {
                        setEditForm(prev => ({ ...prev, [topicModalPrefix]: tc.name }));
                        setTopicModalVisible(false);
                      }}
                    >
                      <Ionicons name="document-text-outline" size={14} color={isSelected ? subjectColor : C.mutedForeground} />
                      <Text style={{
                        flex: 1, fontSize: 13, fontWeight: isSelected ? '700' : '500',
                        color: isSelected ? subjectColor : C.foreground,
                      }} numberOfLines={1}>
                        {fmtTopic(tc.name)}
                      </Text>
                      <Text style={{ fontSize: 11, color: C.mutedForeground }}>{tc.count}</Text>
                      {isSelected && <Ionicons name="checkmark" size={16} color={subjectColor} style={{ marginLeft: 6 }} />}
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>
            </View>
          </View>
        </Modal>
      </View>
    );
  }

  // ═══════════════════════════════════════════════
  //  RENDER: Overview (main screen)
  // ═══════════════════════════════════════════════
  return (
    <View style={[styles.container, { backgroundColor: C.background }]}>
      {/* Header */}
      <View style={[styles.header, { backgroundColor: C.card, borderBottomColor: C.border }]}>
        <TouchableOpacity onPress={handleBack} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={24} color={C.foreground} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: C.foreground }]} numberOfLines={1}>{subject.name}</Text>
        {totalQuestions > 0 && (
          <TouchableOpacity onPress={handleEditOpenAll} style={{ padding: Spacing.xs }}>
            <Ionicons name="pencil-outline" size={20} color={subjectColor} />
          </TouchableOpacity>
        )}
        {totalQuestions === 0 && <View style={{ width: 40 }} />}
      </View>

      <Animated.View style={{ flex: 1, opacity: fadeAnim }}>
        <ScrollView contentContainerStyle={styles.scrollContent}>
          {loading ? (
            <View style={styles.center}>
              <ActivityIndicator size="large" color={subjectColor} />
            </View>
          ) : totalQuestions === 0 ? (
            // ── Empty state ──
            <View style={styles.center}>
              <View style={[styles.logoOuter, { backgroundColor: subjectColor + '10' }]}>
                <View style={[styles.logoInner, { backgroundColor: subjectColor + '20' }]}>
                  <Ionicons name="book-outline" size={48} color={subjectColor} />
                </View>
              </View>
              <Text style={[styles.title, { color: C.foreground }]}>{subject.name}</Text>
              <Text style={[styles.subtitle, { color: C.mutedForeground }]}>
                Fetch questions from your n8n webhook to start studying.
              </Text>
              <TouchableOpacity
                style={[styles.fetchBtn, { backgroundColor: subjectColor, opacity: fetching ? 0.6 : 1 }]}
                onPress={handleFetch} disabled={fetching}
              >
                {fetching ? (
                  <ActivityIndicator size="small" color="#FFF" />
                ) : (
                  <Ionicons name="cloud-download-outline" size={20} color="#FFF" />
                )}
                <Text style={{ color: '#FFF', fontWeight: '700', fontSize: 15, marginLeft: 8 }}>
                  {fetching ? 'Fetching...' : 'Fetch Questions'}
                </Text>
              </TouchableOpacity>
            </View>
          ) : (
            <>
              {/* Stats */}
              <View style={styles.statsRow}>
                <View style={[styles.statCard, { backgroundColor: C.card, borderColor: subjectColor + '30' }]}>
                  <View style={[styles.statIcon, { backgroundColor: subjectColor + '20' }]}>
                    <Ionicons name="help-circle-outline" size={20} color={subjectColor} />
                  </View>
                  <View>
                    <Text style={[styles.statNum, { color: C.foreground }]}>{totalQuestions}</Text>
                    <Text style={[styles.statLbl, { color: C.mutedForeground }]}>Questions</Text>
                  </View>
                </View>
                <View style={[styles.statCard, { backgroundColor: C.card, borderColor: C.border }]}>
                  <View style={[styles.statIcon, { backgroundColor: '#3B82F620' }]}>
                    <Ionicons name="folder-outline" size={20} color="#3B82F6" />
                  </View>
                  <View>
                    <Text style={[styles.statNum, { color: C.foreground }]}>{topicCounts.length}</Text>
                    <Text style={[styles.statLbl, { color: C.mutedForeground }]}>Topics</Text>
                  </View>
                </View>
              </View>

              {/* Actions */}
              <View style={styles.actionRow}>
                <TouchableOpacity
                  style={[styles.actionBtn, { borderColor: subjectColor + '40', backgroundColor: subjectColor + '10' }]}
                  onPress={handleFetch} disabled={fetching}
                >
                  {fetching ? <ActivityIndicator size={14} color={subjectColor} /> : <Ionicons name="refresh-outline" size={14} color={subjectColor} />}
                  <Text style={{ color: subjectColor, fontWeight: '600', fontSize: 12, marginLeft: 4 }}>
                    {fetching ? 'Fetching...' : 'Refresh'}
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.actionBtn, { borderColor: '#F43F5E30', backgroundColor: '#F43F5E08' }]}
                  onPress={handleClear}
                >
                  <Ionicons name="trash-outline" size={14} color="#F43F5E" />
                  <Text style={{ color: '#F43F5E', fontWeight: '600', fontSize: 12, marginLeft: 4 }}>Clear All</Text>
                </TouchableOpacity>
              </View>

              {/* Topics — flat grid, no modules */}
              <Text style={[styles.moduleTitle, { color: C.foreground, marginBottom: Spacing.sm }]}>All Topics</Text>
              <View style={styles.topicGrid}>
                {topicCounts.map((tc) => (
                  <TouchableOpacity
                    key={tc.name}
                    style={[styles.topicCard, { backgroundColor: C.card, borderColor: C.border }]}
                    onPress={() => handleTopicPress(tc.name)}
                    activeOpacity={0.7}
                  >
                    <View style={[styles.topicIconWrap, { backgroundColor: subjectColor + '18' }]}>
                      <Ionicons name="document-text-outline" size={13} color={subjectColor} />
                    </View>
                    <Text style={[styles.topicName, { color: C.foreground }]} numberOfLines={1}>
                      {fmtTopic(tc.name)}
                    </Text>
                    <View style={[styles.topicBadge, { backgroundColor: subjectColor + '15' }]}>
                      <Text style={{ fontSize: 10, fontWeight: '700', color: subjectColor }}>{tc.count}</Text>
                    </View>
                  </TouchableOpacity>
                ))}
              </View>
            </>
          )}
        </ScrollView>
      </Animated.View>
    </View>
  );
}

// ─── Styles ───

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
  fetchBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    paddingVertical: Spacing.lg, paddingHorizontal: Spacing.xxl,
    borderRadius: BorderRadius.lg, minWidth: 200,
    boxShadow: '0 4px 12px rgba(0,0,0,0.2)',
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

  // Topics — flat grid
  moduleTitle: { fontSize: 13, fontWeight: '800' },
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
  resultsActions: { flexDirection: 'row', gap: Spacing.sm, marginTop: Spacing.sm },
  resultsBtn: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    paddingVertical: Spacing.md, borderRadius: BorderRadius.lg,
  },

  // Edit
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
  // Topic picker modal
  topicModalOverlay: {
    flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.4)',
  },
  topicModalSheet: {
    borderTopLeftRadius: BorderRadius.xl, borderTopRightRadius: BorderRadius.xl,
    paddingTop: Spacing.md,
  },
  topicModalHeader: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: Spacing.lg, paddingBottom: Spacing.md, borderBottomWidth: 1,
  },
  topicModalItem: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: Spacing.lg, paddingVertical: Spacing.sm + 2,
    borderLeftWidth: 3, marginLeft: 0, gap: Spacing.sm,
  },
  editFieldLabel: { fontSize: 10.5, fontWeight: '600', marginBottom: 3 },
  editInputFull: {
    borderRadius: BorderRadius.md, borderWidth: 1,
    paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm,
    fontSize: 13, lineHeight: 18,
  },
  editSaveBtn: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    paddingVertical: Spacing.md - 1, borderRadius: BorderRadius.lg,
    backgroundColor: '#10B981',
  },
  editUntagBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    paddingVertical: Spacing.md - 1, paddingHorizontal: Spacing.md,
    borderRadius: BorderRadius.lg, borderWidth: 1,
  },
  editSuccessBanner: {
    flexDirection: 'row', alignItems: 'center', paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.md, borderBottomWidth: 1,
  },
});
