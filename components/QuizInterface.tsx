import React, { useState, useEffect, useRef } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Question } from '../lib/types';
import { useTheme, Spacing, BorderRadius, FontSize } from '../lib/theme';
import { addQuestionTag, removeQuestionTag, deleteMCQById } from '../lib/electrician-db';
import AsyncStorage from '@react-native-async-storage/async-storage';

const N8N_WEBHOOK_KEY = 'examforge_n8n_webhook_url';
const N8N_PARAMS_KEY = 'examforge_n8n_params';

interface Props {
  questions: Question[];
  onComplete: (answers: Record<string, number>, timeTaken: number) => void;
  bilingualData?: Record<string, { question_en: string; options_en: string[]; explanation_en: string }>;
  onQuestionDeleted?: (questionId: string) => void;
  // Optional tag handlers — defaults to electrician-db (backward compatible)
  onGetTags?: (questionId: string) => Promise<string[]>;
  onAddTag?: (questionId: string, tag: string) => Promise<string[]>;
  onRemoveTag?: (questionId: string, tag: string) => Promise<string[]>;
  // Optional delete handler — defaults to electrician-db
  onDeleteQuestion?: (questionId: string) => Promise<boolean>;
}

export default function QuizInterface({ questions, onComplete, bilingualData, onQuestionDeleted, onGetTags, onAddTag, onRemoveTag, onDeleteQuestion }: Props) {
  const { colors: C, isDark } = useTheme();
  const [currentIndex, setCurrentIndex] = useState(0);
  const [selectedAnswer, setSelectedAnswer] = useState<number | null>(null);
  const [answers, setAnswers] = useState<Record<string, number>>({});
  const [showFeedback, setShowFeedback] = useState(false);
  const [flaggedQuestions, setFlaggedQuestions] = useState<Set<string>>(new Set());
  const [reviewedQuestions, setReviewedQuestions] = useState<Set<string>>(new Set());
  const [importantIds, setImportantIds] = useState<Set<string>>(new Set());
  const [editTagIds, setEditTagIds] = useState<Set<string>>(new Set());
  const [filterImportant, setFilterImportant] = useState(false);
  const [deleteStatus, setDeleteStatus] = useState<'idle' | 'sending' | 'done'>('idle');
  const [elapsedTime, setElapsedTime] = useState(0);
  const [showNav, setShowNav] = useState(false);
  const [isEnglish, setIsEnglish] = useState(false);
  const scrollRef = useRef<ScrollView>(null);
  const startTime = useRef(Date.now());
  const navGridRef = useRef<ScrollView>(null);

  useEffect(() => {
    const interval = setInterval(() => {
      setElapsedTime(Math.floor((Date.now() - startTime.current) / 1000));
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  // Load tags from DB on mount
  useEffect(() => {
    (async () => {
      try {
        const getTags = onGetTags || (await import('../lib/electrician-db')).getQuestionTags;
        const impSet = new Set<string>();
        const edSet = new Set<string>();
        for (const q of questions) {
          const tags = await getTags(q.id);
          if (tags.includes('important')) impSet.add(q.id);
          if (tags.includes('edit')) edSet.add(q.id);
        }
        setImportantIds(impSet);
        setEditTagIds(edSet);
      } catch {}
    })();
  }, []);

  // N8N webhook helper for delete
  const sendN8NDelete = async (questionId: string): Promise<boolean> => {
    try {
      const url = await AsyncStorage.getItem(N8N_WEBHOOK_KEY);
      if (!url) { console.warn('[N8N Delete] No webhook URL saved'); return false; }
      const paramsJson = await AsyncStorage.getItem(N8N_PARAMS_KEY);
      let customParamName = 'delete_question';
      let customParamValue = '';
      let defaultParamName = 'question';
      let deleteMethod = 'GET';
      if (paramsJson) {
        try {
          const params = JSON.parse(paramsJson);
          const deleteParam = params.find((p: any) => p.id === 'delete');
          if (deleteParam) {
            if (deleteParam.paramName) customParamName = deleteParam.paramName;
            if (deleteParam.paramValue !== undefined) customParamValue = deleteParam.paramValue;
            if (deleteParam.defaultParamName) defaultParamName = deleteParam.defaultParamName;
            if (deleteParam.method) deleteMethod = deleteParam.method;
          }
        } catch {}
      }
      // Custom param: user's number
      let fullUrl = `${url}${url.includes('?') ? '&' : '?'}${encodeURIComponent(customParamName)}=${encodeURIComponent(customParamValue || questionId)}`;
      // Default param: Hindi question text
      fullUrl += `&${encodeURIComponent(defaultParamName)}=${encodeURIComponent(currentQuestion.question)}`;
      console.log('[N8N Delete] Calling:', fullUrl);
      const res = await fetch(fullUrl, { method: deleteMethod as any, headers: { Accept: 'application/json' } });
      console.log('[N8N Delete] Status:', res.status);
      return res.ok;
    } catch (err) {
      console.warn('[N8N Delete] Error:', err);
      return false;
    }
  };

  const filteredQuestions = filterImportant
    ? questions.filter(q => importantIds.has(q.id))
    : questions;

  const currentQuestion = filteredQuestions[currentIndex];
  const isLastQuestion = currentIndex === filteredQuestions.length - 1;

  const handleAnswer = (optionIndex: number) => {
    if (showFeedback) return;
    setSelectedAnswer(optionIndex);
    setShowFeedback(true);
    setAnswers(prev => ({ ...prev, [currentQuestion.id]: optionIndex }));
    if (optionIndex === currentQuestion.correctAnswer) {} else {}
  };

  const handleNext = () => {
    if (isLastQuestion) {
      onComplete(answers, elapsedTime);
    } else {
      const nextIdx = currentIndex + 1;
      setCurrentIndex(nextIdx);
      const nextAnswer = answers[filteredQuestions[nextIdx]?.id];
      setSelectedAnswer(nextAnswer ?? null);
      setShowFeedback(nextAnswer !== undefined);
    }
  };

  const handlePrev = () => {
    if (currentIndex > 0) {
      const prevIdx = currentIndex - 1;
      setCurrentIndex(prevIdx);
      const prevAnswer = answers[filteredQuestions[prevIdx]?.id];
      setSelectedAnswer(prevAnswer ?? null);
      setShowFeedback(prevAnswer !== undefined);
    }
  };

  const toggleFlag = async () => {
    const qid = currentQuestion.id;
    const wasImportant = importantIds.has(qid);
    // Optimistic UI
    setFlaggedQuestions(prev => {
      const next = new Set(prev);
      if (next.has(qid)) next.delete(qid); else next.add(qid);
      return next;
    });
    setImportantIds(prev => {
      const next = new Set(prev);
      if (wasImportant) next.delete(qid); else next.add(qid);
      return next;
    });
    try {
      const removeTag = onRemoveTag || removeQuestionTag;
      const addTag = onAddTag || addQuestionTag;
      if (wasImportant) await removeTag(qid, 'important');
      else await addTag(qid, 'important');
    } catch {}
  };

  const toggleReview = async () => {
    const qid = currentQuestion.id;
    const wasEdit = editTagIds.has(qid);
    setReviewedQuestions(prev => {
      const next = new Set(prev);
      if (next.has(qid)) next.delete(qid); else next.add(qid);
      return next;
    });
    setEditTagIds(prev => {
      const next = new Set(prev);
      if (wasEdit) next.delete(qid); else next.add(qid);
      return next;
    });
    try {
      const removeTag = onRemoveTag || removeQuestionTag;
      const addTag = onAddTag || addQuestionTag;
      if (wasEdit) await removeTag(qid, 'edit');
      else await addTag(qid, 'edit');
    } catch {}
  };

  const jumpTo = (index: number) => {
    setCurrentIndex(index);
    const ans = answers[filteredQuestions[index]?.id];
    setSelectedAnswer(ans ?? null);
    setShowFeedback(ans !== undefined);
    setShowNav(false);
  };

  const answeredCount = filteredQuestions.filter(q => answers[q.id] !== undefined).length;
  const unvisitedCount = filteredQuestions.length - answeredCount;

  const formatTime = (s: number) => {
    const h = Math.floor(s / 3600);
    const m = Math.floor((s % 3600) / 60);
    const sec = s % 60;
    if (h > 0) return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${sec.toString().padStart(2, '0')}`;
    return `${m.toString().padStart(2, '0')}:${sec.toString().padStart(2, '0')}`;
  };

  const getOptionStyle = (optionIndex: number) => {
    if (!showFeedback) {
      const isSelected = selectedAnswer === optionIndex;
      return {
        container: {
          backgroundColor: isSelected ? (isDark ? '#10B981' + '12' : '#ECFDF5') : C.card,
          borderColor: isSelected ? '#10B981' : C.border,
        },
        letterBg: isSelected ? '#10B981' : C.muted,
        letterText: isSelected ? '#FFFFFF' : C.mutedForeground,
        textColor: isSelected ? C.foreground : C.foreground,
        icon: null,
      };
    }
    if (optionIndex === currentQuestion.correctAnswer) {
      return {
        container: { backgroundColor: '#10B981' + '12', borderColor: '#10B981' },
        letterBg: '#10B981',
        letterText: '#FFFFFF',
        textColor: C.foreground,
        icon: { name: 'checkmark-circle' as const, color: '#10B981' },
      };
    }
    if (selectedAnswer === optionIndex && optionIndex !== currentQuestion.correctAnswer) {
      return {
        container: { backgroundColor: C.destructive + '12', borderColor: C.destructive },
        letterBg: C.destructive,
        letterText: '#FFFFFF',
        textColor: C.foreground,
        icon: { name: 'close-circle' as const, color: C.destructive },
      };
    }
    return {
      container: { backgroundColor: C.card, borderColor: C.border },
      letterBg: C.muted,
      letterText: C.mutedForeground,
      textColor: C.mutedForeground,
      icon: null,
    };
  };

  if (!currentQuestion) return null;

  // ─── Language helpers ───
  const bi = bilingualData?.[currentQuestion.id];
  const displayQuestion = isEnglish && bi ? bi.question_en : currentQuestion.question;
  const displayOptions = isEnglish && bi ? bi.options_en : currentQuestion.options;
  const displayExplanation = isEnglish && bi ? bi.explanation_en : currentQuestion.explanation;

  return (
    <View style={{ flex: 1 }}>
      {/* Top Bar */}
      <View style={[styles.topBar, { backgroundColor: isDark ? C.card + 'CC' : C.card + 'CC', borderBottomColor: C.border }]}>
        <View style={styles.topBarLeft}>
          <View style={[styles.qBadge, { backgroundColor: isDark ? '#312E81' + '20' : '#EEF2FF', borderColor: isDark ? C.primary + '30' : '#C7D2FE' }]}>
            <Text style={[styles.qBadgeText, { color: C.primary }]}>Que. {currentIndex + 1} of {filteredQuestions.length}</Text>
          </View>
        </View>

        <View style={styles.topBarRight}>
          <View style={[styles.timerPill, { backgroundColor: C.muted, borderColor: C.border }]}>
            <Ionicons name="time-outline" size={13} color={C.primary} />
            <Text style={[styles.timerText, { color: C.foreground }]}>{formatTime(elapsedTime)}</Text>
          </View>
          {/* Filter important */}
          <TouchableOpacity
            style={[styles.gridFab, { backgroundColor: filterImportant ? '#F43F5E18' : C.muted, borderColor: filterImportant ? '#F43F5E' : C.border }]}
            onPress={() => {
              setFilterImportant(prev => !prev);
              setCurrentIndex(0);
              const firstQ = filterImportant ? questions[0] : (importantIds.size > 0 ? questions.find(q => importantIds.has(q.id)) : questions[0]);
              if (firstQ) {
                setSelectedAnswer(answers[firstQ.id] ?? null);
                setShowFeedback(answers[firstQ.id] !== undefined);
              }
            }}>
            <Ionicons name={filterImportant ? 'filter' : 'filter-outline'} size={15}
              color={filterImportant ? '#F43F5E' : C.mutedForeground} />
          </TouchableOpacity>
          {/* Language toggle */}
          {bilingualData && (
            <TouchableOpacity style={[styles.gridFab, { backgroundColor: isEnglish ? C.primary + '18' : C.muted, borderColor: isEnglish ? C.primary : C.border }]}
              onPress={() => setIsEnglish(!isEnglish)}>
              <Text style={{ fontSize: 10, fontWeight: '800', color: isEnglish ? C.primary : C.mutedForeground }}>
                {isEnglish ? 'EN' : 'HI'}
              </Text>
            </TouchableOpacity>
          )}
          {/* Navigation Hub */}
          <TouchableOpacity style={[styles.gridFab, { backgroundColor: C.muted, borderColor: C.border }]}
            onPress={() => setShowNav(!showNav)}>
            <Ionicons name="grid-outline" size={17} color={C.primary} />
          </TouchableOpacity>
          {/* Review / Edit toggle */}
          <TouchableOpacity style={[styles.gridFab, { backgroundColor: editTagIds.has(currentQuestion.id) ? '#F59E0B18' : C.muted, borderColor: editTagIds.has(currentQuestion.id) ? '#F59E0B' : C.border }]}
            onPress={toggleReview}>
            <Ionicons name={editTagIds.has(currentQuestion.id) ? 'pencil' : 'pencil-outline'} size={15}
              color={editTagIds.has(currentQuestion.id) ? '#F59E0B' : C.mutedForeground} />
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView ref={scrollRef} style={{ flex: 1 }} contentContainerStyle={{ padding: Spacing.md, gap: Spacing.md, paddingBottom: 40 }} scrollEnabled={!showNav}>
        {/* Question */}
        <View>
          <Text style={[styles.questionText, { color: isDark ? C.foreground : '#0F172A' }]}>
            {displayQuestion}
          </Text>
        </View>

        {/* Options (supports 4 or 5) */}
        <View style={{ gap: Spacing.xs }}>
          {displayOptions.map((option, index) => {
            const opt = getOptionStyle(index);
            return (
              <TouchableOpacity
                key={index}
                style={[styles.option, opt.container, opt.icon && { position: 'relative' } as any,
                  showFeedback && index === currentQuestion.correctAnswer && { borderWidth: 2 },
                ]}
                onPress={() => handleAnswer(index)}
                disabled={showFeedback}
                activeOpacity={0.95}
              >
                <View style={[styles.optionLetter, { backgroundColor: opt.letterBg }]}>
                  <Text style={{ fontSize: FontSize.sm, fontWeight: '700', color: opt.letterText }}>
                    {String.fromCharCode(65 + index)}
                  </Text>
                </View>
                <Text style={{ flex: 1, fontSize: FontSize.md, color: opt.textColor, lineHeight: 20 }}>
                  {option}
                </Text>
                {opt.icon && (
                  <Ionicons name={opt.icon.name} size={22} color={opt.icon.color} style={{ position: 'absolute', right: Spacing.md }} />
                )}
              </TouchableOpacity>
            );
          })}
        </View>

        {/* Explanation */}
        {showFeedback && displayExplanation && (
          <View style={[styles.explanationCard, { backgroundColor: isDark ? C.background : '#F8FAFC', borderColor: isDark ? C.border : '#E2E8F0' }]}>
            <View style={[styles.explanationAccent, { backgroundColor: '#10B981' }]} />
            <View style={styles.explanationContent}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, marginBottom: Spacing.sm }}>
                <Ionicons name="bulb-outline" size={16} color={C.primary} />
                <Text style={[styles.explanationTitle, { color: isDark ? C.foreground : '#0F172A' }]}>Key Takeaway</Text>
              </View>
              <Text style={[styles.explanationText, { color: isDark ? C.mutedForeground : '#475569' }]}>
                {displayExplanation}
              </Text>
            </View>
          </View>
        )}

        {/* Action Buttons - Previous / Delete / Flag / Next */}
        <View style={[styles.actionRow, { gap: Spacing.sm }]}>
          <TouchableOpacity
            style={[styles.prevBtn, { borderColor: C.border, flex: 1 }]}
            onPress={handlePrev}
            disabled={currentIndex === 0}
          >
            <Ionicons name="arrow-back" size={16} color={currentIndex === 0 ? C.mutedForeground : C.foreground} />
            <Text style={[styles.prevBtnText, { color: currentIndex === 0 ? C.mutedForeground : C.foreground }]}>
              {'  '}Previous
            </Text>
          </TouchableOpacity>

          {/* Delete question from DB + N8N webhook */}
          <TouchableOpacity
            style={[styles.iconActionBtn, {
              backgroundColor: deleteStatus === 'done' ? '#10B98118' : C.muted,
              borderColor: deleteStatus === 'done' ? '#10B981' : deleteStatus === 'sending' ? '#F59E0B' : C.border,
            }]}
            onPress={async () => {
              if (deleteStatus !== 'idle') return;
              setDeleteStatus('sending');
              const qid = currentQuestion.id;
              const mcqId = parseInt(qid.replace('ecq_', ''), 10);
              const remaining = filteredQuestions.filter(q => q.id !== qid);
              setAnswers(prev => { const n = { ...prev }; delete n[qid]; return n; });
              const ok = await sendN8NDelete(qid);
              setDeleteStatus(ok ? 'done' : 'idle');
              if (ok) {
                // Delete from DB — use custom handler or default electrician-db
                if (onDeleteQuestion) {
                  onDeleteQuestion(qid).catch(() => {});
                } else if (!isNaN(mcqId)) {
                  deleteMCQById(mcqId).catch(() => {});
                }
                if (onQuestionDeleted) onQuestionDeleted(qid);
                setTimeout(() => {
                  if (remaining.length === 0) { onComplete(answers, elapsedTime); return; }
                  const newIdx = Math.min(currentIndex, remaining.length - 1);
                  setCurrentIndex(newIdx);
                  const nextQ = remaining[newIdx];
                  setSelectedAnswer(answers[nextQ?.id] ?? null);
                  setShowFeedback(answers[nextQ?.id] !== undefined);
                  setDeleteStatus('idle');
                }, 600);
              }
            }}
          >
            {deleteStatus === 'sending' ? (
              <Ionicons name="sync" size={16} color="#F59E0B" />
            ) : deleteStatus === 'done' ? (
              <Ionicons name="checkmark" size={16} color="#10B981" />
            ) : (
              <Ionicons name="trash-outline" size={16} color={C.destructive} />
            )}
          </TouchableOpacity>

          {/* Flag / Important */}
          <TouchableOpacity
            style={[styles.iconActionBtn, { backgroundColor: importantIds.has(currentQuestion.id) ? C.warning + '18' : C.muted, borderColor: importantIds.has(currentQuestion.id) ? C.warning : C.border }]}
            onPress={toggleFlag}
          >
            <Ionicons
              name={importantIds.has(currentQuestion.id) ? "flag" : "flag-outline"}
              size={16}
              color={importantIds.has(currentQuestion.id) ? C.warning : C.mutedForeground}
            />
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.nextBtn, { backgroundColor: C.primary, opacity: showFeedback ? 1 : 0.5, flex: 1 }]}
            onPress={handleNext}
            disabled={!showFeedback}
          >
            <Text style={[styles.nextBtnText, { color: C.primaryForeground }]}>
              {isLastQuestion ? 'Submit' : 'Next  '}
            </Text>
            <Ionicons name={isLastQuestion ? "checkmark" : "arrow-forward"} size={16} color={C.primaryForeground} />
          </TouchableOpacity>
        </View>

        {/* Status */}
        <View style={[styles.statusPanel, { backgroundColor: C.card, borderColor: C.border }]}>
          <View style={styles.statusRow}>
            <View style={styles.statusItem}>
              <View style={[styles.statusDot, { backgroundColor: '#10B981' }]} />
              <Text style={[styles.statusLabel, { color: C.mutedForeground }]}>Answered ({answeredCount})</Text>
            </View>
            <View style={styles.statusItem}>
              <View style={[styles.statusDot, { backgroundColor: C.primary, borderWidth: 2, borderColor: C.primary }]} />
              <Text style={[styles.statusLabel, { color: C.mutedForeground }]}>Current ({currentIndex + 1})</Text>
            </View>
            <View style={styles.statusItem}>
              <View style={[styles.statusDot, { backgroundColor: C.warning }]} />
              <Text style={[styles.statusLabel, { color: C.mutedForeground }]}>Important ({importantIds.size})</Text>
            </View>
            <View style={styles.statusItem}>
              <View style={[styles.statusDot, { backgroundColor: '#F59E0B' }]} />
              <Text style={[styles.statusLabel, { color: C.mutedForeground }]}>Edited ({editTagIds.size})</Text>
            </View>
            <View style={styles.statusItem}>
              <View style={[styles.statusDot, { backgroundColor: 'transparent', borderWidth: 1, borderColor: C.border }]} />
              <Text style={[styles.statusLabel, { color: C.mutedForeground }]}>Unvisited ({unvisitedCount})</Text>
            </View>
          </View>
        </View>
      </ScrollView>

      {/* Navigation Hub Overlay - scrollable for many questions */}
      {showNav && (
        <View style={[styles.navOverlay, { backgroundColor: 'rgba(0,0,0,0.6)' }]}>
          <View style={[styles.navPanel, { backgroundColor: C.card, borderColor: C.border }]}>
            <View style={styles.navPanelHeader}>
              <Text style={{ fontSize: FontSize.lg, fontWeight: '700', color: C.foreground }}>Navigation Hub</Text>
              <TouchableOpacity onPress={() => setShowNav(false)} style={{ padding: Spacing.xs }}>
                <Ionicons name="close" size={22} color={C.mutedForeground} />
              </TouchableOpacity>
            </View>

            <ScrollView ref={navGridRef} style={{ maxHeight: 300 }} contentContainerStyle={styles.navGrid} nestedScrollEnabled>
              {filteredQuestions.map((q, i) => {
                const isAnswered = answers[q.id] !== undefined;
                const isImportant = importantIds.has(q.id);
                const isCurrent = i === currentIndex;

                let itemStyle: any = {};

                if (isCurrent) {
                  itemStyle = { backgroundColor: isDark ? '#312E81' + '25' : '#EEF2FF', borderWidth: 2, borderColor: C.primary };
                } else if (isAnswered) {
                  itemStyle = { backgroundColor: C.primary };
                } else if (isImportant) {
                  itemStyle = { backgroundColor: isDark ? '#78350F' + '25' : '#FFFBEB', borderWidth: 1, borderColor: C.warning + '40' };
                } else {
                  itemStyle = { backgroundColor: C.background, borderWidth: 1, borderColor: C.border };
                }

                const textColor = isAnswered && !isCurrent ? '#FFFFFF' : isCurrent ? C.primary : isImportant ? C.warning : C.mutedForeground;

                return (
                  <TouchableOpacity
                    key={q.id}
                    style={[styles.navItem, itemStyle]}
                    onPress={() => jumpTo(i)}
                  >
                    <Text style={{ fontSize: 12, fontWeight: '600', color: textColor }}>
                      {i + 1}
                    </Text>
                    {isImportant && !isAnswered && (
                      <View style={[styles.navFlagDot, { backgroundColor: C.warning }]} />
                    )}
                  </TouchableOpacity>
                );
              })}
            </ScrollView>

            {/* Status Legend */}
            <View style={[styles.navLegend, { borderTopColor: C.border }]}>
              <View style={styles.legendGrid}>
                <View style={styles.legendItem}>
                  <View style={[styles.legendDot, { backgroundColor: C.primary }]} />
                  <Text style={{ fontSize: 11, fontWeight: '500', color: C.foreground }}>Answered</Text>
                </View>
                <View style={styles.legendItem}>
                  <View style={[styles.legendDot, { backgroundColor: C.background, borderWidth: 2, borderColor: C.primary }]} />
                  <Text style={{ fontSize: 11, fontWeight: '500', color: C.foreground }}>Current</Text>
                </View>
                <View style={styles.legendItem}>
                  <View style={[styles.legendDot, { backgroundColor: C.warning }]} />
                  <Text style={{ fontSize: 11, fontWeight: '500', color: C.foreground }}>Important</Text>
                </View>
                <View style={styles.legendItem}>
                  <View style={[styles.legendDot, { backgroundColor: C.background, borderWidth: 1, borderColor: C.border }]} />
                  <Text style={{ fontSize: 11, fontWeight: '500', color: C.foreground }}>Unvisited</Text>
                </View>
              </View>
            </View>
          </View>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  topBar: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm,
    borderBottomWidth: 1, gap: Spacing.sm,
  },
  topBarLeft: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  topBarRight: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  qBadge: { paddingHorizontal: Spacing.sm, paddingVertical: 4, borderRadius: BorderRadius.sm, borderWidth: 1 },
  qBadgeText: { fontSize: 10, fontWeight: '700' },
  timerPill: {
    flexDirection: 'row', alignItems: 'center', gap: Spacing.xs,
    paddingVertical: 4, paddingHorizontal: Spacing.sm,
    borderRadius: BorderRadius.sm, borderWidth: 1,
  },
  timerText: { fontSize: FontSize.xs, fontWeight: '700', fontFamily: 'monospace' },
  gridFab: { width: 30, height: 30, borderRadius: BorderRadius.sm, alignItems: 'center', justifyContent: 'center', borderWidth: 1 },
  questionText: { fontSize: 17, fontWeight: '700', lineHeight: 24, letterSpacing: -0.3 },
  option: {
    flexDirection: 'row', alignItems: 'center',
    padding: Spacing.sm + 2, borderRadius: BorderRadius.lg, borderWidth: 2,
    gap: Spacing.sm, minHeight: 52, flexShrink: 1,
  },
  optionLetter: {
    width: 34, height: 34, borderRadius: BorderRadius.sm,
    alignItems: 'center', justifyContent: 'center',
  },
  explanationCard: {
    borderRadius: BorderRadius.lg, borderWidth: 1,
    flexDirection: 'row', overflow: 'hidden',
    boxShadow: '0 2px 8px rgba(0,0,0,0.04)',
  },
  explanationAccent: { width: 5 },
  explanationContent: { flex: 1, padding: Spacing.md },
  explanationTitle: { fontSize: FontSize.xs, fontWeight: '700', letterSpacing: 0.5 },
  explanationText: { fontSize: FontSize.sm, lineHeight: 20 },
  actionRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingTop: Spacing.sm,
  },
  prevBtn: {
    flexDirection: 'row', alignItems: 'center',
    paddingVertical: Spacing.sm + 2, paddingHorizontal: Spacing.md,
    borderRadius: BorderRadius.lg, borderWidth: 1,
  },
  prevBtnText: { fontSize: FontSize.xs, fontWeight: '700' },
  iconActionBtn: {
    width: 34, height: 34, borderRadius: BorderRadius.md,
    alignItems: 'center', justifyContent: 'center', borderWidth: 1,
  },
  nextBtn: {
    flexDirection: 'row', alignItems: 'center',
    paddingVertical: Spacing.sm + 2, paddingHorizontal: Spacing.md,
    borderRadius: BorderRadius.lg,
  },
  nextBtnText: { fontSize: FontSize.xs, fontWeight: '700' },
  statusPanel: {
    borderRadius: BorderRadius.lg, borderWidth: 1,
    paddingVertical: Spacing.sm, paddingHorizontal: Spacing.sm, marginTop: Spacing.sm,
  },
  statusRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md },
  statusItem: { flexDirection: 'row', alignItems: 'center', gap: 3, flexShrink: 1 },
  statusDot: { width: 8, height: 8, borderRadius: 3, flexShrink: 0 },
  statusLabel: { fontSize: 10, fontWeight: '500', flexShrink: 1 },
  navOverlay: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, justifyContent: 'center', alignItems: 'center', zIndex: 100, elevation: 100 },
  navPanel: {
    borderRadius: BorderRadius.xl, padding: Spacing.md, paddingVertical: Spacing.lg,
    width: '90%', maxHeight: '80%', borderWidth: 1, gap: Spacing.md,
  },
  navPanelHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: Spacing.sm },
  navGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm, justifyContent: 'center', paddingBottom: Spacing.sm },
  navItem: { width: 44, height: 44, borderRadius: BorderRadius.md, alignItems: 'center', justifyContent: 'center', position: 'relative' },
  navFlagDot: { position: 'absolute', top: 6, right: 6, width: 6, height: 6, borderRadius: 3 },
  navLegend: { marginTop: Spacing.sm, paddingTop: Spacing.md, borderTopWidth: 1 },
  legendGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.md },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: Spacing.xs },
  legendDot: { width: 12, height: 12, borderRadius: 4 },
});
