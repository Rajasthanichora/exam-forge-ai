import React, { useState, useRef, useEffect, useCallback } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Animated, ScrollView, Easing, LayoutAnimation, Platform, UIManager } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Question } from '../lib/types';
import { useTheme, Spacing, BorderRadius, FontSize } from '../lib/theme';

if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

interface Props {
  questions: Question[];
  onConfirm: (shuffledQuestions: Question[]) => void;
  onCancel: () => void;
  testTitle?: string;
}

function shuffleArray<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// Animated bar for answer distribution
function AnimBar({ label, count, max, color, animValue }: {
  label: string; count: number; max: number; color: string; animValue: Animated.Value;
}) {
  const { colors: C } = useTheme();
  const width = animValue.interpolate({
    inputRange: [0, 1],
    outputRange: ['0%', `${max > 0 ? (count / max) * 100 : 0}%`],
  });
  return (
    <View style={abStyles.row}>
      <Text style={[abStyles.label, { color: C.foreground }]}>{label}</Text>
      <View style={[abStyles.track, { backgroundColor: C.background }]}>
        <Animated.View style={[abStyles.fill, { width, backgroundColor: color }]} />
      </View>
      <Text style={[abStyles.count, { color: C.mutedForeground }]}>{count}</Text>
    </View>
  );
}

const abStyles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  label: { fontSize: 11, fontWeight: '700', width: 20 },
  track: { flex: 1, height: 8, borderRadius: 4, overflow: 'hidden' },
  fill: { height: '100%', borderRadius: 4 },
  count: { fontSize: 11, fontWeight: '600', width: 24, textAlign: 'right' },
});

// Single question tile with individual animation
function QuestionTile({ num, isShuffling, color }: { num: number; isShuffling: boolean; color: string }) {
  const scale = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    if (isShuffling) {
      Animated.sequence([
        Animated.timing(scale, { toValue: 0.3, duration: 150, useNativeDriver: true }),
        Animated.timing(scale, { toValue: 1, duration: 200, useNativeDriver: true }),
      ]).start();
    }
  }, [isShuffling, num]);

  return (
    <Animated.View style={[styles.tile, { backgroundColor: color, transform: [{ scale }] }]}>
      <Text style={styles.tileText}>{num}</Text>
    </Animated.View>
  );
}

