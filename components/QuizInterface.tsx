import React, { useState, useEffect, useRef } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Question } from '../lib/types';
import { useTheme, Spacing, BorderRadius, FontSize } from '../lib/theme';

interface Props {
  questions: Question[];
  onComplete: (answers: Record<string, number>, timeTaken: number) => void;
}

export default function QuizInterface({ questions, onComplete }: Props) {
  const { colors: C, isDark } = useTheme();
  const [currentIndex, setCurrentIndex] = useState(0);
  const [selectedAnswer, setSelectedAnswer] = useState<number | null>(null);
  const [answers, setAnswers] = useState<Record<string, number>>({});
  const [showFeedback, setShowFeedback] = useState(false);
  const [flaggedQuestions, setFlaggedQuestions] = useState<Set<string>>(new Set());
  const [elapsedTime, setElapsedTime] = useState(0);
  const [showNav, setShowNav] = useState(false);
  const scrollRef = useRef<ScrollView>(null);
  const startTime = useRef(Date.now());

  const currentQuestion = questions[currentIndex];
  const isLastQuestion = currentIndex === questions.length - 1;
  const navGridRef = useRef<ScrollView>(null);

  useEffect(() => {
    const interval = setInterval(() => {
      setElapsedTime(Math.floor((Date.now() - startTime.current) / 1000));
    }, 1000);
    return () => clearInterval(interval);
  }, []);

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
      const nextAnswer = answers[questions[nextIdx]?.id];
      setSelectedAnswer(nextAnswer ?? null);
      setShowFeedback(nextAnswer !== undefined);
    }
  };

  const handlePrev = () => {
    if (currentIndex > 0) {
      const prevIdx = currentIndex - 1;
      setCurrentIndex(prevIdx);
      const prevAnswer = answers[questions[prevIdx]?.id];
      setSelectedAnswer(prevAnswer ?? null);
      setShowFeedback(prevAnswer !== undefined);
    }
  };

  const toggleFlag = () => {
    setFlaggedQuestions(prev => {
      const next = new Set(prev);
      if (next.has(currentQuestion.id)) next.delete(currentQuestion.id);
      else next.add(currentQuestion.id);
      return next;
    });
  };

  const jumpTo = (index: number) => {
    setCurrentIndex(index);
    const ans = answers[questions[index]?.id];
    setSelectedAnswer(ans ?? null);
    setShowFeedback(ans !== undefined);
    setShowNav(false);
  };

  const answeredCount = Object.keys(answers).length;
  const unvisitedCount = questions.length - answeredCount;

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

  return (
    <View style={{ flex: 1 }}>
      {/* Top Bar - simplified: Question badge + Timer + Nav hub */}
      <View style={[styles.topBar, { backgroundColor: isDark ? C.card + 'CC' : C.card + 'CC', borderBottomColor: C.border }]}>
        <View style={styles.topBarLeft}>
          {/* Question count badge */}
          <View style={[styles.qBadge, { backgroundColor: isDark ? '#312E81' + '20' : '#EEF2FF', borderColor: isDark ? C.primary + '30' : '#C7D2FE' }]}>
            <Text style={[styles.qBadgeText, { color: C.primary }]}>Question {currentIndex + 1} of {questions.length}</Text>
          </View>
        </View>

        <View style={styles.topBarRight}>
          {/* Timer */}
          <View style={[styles.timerPill, { backgroundColor: C.muted, borderColor: C.border }]}>
            <Ionicons name="time-outline" size={14} color={C.primary} />
            <Text style={[styles.timerText, { color: C.foreground }]}>{formatTime(elapsedTime)}</Text>
          </View>
          {/* Navigation Hub button */}
          <TouchableOpacity style={[styles.gridFab, { backgroundColor: C.muted, borderColor: C.border }]}
            onPress={() => setShowNav(!showNav)}>
            <Ionicons name="grid-outline" size={18} color={C.primary} />
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView ref={scrollRef} style={{ flex: 1 }} contentContainerStyle={{ padding: Spacing.lg, gap: Spacing.lg, paddingBottom: 40 }} scrollEnabled={!showNav}>
        {/* Question */}
        <View>
          <Text style={[styles.questionText, { color: isDark ? C.foreground : '#0F172A' }]}>
            {currentQuestion.question}
          </Text>
        </View>

        {/* Options */}
        <View style={{ gap: Spacing.sm }}>
          {currentQuestion.options.map((option, index) => {
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
                <Text style={{ flex: 1, fontSize: FontSize.md, color: opt.textColor, lineHeight: 22 }}>
                  {option}
                </Text>
                {opt.icon && (
                  <Ionicons
                    name={opt.icon.name}
                    size={24}
                    color={opt.icon.color}
                    style={{ position: 'absolute', right: Spacing.md }}
                  />
                )}
              </TouchableOpacity>
            );
          })}
        </View>

        {/* Explanation */}
        {showFeedback && currentQuestion.explanation && (
          <View style={[styles.explanationCard, { backgroundColor: isDark ? C.background : '#F8FAFC', borderColor: isDark ? C.border : '#E2E8F0' }]}>
            <View style={[styles.explanationAccent, { backgroundColor: '#10B981' }]} />
            <View style={styles.explanationContent}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, marginBottom: Spacing.sm }}>
                <Ionicons name="bulb-outline" size={18} color={C.primary} />
                <Text style={[styles.explanationTitle, { color: isDark ? C.foreground : '#0F172A' }]}>Key Takeaway</Text>
              </View>
              <Text style={[styles.explanationText, { color: isDark ? C.mutedForeground : '#475569' }]}>
                {currentQuestion.explanation}
              </Text>
            </View>
          </View>
        )}

        {/* Action Buttons - Previous / Flag / Next */}
        <View style={styles.actionRow}>
          <TouchableOpacity
            style={[styles.prevBtn, { borderColor: C.border }]}
            onPress={handlePrev}
            disabled={currentIndex === 0}
          >
            <Ionicons name="arrow-back" size={18} color={currentIndex === 0 ? C.mutedForeground : C.foreground} />
            <Text style={[styles.prevBtnText, { color: currentIndex === 0 ? C.mutedForeground : C.foreground }]}>
              {'  '}Previous
            </Text>
          </TouchableOpacity>

          <View style={{ flexDirection: 'row', gap: Spacing.sm }}>
            <TouchableOpacity
              style={[styles.flagBtn, { backgroundColor: C.muted, borderColor: C.border }]}
              onPress={toggleFlag}
            >
              <Ionicons
                name={flaggedQuestions.has(currentQuestion.id) ? "flag" : "flag-outline"}
                size={18}
                color={flaggedQuestions.has(currentQuestion.id) ? C.warning : C.mutedForeground}
              />
              <Text style={[styles.flagBtnText, { color: C.mutedForeground }]}>  Flag</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.nextBtn, { backgroundColor: C.primary, opacity: showFeedback ? 1 : 0.5 }]}
              onPress={handleNext}
              disabled={!showFeedback}
            >
              <Text style={[styles.nextBtnText, { color: C.primaryForeground }]}>
                {isLastQuestion ? 'Submit' : 'Next  '}
              </Text>
              <Ionicons name={isLastQuestion ? "checkmark" : "arrow-forward"} size={18} color={C.primaryForeground} />
            </TouchableOpacity>
          </View>
        </View>

        {/* Status Card Panel - Answered, Current, Flagged, Unvisited */}
        <View style={[styles.statusPanel, { backgroundColor: C.card, borderColor: C.border }]}>
          <Text style={[styles.statusTitle, { color: C.mutedForeground }]}>Status</Text>
          <View style={styles.statusGrid}>
            <View style={styles.statusItem}>
              <View style={[styles.statusDot, { backgroundColor: '#10B981' }]} />
              <Text style={[styles.statusLabel, { color: C.mutedForeground }]}>Answered ({answeredCount})</Text>
            </View>
            <View style={styles.statusItem}>
              <View style={[styles.statusDot, { backgroundColor: C.primary, borderWidth: 2, borderColor: C.primary }]} />
              <Text style={[styles.statusLabel, { color: C.mutedForeground }]}>Current</Text>
            </View>
            <View style={styles.statusItem}>
              <View style={[styles.statusDot, { backgroundColor: C.warning }]} />
              <Text style={[styles.statusLabel, { color: C.mutedForeground }]}>Flagged ({flaggedQuestions.size})</Text>
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
              {questions.map((q, i) => {
                const isAnswered = answers[q.id] !== undefined;
                const isFlagged = flaggedQuestions.has(q.id);
                const isCurrent = i === currentIndex;

                let itemStyle: any = {};

                if (isCurrent) {
                  itemStyle = { backgroundColor: isDark ? '#312E81' + '25' : '#EEF2FF', borderWidth: 2, borderColor: C.primary };
                } else if (isAnswered) {
                  itemStyle = { backgroundColor: C.primary };
                } else if (isFlagged) {
                  itemStyle = { backgroundColor: isDark ? '#78350F' + '25' : '#FFFBEB', borderWidth: 1, borderColor: C.warning + '40' };
                } else {
                  itemStyle = { backgroundColor: C.background, borderWidth: 1, borderColor: C.border };
                }

                const textColor = isAnswered && !isCurrent ? '#FFFFFF' : isCurrent ? C.primary : isFlagged ? C.warning : C.mutedForeground;

                return (
                  <TouchableOpacity
                    key={q.id}
                    style={[styles.navItem, itemStyle]}
                    onPress={() => jumpTo(i)}
                  >
                    <Text style={{ fontSize: 11, fontWeight: '600', color: textColor }}>
                      {i + 1}
                    </Text>
                    {isFlagged && !isAnswered && (
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
                  <Text style={{ fontSize: 11, fontWeight: '500', color: C.foreground }}>Flagged</Text>
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
    paddingHorizontal: Spacing.md, paddingVertical: Spacing.md,
    borderBottomWidth: 1, gap: Spacing.sm,
  },
  topBarLeft: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  topBarRight: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  qBadge: { paddingHorizontal: Spacing.sm, paddingVertical: 3, borderRadius: BorderRadius.xs, borderWidth: 1 },
  qBadgeText: { fontSize: 10, fontWeight: '700' },
  timerPill: {
    flexDirection: 'row', alignItems: 'center', gap: Spacing.xs,
    paddingVertical: Spacing.sm, paddingHorizontal: Spacing.md,
    borderRadius: BorderRadius.full, borderWidth: 1,
  },
  timerText: { fontSize: FontSize.sm, fontWeight: '700', fontFamily: 'monospace' },
  gridFab: { width: 36, height: 36, borderRadius: BorderRadius.md, alignItems: 'center', justifyContent: 'center', borderWidth: 1 },
  questionText: { fontSize: 20, fontWeight: '700', lineHeight: 28, letterSpacing: -0.3 },
  option: {
    flexDirection: 'row', alignItems: 'center',
    padding: Spacing.md, borderRadius: BorderRadius.lg, borderWidth: 2,
    gap: Spacing.sm, minHeight: 60, flexShrink: 1,
  },
  optionLetter: {
    width: 40, height: 40, borderRadius: BorderRadius.md,
    alignItems: 'center', justifyContent: 'center',
  },
  explanationCard: {
    borderRadius: BorderRadius.lg, borderWidth: 1,
    flexDirection: 'row', overflow: 'hidden',
    boxShadow: '0 2px 8px rgba(0,0,0,0.04)',
  },
  explanationAccent: { width: 5 },
  explanationContent: { flex: 1, padding: Spacing.lg },
  explanationTitle: { fontSize: FontSize.sm, fontWeight: '700', letterSpacing: 0.5 },
  explanationText: { fontSize: FontSize.md, lineHeight: 22 },
  actionRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingTop: Spacing.sm,
  },
  prevBtn: {
    flexDirection: 'row', alignItems: 'center',
    paddingVertical: Spacing.md, paddingHorizontal: Spacing.lg,
    borderRadius: BorderRadius.lg, borderWidth: 1,
  },
  prevBtnText: { fontSize: FontSize.sm, fontWeight: '700' },
  flagBtn: {
    flexDirection: 'row', alignItems: 'center',
    paddingVertical: Spacing.md, paddingHorizontal: Spacing.lg,
    borderRadius: BorderRadius.lg, borderWidth: 1,
  },
  flagBtnText: { fontSize: FontSize.xs, fontWeight: '700', letterSpacing: 0.3 },
  nextBtn: {
    flexDirection: 'row', alignItems: 'center',
    paddingVertical: Spacing.md, paddingHorizontal: Spacing.xl,
    borderRadius: BorderRadius.lg,
  },
  nextBtnText: { fontSize: FontSize.sm, fontWeight: '700' },
  // Status Panel
  statusPanel: {
    borderRadius: BorderRadius.lg, borderWidth: 1,
    padding: Spacing.lg, marginTop: Spacing.md,
  },
  statusTitle: { fontSize: FontSize.xs, fontWeight: '700', letterSpacing: 1, marginBottom: Spacing.md },
  statusGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.md },
  statusItem: { flexDirection: 'row', alignItems: 'center', gap: Spacing.xs },
  statusDot: { width: 12, height: 12, borderRadius: 3 },
  statusLabel: { fontSize: FontSize.xs, fontWeight: '500' },
  // Navigation Hub
  navOverlay: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, justifyContent: 'center', alignItems: 'center', zIndex: 100, elevation: 100 },
  navPanel: {
    borderRadius: BorderRadius.xl, padding: Spacing.md, paddingVertical: Spacing.lg,
    width: '90%', maxHeight: '80%', borderWidth: 1, gap: Spacing.md,
  },
  navPanelHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: Spacing.sm },
  navGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm, justifyContent: 'center', paddingBottom: Spacing.sm },
  navItem: { width: 48, height: 48, borderRadius: BorderRadius.md, alignItems: 'center', justifyContent: 'center', position: 'relative' },
  navFlagDot: { position: 'absolute', top: 6, right: 6, width: 6, height: 6, borderRadius: 3 },
  navLegend: { marginTop: Spacing.sm, paddingTop: Spacing.md, borderTopWidth: 1 },
  legendGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.md },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: Spacing.xs },
  legendDot: { width: 14, height: 14, borderRadius: 4 },
});
