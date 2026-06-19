import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView } from 'react-native';
import { Question, TestConfig } from '../lib/types';
import { Ionicons } from '@expo/vector-icons';
import { useTheme, Spacing, BorderRadius, FontSize } from '../lib/theme';

interface Props {
  questions: Question[];
  answers: Record<string, number>;
  config: TestConfig;
  timeTaken: number;
  onRetry: () => void;
  onNewTest: () => void;
  uniquenessMessage?: string | null;
}

export default function TestResults({
  questions, answers, config, timeTaken,
  onRetry, onNewTest, uniquenessMessage,
}: Props) {
  const { colors: C } = useTheme();
  const correctCount = questions.filter(q => answers[q.id] === q.correctAnswer).length;
  const incorrectCount = questions.length - correctCount;
  const percentage = Math.round((correctCount / questions.length) * 100);

  const getGrade = (pct: number) => {
    if (pct >= 90) return { grade: 'A+', color: '#10B981', msg: 'Outstanding!' };
    if (pct >= 80) return { grade: 'A', color: '#10B981', msg: 'Excellent!' };
    if (pct >= 70) return { grade: 'B', color: C.primary, msg: 'Good Job!' };
    if (pct >= 60) return { grade: 'C', color: C.warning, msg: 'Keep Practicing!' };
    if (pct >= 50) return { grade: 'D', color: C.warning, msg: 'Needs Improvement' };
    return { grade: 'F', color: C.destructive, msg: 'Try Again!' };
  };

  const grade = getGrade(percentage);

  const formatTime = (s: number) => {
    const m = Math.floor(s / 60);
    const sec = s % 60;
    return `${m}m ${sec}s`;
  };

  const topicPerformance = questions.reduce((acc, q) => {
    const topic = q.topic || 'General';
    if (!acc[topic]) acc[topic] = { correct: 0, total: 0 };
    acc[topic].total++;
    if (answers[q.id] === q.correctAnswer) acc[topic].correct++;
    return acc;
  }, {} as Record<string, { correct: number; total: number }>);

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {uniquenessMessage && (
        <View style={[styles.notice, { backgroundColor: C.warning + '15', borderColor: C.warning + '30' }]}>
          <Ionicons name="warning" size={16} color={C.warning} />
          <Text style={{ fontSize: FontSize.md, fontWeight: '600', color: C.warning }}>  Uniqueness Notice</Text>
          <Text style={{ fontSize: FontSize.sm, color: C.warning + 'CC' }}>{uniquenessMessage}</Text>
        </View>
      )}

      {/* Score Overview - matching HTML result & history design */}
      <View style={[styles.scoreCard, { backgroundColor: C.card, borderColor: C.border }]}>
        <View style={[styles.scoreBanner, { backgroundColor: C.primary + '08' }]}>
          <View style={{ flex: 1 }}>
            <Text style={{ fontSize: FontSize.sm, color: C.mutedForeground }}>Your Score</Text>
            <View style={styles.scoreRow}>
              <Text style={{ fontSize: 36, fontWeight: 'bold', color: grade.color }}>{percentage}%</Text>
              <Text style={{ fontSize: 26, fontWeight: 'bold', color: grade.color, marginLeft: Spacing.sm }}>{grade.grade}</Text>
            </View>
            <Text style={{ fontSize: FontSize.lg, fontWeight: '500', color: grade.color }}>{grade.msg}</Text>
          </View>
          <View style={{ alignItems: 'center' }}>
            <Ionicons name="trophy" size={36} color={grade.color} />
            <View style={[styles.progressCircleBg, { backgroundColor: C.muted }]}>
              <View style={[styles.progressCircleFill, { width: `${percentage}%`, backgroundColor: grade.color }]} />
            </View>
          </View>
        </View>

        <View style={styles.statsGrid}>
          {[
            { icon: 'document-text-outline' as const, value: questions.length, label: 'Total Questions', color: C.primary },
            { icon: 'checkmark-circle-outline' as const, value: correctCount, label: 'Correct', color: '#10B981' },
            { icon: 'close-circle-outline' as const, value: incorrectCount, label: 'Incorrect', color: C.destructive },
            { icon: 'timer-outline' as const, value: formatTime(timeTaken), label: 'Completion Time', color: C.primary },
          ].map((stat, i) => (
            <View key={i} style={[styles.statItem, { backgroundColor: C.muted + '40' },
              i === 1 && { backgroundColor: '#10B981' + '08' },
              i === 2 && { backgroundColor: C.destructive + '08' },
            ]}>
              <Ionicons name={stat.icon} size={20} color={stat.color} />
              <Text style={{ fontSize: FontSize.xxl, fontWeight: 'bold', color: stat.color }}>{stat.value}</Text>
              <Text style={{ fontSize: FontSize.xs, color: C.mutedForeground }}>{stat.label}</Text>
            </View>
          ))}
        </View>
      </View>

      {/* Topic Performance */}
      {Object.keys(topicPerformance).length > 0 && (
        <View style={[styles.card, { backgroundColor: C.card, borderColor: C.border }]}>
          <Text style={[styles.cardTitle, { color: C.foreground }]}>
            <Ionicons name="analytics-outline" size={16} color={C.foreground} />  Performance by Topic
          </Text>
          {Object.entries(topicPerformance).map(([topic, { correct, total }]) => {
            const pct = Math.round((correct / total) * 100);
            return (
              <View key={topic} style={{ gap: Spacing.xs }}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                  <Text style={{ fontSize: FontSize.sm, color: C.foreground }}>{topic}</Text>
                  <Text style={{ fontSize: FontSize.sm, color: C.mutedForeground }}>{correct}/{total} ({pct}%)</Text>
                </View>
                <View style={[styles.progressBarBg, { backgroundColor: C.muted }]}>
                  <View style={[styles.progressBar, { width: `${pct}%`, backgroundColor: C.primary }]} />
                </View>
              </View>
            );
          })}
        </View>
      )}

      {/* Config */}
      <View style={[styles.card, { backgroundColor: C.card, borderColor: C.border }]}>
        <Text style={[styles.cardTitle, { color: C.foreground }]}>Test Configuration</Text>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm }}>
          {[config.difficulty, config.language, `${config.questionCount} Qs`].map((tag, i) => (
            <View key={i} style={[styles.badge, { backgroundColor: C.muted, borderColor: C.border }]}>
              <Text style={{ fontSize: 11, color: C.mutedForeground, textTransform: 'capitalize' }}>{tag}</Text>
            </View>
          ))}
        </View>
      </View>

      {/* Detailed Review - matching HTML result design */}
      <View style={[styles.card, { backgroundColor: C.card, borderColor: C.border }]}>
        <Text style={[styles.cardTitle, { color: C.foreground }]}>Detailed Review</Text>
        {questions.map((q, i) => {
          const userAnswer = answers[q.id];
          const isCorrect = userAnswer === q.correctAnswer;
          return (
            <View key={q.id} style={[styles.reviewItem, {
              borderColor: isCorrect ? '#10B981' + '60' : C.destructive + '60',
              backgroundColor: isCorrect ? '#10B981' + '06' : C.destructive + '06',
            }]}>
              <View style={[styles.reviewNum, {
                backgroundColor: isCorrect ? '#10B981' : C.destructive,
              }]}>
                <Text style={{ fontSize: FontSize.sm, fontWeight: '600', color: '#FFFFFF' }}>{i + 1}</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={{ fontSize: FontSize.md, color: C.foreground, fontWeight: '500' }}>{q.question}</Text>
                <View style={{ marginTop: Spacing.sm, flexDirection: 'row', gap: Spacing.sm, flexWrap: 'wrap' }}>
                  <View style={[styles.answerPill, {
                    backgroundColor: isCorrect ? '#10B981' + '12' : C.destructive + '12',
                    borderColor: isCorrect ? '#10B981' + '30' : C.destructive + '30',
                  }]}>
                    <Text style={{ fontSize: 11, color: isCorrect ? '#10B981' : C.destructive, fontWeight: '600' }}>
                      Your answer: {String.fromCharCode(65 + userAnswer)}. {q.options[userAnswer]}
                    </Text>
                  </View>
                  {!isCorrect && (
                    <View style={[styles.answerPill, { backgroundColor: '#10B981' + '12', borderColor: '#10B981' + '30' }]}>
                      <Text style={{ fontSize: 11, color: '#10B981', fontWeight: '600' }}>
                        Correct: {String.fromCharCode(65 + q.correctAnswer)}. {q.options[q.correctAnswer]}
                      </Text>
                    </View>
                  )}
                </View>
                {q.explanation && (
                  <View style={[styles.explanationBox, { backgroundColor: C.primary + '06', borderColor: C.primary + '15' }]}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: Spacing.xs, marginBottom: 4 }}>
                      <Ionicons name="sparkles" size={14} color={C.primary} />
                      <Text style={{ fontSize: 10, fontWeight: '700', color: C.primary, letterSpacing: 1 }}>AI TUTOR INSIGHT</Text>
                    </View>
                    <Text style={{ fontSize: FontSize.sm, color: C.mutedForeground, lineHeight: 20 }} numberOfLines={6}>{q.explanation}</Text>
                  </View>
                )}
              </View>
            </View>
          );
        })}
      </View>

      {/* Actions */}
      <View style={styles.actionRow}>
        <TouchableOpacity style={[styles.actionBtn, { borderColor: C.border }]} onPress={onRetry}>
          <Ionicons name="refresh" size={16} color={C.foreground} />
          <Text style={{ fontSize: FontSize.md, fontWeight: '600', color: C.foreground }}>  Retry</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[styles.actionBtn, { backgroundColor: C.primary }]} onPress={onNewTest}>
          <Ionicons name="add-circle-outline" size={16} color={C.primaryForeground} />
          <Text style={{ fontSize: FontSize.md, fontWeight: '600', color: C.primaryForeground }}>  New Test</Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { gap: Spacing.md, paddingBottom: Spacing.xxxl * 2 },
  notice: { borderRadius: Spacing.sm, padding: Spacing.md, borderWidth: 1, gap: Spacing.xs },
  scoreCard: { borderRadius: BorderRadius.lg, borderWidth: 1, overflow: 'hidden' },
  scoreBanner: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: Spacing.md, flexWrap: 'wrap', gap: Spacing.md },
  scoreRow: { flexDirection: 'row', alignItems: 'baseline' },
  progressCircleBg: { width: 80, height: 6, borderRadius: 3, overflow: 'hidden', marginTop: Spacing.sm },
  progressCircleFill: { height: '100%', borderRadius: 3 },
  statsGrid: { flexDirection: 'row', flexWrap: 'wrap', padding: Spacing.md, gap: Spacing.sm },
  statItem: { flex: 1, minWidth: '45%', alignItems: 'center', padding: Spacing.md, borderRadius: Spacing.sm, gap: Spacing.xs },
  card: { borderRadius: BorderRadius.lg, borderWidth: 1, padding: Spacing.lg, gap: Spacing.md },
  cardTitle: { fontSize: FontSize.lg, fontWeight: '600' },
  badge: { paddingHorizontal: Spacing.md, paddingVertical: Spacing.xs, borderRadius: BorderRadius.full, borderWidth: 1 },
  reviewItem: { padding: Spacing.md, borderRadius: BorderRadius.md, borderWidth: 1, flexDirection: 'row', gap: Spacing.md },
  reviewNum: { width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  answerPill: { paddingHorizontal: Spacing.md, paddingVertical: Spacing.xs, borderRadius: Spacing.sm, borderWidth: 1 },
  explanationBox: { marginTop: Spacing.sm, padding: Spacing.md, borderRadius: BorderRadius.md, borderWidth: 1 },
  actionRow: { flexDirection: 'row', gap: Spacing.md, flexWrap: 'wrap' },
  actionBtn: { flex: 1, paddingVertical: Spacing.lg, borderRadius: Spacing.sm, alignItems: 'center', justifyContent: 'center', flexDirection: 'row', borderWidth: 1 },
  progressBarBg: { height: 6, borderRadius: 3, overflow: 'hidden' },
  progressBar: { height: '100%', borderRadius: 3 },
});