export default function ShuffleScreen({ questions, onConfirm, onCancel, testTitle }: Props) {
  const { colors: C, isDark } = useTheme();

  const total = questions.length;

  // Question order: array of original indices
  const [questionOrder, setQuestionOrder] = useState<number[]>(() => questions.map((_, i) => i));
  const [questionsShuffled, setQuestionsShuffled] = useState(false);
  const [isShufflingQ, setIsShufflingQ] = useState(false);
  const [qAnimKey, setQAnimKey] = useState(0); // force tiles to re-render with animation

  // Working questions (applies both shuffles)
  const [finalQuestions, setFinalQuestions] = useState<Question[]>(questions);

  // Options shuffle
  const [optionsShuffled, setOptionsShuffled] = useState(false);
  const [isShufflingO, setIsShufflingO] = useState(false);

  // Answer distribution
  const [answerDist, setAnswerDist] = useState<[number, number, number, number]>(() => {
    const d: [number, number, number, number] = [0, 0, 0, 0];
    questions.forEach(q => { if (q.correctAnswer >= 0 && q.correctAnswer < 4) d[q.correctAnswer]++; });
    return d;
  });
  const maxAnswer = Math.max(...answerDist, 1);

  // Animated values for answer bars
  const aBarAnims = useRef([
    new Animated.Value(1), new Animated.Value(1),
    new Animated.Value(1), new Animated.Value(1),
  ]).current;

  // Spinners
  const spinQ = useRef(new Animated.Value(0)).current;
  const spinO = useRef(new Animated.Value(0)).current;
  const startSpin = (anim: Animated.Value) => {
    anim.setValue(0);
    return Animated.loop(
      Animated.timing(anim, { toValue: 1, duration: 800, easing: Easing.linear, useNativeDriver: true })
    );
  };
  const spinInterQ = spinQ.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '360deg'] });
  const spinInterO = spinO.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '360deg'] });

  const letters = ['A', 'B', 'C', 'D'];
  const aColors = [C.primary, '#06B6D4', '#F59E0B', '#10B981'];

  // Tile colors — each original question gets a unique color
  const tileColors = useRef(
    questions.map((_, i) => {
      const hue = (i * (360 / Math.max(total, 1))) % 360;
      return `hsl(${hue}, 55%, 55%)`;
    })
  ).current;

  // Shuffle Questions
  const handleShuffleQuestions = useCallback(() => {
    if (isShufflingQ) return;
    setIsShufflingQ(true);
    const spinAnim = startSpin(spinQ);

    setTimeout(() => {
      const newOrder = shuffleArray(questionOrder);
      setQuestionOrder(newOrder);
      setQuestionsShuffled(true);
      setQAnimKey(k => k + 1);

      // Rebuild finalQuestions from new order
      const reordered = newOrder.map(i => finalQuestions[i]);
      setFinalQuestions(reordered);

      LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);

      spinAnim.stop();
      spinQ.setValue(0);
      setIsShufflingQ(false);
    }, 600);
  }, [isShufflingQ, questionOrder, finalQuestions, spinQ]);

  // Shuffle Options
  const handleShuffleOptions = useCallback(() => {
    if (isShufflingO) return;
    setIsShufflingO(true);
    const spinAnim = startSpin(spinO);

    // Animate bars to 0
    Animated.parallel(aBarAnims.map(a =>
      Animated.timing(a, { toValue: 0, duration: 200, useNativeDriver: false })
    )).start();

    setTimeout(() => {
      const newQuestions = finalQuestions.map(q => {
        const correctText = q.options[q.correctAnswer];
        const shuffledOpts = shuffleArray(q.options);
        const newIdx = shuffledOpts.indexOf(correctText);
        return { ...q, options: shuffledOpts, correctAnswer: newIdx };
      });
      setFinalQuestions(newQuestions);
      setOptionsShuffled(true);

      // Recalculate distribution
      const d: [number, number, number, number] = [0, 0, 0, 0];
      newQuestions.forEach(q => { if (q.correctAnswer >= 0 && q.correctAnswer < 4) d[q.correctAnswer]++; });
      setAnswerDist(d);

      // Animate bars back
      Animated.parallel(aBarAnims.map(a =>
        Animated.timing(a, { toValue: 1, duration: 400, useNativeDriver: false })
      )).start();

      spinAnim.stop();
      spinO.setValue(0);
      setIsShufflingO(false);
    }, 600);
  }, [isShufflingO, finalQuestions, aBarAnims, spinO]);

  const handleStart = () => {
    onConfirm(finalQuestions);
  };

  // How many tiles to show (max 20 for visual clarity, show first N)
  const showCount = Math.min(total, 20);

  return (
    <View style={[styles.container, { backgroundColor: C.background }]}>
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        {/* Logo + Title */}
        <View style={styles.logoRow}>
          <View style={[styles.logoWrap, { backgroundColor: C.primary + '15' }]}>
            <Ionicons name="shuffle" size={22} color={C.primary} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={[styles.testTitle, { color: C.foreground }]} numberOfLines={1}>{testTitle || 'Test'}</Text>
            <Text style={[styles.testSub, { color: C.mutedForeground }]}>
              {questions.length} questions · {optionsShuffled ? 'Options shuffled' : 'Ready to shuffle'}
            </Text>
          </View>
        </View>

        {/* ─── Question Order Card ─── */}
        <View style={[styles.card, { backgroundColor: C.card, borderColor: C.border }]}>
          <View style={styles.cardHeader}>
            <View style={[styles.cardIcon, { backgroundColor: '#10B981' + '15' }]}>
              <Ionicons name="reorder-three-outline" size={16} color="#10B981" />
            </View>
            <Text style={[styles.cardTitle, { color: C.foreground }]}>Question Order</Text>
            {isShufflingQ && (
              <Animated.View style={{ transform: [{ rotate: spinInterQ }] }}>
                <Ionicons name="sync" size={14} color="#10B981" />
              </Animated.View>
            )}
            {questionsShuffled && !isShufflingQ && (
              <View style={[styles.doneBadge, { backgroundColor: '#10B981' + '15' }]}>
                <Ionicons name="checkmark" size={12} color="#10B981" />
                <Text style={[styles.doneText, { color: '#10B981' }]}>Shuffled</Text>
              </View>
            )}
          </View>

          {/* Numbered tile grid — shows actual question positions */}
          <View style={styles.tileGrid}>
            {questionOrder.slice(0, showCount).map((origIdx, pos) => (
              <QuestionTile
                key={`tile-${origIdx}-${qAnimKey}`}
                num={origIdx + 1}
                isShuffling={isShufflingQ}
                color={tileColors[origIdx]}
              />
            ))}
            {total > showCount && (
              <View style={[styles.tile, { backgroundColor: C.muted }]}>
                <Text style={[styles.tileText, { color: C.mutedForeground }]}>+{total - showCount}</Text>
              </View>
            )}
          </View>

          {/* Shuffle button */}
          <TouchableOpacity
            style={[styles.shuffleBtn, { backgroundColor: '#10B981' + '12', borderColor: '#10B981' + '30' }]}
            onPress={handleShuffleQuestions}
            disabled={isShufflingQ}
            activeOpacity={0.7}
          >
            {isShufflingQ ? (
              <Animated.View style={{ transform: [{ rotate: spinInterQ }] }}>
                <Ionicons name="sync" size={16} color="#10B981" />
              </Animated.View>
            ) : (
              <Ionicons name="swap-vertical" size={16} color="#10B981" />
            )}
            <Text style={[styles.shuffleBtnText, { color: '#10B981' }]}>
              {isShufflingQ ? 'Shuffling...' : questionsShuffled ? 'Re-Shuffle Questions' : 'Shuffle Questions'}
            </Text>
          </TouchableOpacity>
        </View>

        {/* ─── Answer Distribution Card ─── */}
        <View style={[styles.card, { backgroundColor: C.card, borderColor: C.border }]}>
          <View style={styles.cardHeader}>
            <View style={[styles.cardIcon, { backgroundColor: C.primary + '15' }]}>
              <Ionicons name="bar-chart-outline" size={16} color={C.primary} />
            </View>
            <Text style={[styles.cardTitle, { color: C.foreground }]}>Answer Distribution</Text>
            {isShufflingO && (
              <Animated.View style={{ transform: [{ rotate: spinInterO }] }}>
                <Ionicons name="sync" size={14} color={C.primary} />
              </Animated.View>
            )}
            {optionsShuffled && !isShufflingO && (
              <View style={[styles.doneBadge, { backgroundColor: C.primary + '15' }]}>
                <Ionicons name="checkmark" size={12} color={C.primary} />
                <Text style={[styles.doneText, { color: C.primary }]}>Shuffled</Text>
              </View>
            )}
          </View>

          {/* A/B/C/D bars */}
          <View style={styles.aBars}>
            {answerDist.map((count, i) => (
              <AnimBar key={i} label={letters[i]} count={count} max={maxAnswer} color={aColors[i]} animValue={aBarAnims[i]} />
            ))}
          </View>

          {/* Shuffle button */}
          <TouchableOpacity
            style={[styles.shuffleBtn, { backgroundColor: C.primary + '12', borderColor: C.primary + '30' }]}
            onPress={handleShuffleOptions}
            disabled={isShufflingO}
            activeOpacity={0.7}
          >
            {isShufflingO ? (
              <Animated.View style={{ transform: [{ rotate: spinInterO }] }}>
                <Ionicons name="sync" size={16} color={C.primary} />
              </Animated.View>
            ) : (
              <Ionicons name="shuffle-outline" size={16} color={C.primary} />
            )}
            <Text style={[styles.shuffleBtnText, { color: C.primary }]}>
              {isShufflingO ? 'Shuffling...' : optionsShuffled ? 'Re-Shuffle Options' : 'Shuffle Options'}
            </Text>
          </TouchableOpacity>
        </View>

        <View style={{ height: 100 }} />
      </ScrollView>

      {/* Fixed bottom bar */}
      <View style={[styles.bottomBar, { backgroundColor: C.card, borderTopColor: C.border }]}>
        <TouchableOpacity
          style={[styles.cancelBtn, { borderColor: C.border }]}
          onPress={onCancel}
          activeOpacity={0.7}
        >
          <Ionicons name="arrow-back" size={18} color={C.foreground} />
          <Text style={[styles.cancelText, { color: C.foreground }]}>Back</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.startBtn, { backgroundColor: C.primary }]}
          onPress={handleStart}
          activeOpacity={0.7}
        >
          <Ionicons name="play" size={18} color="#FFFFFF" />
          <Text style={styles.startText}>Start Test</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  scroll: { padding: Spacing.lg, gap: Spacing.md },

  // Logo
  logoRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md, marginBottom: Spacing.xs },
  logoWrap: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  testTitle: { fontSize: FontSize.lg, fontWeight: '700' },
  testSub: { fontSize: FontSize.xs, marginTop: 2 },

  // Card
  card: { borderRadius: BorderRadius.xl, borderWidth: 1, padding: Spacing.lg, gap: Spacing.md },
  cardHeader: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  cardIcon: { width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  cardTitle: { fontSize: FontSize.md, fontWeight: '700', flex: 1 },
  doneBadge: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 8, paddingVertical: 3, borderRadius: BorderRadius.full },
  doneText: { fontSize: 10, fontWeight: '600' },

  // Question tiles
  tileGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  tile: {
    width: 38, height: 38, borderRadius: 8,
    alignItems: 'center', justifyContent: 'center',
  },
  tileText: { fontSize: 11, fontWeight: '800', color: '#FFFFFF' },

  // Answer bars
  aBars: { gap: Spacing.sm },

  // Shuffle button
  shuffleBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: Spacing.sm, paddingVertical: Spacing.md,
    borderRadius: BorderRadius.lg, borderWidth: 1,
  },
  shuffleBtnText: { fontSize: FontSize.sm, fontWeight: '600' },

  // Bottom bar
  bottomBar: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    flexDirection: 'row', gap: Spacing.md,
    padding: Spacing.lg, paddingBottom: Spacing.xxl,
    borderTopWidth: 1,
  },
  cancelBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    paddingVertical: Spacing.md, paddingHorizontal: Spacing.xl,
    borderRadius: BorderRadius.lg, borderWidth: 1, gap: Spacing.sm, flex: 1,
  },
  cancelText: { fontSize: FontSize.md, fontWeight: '600' },
  startBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    paddingVertical: Spacing.md, paddingHorizontal: Spacing.xl,
    borderRadius: BorderRadius.lg, gap: Spacing.sm, flex: 1,
  },
  startText: { fontSize: FontSize.md, fontWeight: '700', color: '#FFFFFF' },
});
