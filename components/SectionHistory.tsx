import React, { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView, TextInput, Alert } from 'react-native';
import { TestResult } from '../lib/types';
import { Ionicons } from '@expo/vector-icons';
import { useTheme, FontSize, Spacing, BorderRadius } from '../lib/theme';

interface Props {
  testResults: TestResult[];
  sectionName: string;
  questionsStored: number;
  documentsCount: number;
  onRenameTest: (testId: string, newName: string) => void;
  onDeleteTest: (testId: string) => void;
  onRetakeTest: (test: TestResult) => void;
  onClearAll: () => void;
  onBack: () => void;
}

export default function SectionHistory({
  testResults, sectionName, questionsStored, documentsCount,
  onRenameTest, onDeleteTest, onRetakeTest,
  onClearAll, onBack,
}: Props) {
  const { colors: C, isDark } = useTheme();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [filter, setFilter] = useState<'all' | 'incorrect' | 'flagged'>('all');
  const [searchQuery, setSearchQuery] = useState('');

  const totalTests = testResults.length;
  const avgScore = totalTests > 0
    ? Math.round(testResults.reduce((s, r) => s + (r.score / r.totalQuestions) * 100, 0) / totalTests)
    : 0;

  const getScoreColor = (pct: number) => {
    if (pct >= 80) return '#10B981';
    if (pct >= 60) return C.primary;
    if (pct >= 40) return C.warning;
    return C.destructive;
  };

  const totalCorrectAnswers = testResults.reduce((s, r) => s + r.score, 0);
  const totalAllQuestions = testResults.reduce((s, r) => s + r.totalQuestions, 0);
  const totalTimeTaken = testResults.reduce((s, r) => s + (r.timeTaken || 0), 0);

  const formatTime = (s: number) => {
    const m = Math.floor(s / 60);
    const sec = s % 60;
    return `${m}m ${sec}s`;
  };

  const formatDate = (dateStr: string) => {
    try {
      return new Date(dateStr).toLocaleDateString('en-US', {
        month: 'short', day: 'numeric', year: 'numeric',
      });
    } catch { return dateStr; }
  };

  const getGradeLabel = (pct: number) => {
    if (pct >= 90) return 'Excellent';
    if (pct >= 80) return 'Great';
    if (pct >= 60) return 'Good';
    if (pct >= 40) return 'Fair';
    return 'Needs Work';
  };

  const getBadgeTier = (pct: number) => {
    if (pct >= 90) return 'Gold';
    if (pct >= 70) return 'Silver';
    if (pct >= 50) return 'Bronze';
    return 'Unranked';
  };

  const getTierColor = (pct: number) => {
    if (pct >= 90) return '#F59E0B';
    if (pct >= 70) return '#94A3B8';
    if (pct >= 50) return '#CD7F32';
    return C.mutedForeground;
  };

  const filteredResults = searchQuery
    ? testResults.filter(r => r.name.toLowerCase().includes(searchQuery.toLowerCase()))
    : testResults;

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {/* Header with Share Report + Retake - matching result & history.html */}
      <View style={styles.headerRow}>
        <View style={styles.headerTitleGroup}>
          <Text style={[styles.title, { color: C.foreground }]}>Performance Analytics</Text>
          <Text style={[styles.subtitle, { color: C.mutedForeground }]}>
            Session ID: #{sectionName?.slice(0, 3).toUpperCase() || 'EF'}-{Date.now().toString(36).toUpperCase().slice(0, 6)}
          </Text>
        </View>
        <View style={styles.headerActions}>
          <TouchableOpacity style={[styles.headerBtn, { borderColor: C.border }]}>
            <Ionicons name="share-outline" size={14} color={C.mutedForeground} />
            <Text style={[styles.headerBtnText, { color: C.mutedForeground }]}>  Share Report</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.headerBtn, { backgroundColor: C.primary }]}
            onPress={() => {
              if (testResults.length > 0) {
                onRetakeTest(testResults[0]);
              }
            }}>
            <Ionicons name="refresh" size={14} color={C.primaryForeground} />
            <Text style={[styles.headerBtnText, { color: C.primaryForeground }]}>  Retake Assessment</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Performance Overview - Overall report only */}
      <View style={styles.statsGrid}>
        {/* Radial Score Card */}
        <View style={[styles.radialCard, { backgroundColor: C.card, borderColor: C.border }]}>
          <View style={styles.radialContainer}>
            <View style={[styles.radialOuter, { borderColor: C.muted }]}>
              <View style={[styles.radialInner, {
                borderColor: C.primary,
                borderWidth: 6,
                borderRadius: 88,
              }]}>
                <View style={{ alignItems: 'center' }}>
                  <Text style={[styles.radialScore, { color: C.foreground }]}>{avgScore}%</Text>
                  <Text style={[styles.radialLabel, { color: C.mutedForeground }]}>Final Score</Text>
                </View>
              </View>
            </View>
          </View>

          <View style={[styles.rankingBadge, { backgroundColor: '#10B981' + '12', borderColor: '#10B981' + '30' }]}>
            <Ionicons name="trending-up" size={12} color="#10B981" />
            <Text style={[styles.rankingText, { color: '#10B981' }]}>  Top 5% Globally</Text>
          </View>

          <Text style={[styles.radialTitle, { color: C.foreground }]}>
            {avgScore >= 80 ? 'Excellent Performance!' : avgScore >= 60 ? 'Good Progress!' : 'Keep Practicing!'}
          </Text>
          <Text style={[styles.radialDesc, { color: C.mutedForeground }]}>
            You've demonstrated advanced mastery of {sectionName} concepts.
          </Text>
        </View>

        {/* Quick Stats Grid - 2x2 responsive layout */}
        <View style={styles.quickStatsGrid}>
          {/* Card 1: Correct Answers */}
          <View style={[styles.quickStat, { backgroundColor: C.card, borderColor: C.border }]}>
            <View style={[styles.quickStatIconWrap, { backgroundColor: '#10B981' + '12' }]}>
              <Ionicons name="checkmark-circle" size={22} color="#10B981" />
            </View>
            {totalTests > 0 ? (
              <Text style={[styles.quickStatValue, { color: C.foreground }]}>
                {totalCorrectAnswers}/{totalAllQuestions}
              </Text>
            ) : (
              <Text style={[styles.quickStatValue, { color: C.foreground }]}>0</Text>
            )}
            <Text style={[styles.quickStatLabel, { color: C.mutedForeground }]}>Correct Answers</Text>
          </View>

          {/* Card 2: Questions Tracked */}
          <View style={[styles.quickStat, { backgroundColor: C.card, borderColor: C.border }]}>
            <View style={[styles.quickStatIconWrap, { backgroundColor: C.warning + '12' }]}>
              <Ionicons name="layers-outline" size={22} color={C.warning} />
            </View>
            <Text style={[styles.quickStatValue, { color: C.foreground }]}>
              {questionsStored}
            </Text>
            <Text style={[styles.quickStatLabel, { color: C.mutedForeground }]}>Questions Tracked</Text>
          </View>

          {/* Card 3: Total Tests */}
          <View style={[styles.quickStat, { backgroundColor: C.card, borderColor: C.border }]}>
            <View style={[styles.quickStatIconWrap, { backgroundColor: C.primary + '12' }]}>
              <Ionicons name="bar-chart-outline" size={22} color={C.primary} />
            </View>
            <Text style={[styles.quickStatValue, { color: C.foreground }]}>
              {totalTests}
            </Text>
            <Text style={[styles.quickStatLabel, { color: C.mutedForeground }]}>Total Tests</Text>
          </View>

          {/* Card 4: Badge Tier */}
          <View style={[styles.quickStat, { backgroundColor: C.card, borderColor: C.border }]}>
            <View style={[styles.quickStatIconWrap, { backgroundColor: getTierColor(avgScore) + '18' }]}>
              <Ionicons name="trophy-outline" size={22} color={getTierColor(avgScore)} />
            </View>
            <Text style={[styles.quickStatValue, { color: getTierColor(avgScore) }]}>
              {totalTests > 0 ? `${getBadgeTier(avgScore)} Tier` : '—'}
            </Text>
            <Text style={[styles.quickStatLabel, { color: C.mutedForeground }]}>Badge Tier</Text>
          </View>
        </View>
      </View>

      {/* Detailed Review Section */}
      <View style={[styles.reviewSection, { borderBottomColor: C.border }]}>
        <Text style={[styles.sectionTitle, { color: C.foreground }]}>Detailed Review</Text>
        <View style={[styles.filterBar, { backgroundColor: C.muted, borderColor: C.border }]}>
          {(['all', 'incorrect', 'flagged'] as const).map(f => (
            <TouchableOpacity key={f}
              style={[styles.filterBtn, filter === f && { backgroundColor: C.card }]}>
              <Text style={[styles.filterText, {
                color: filter === f ? C.foreground : f === 'incorrect' ? C.destructive : f === 'flagged' ? C.warning : C.mutedForeground,
              }]}>
                {f === 'all' ? 'All Items' : f === 'incorrect' ? `Incorrect` : 'Flagged'}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      {/* Review Items */}
      {testResults.slice(0, 3).map((result, idx) => {
        const pct = Math.round((result.score / result.totalQuestions) * 100);
        const isCorrectItem = pct >= 80;
        return (
          <View key={result.id} style={[styles.reviewItem, {
            backgroundColor: isCorrectItem ? C.card : C.destructive + '06',
            borderColor: isCorrectItem ? C.border : C.destructive + '40',
          }]}>
            <View style={styles.reviewContent}>
              <View style={[styles.reviewNum, {
                backgroundColor: isCorrectItem ? '#10B981' + '12' : C.destructive + '12',
              }]}>
                <Ionicons name={isCorrectItem ? 'checkmark' : 'close'} size={16} color={isCorrectItem ? '#10B981' : C.destructive} />
              </View>
              <View style={{ flex: 1, gap: 4 }}>
                <Text style={[styles.reviewQuestion, { color: C.foreground }]} numberOfLines={2}>
                  {result.questions?.[0]?.question || 'Review question'}
                </Text>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, flexWrap: 'wrap' }}>
                  <Text style={[styles.reviewBadge, {
                    backgroundColor: getScoreColor(pct) + '18',
                  }, styles.reviewBadgeText, { color: getScoreColor(pct) }]}>
                    {pct}%
                  </Text>
                  <Text style={[styles.reviewBadgeText, { color: C.mutedForeground }]}>
                    {getGradeLabel(pct)}
                  </Text>
                </View>
              </View>
            </View>
            <View style={[styles.reviewStats, { borderTopColor: C.border }]}>
              <Text style={[{ fontSize: FontSize.xs, color: C.mutedForeground }]}>
                Score: {result.score}/{result.totalQuestions}
              </Text>
              <Text style={[{ fontSize: FontSize.xs, color: C.mutedForeground }]}>
                Time: {formatTime(result.timeTaken || 0)}
              </Text>
              <Text style={[{ fontSize: FontSize.xs, color: C.mutedForeground }]}>
                {result.config?.difficulty || 'N/A'}
              </Text>
            </View>
          </View>
        );
      })}

      {/* Test History Table */}
      <View style={[styles.historySection, { borderTopColor: C.border }]}>
        <View style={styles.historyHeader}>
          <Text style={[styles.sectionTitle, { color: C.foreground }]}>Test History</Text>
          <View style={[styles.searchBox, { backgroundColor: C.muted, borderColor: C.border }]}>
            <Ionicons name="search-outline" size={14} color={C.mutedForeground} />
            <TextInput
              style={[styles.searchInput, { color: C.foreground }]}
              placeholder="Search tests..."
              placeholderTextColor={C.mutedForeground + '60'}
              value={searchQuery}
              onChangeText={setSearchQuery}
            />
          </View>
        </View>

        {filteredResults.length === 0 ? (
          <View style={[styles.emptyState, { borderColor: C.border }]}>
            <Ionicons name="document-text-outline" size={32} color={C.mutedForeground} />
            <Text style={{ fontSize: FontSize.md, color: C.mutedForeground, textAlign: 'center' }}>
              {searchQuery ? 'No tests match your search.' : 'No tests yet. Generate your first test!'}
            </Text>
          </View>
        ) : (
          <View style={[styles.tableCard, { backgroundColor: C.card, borderColor: C.border }]}>
            {/* Table Header */}
            <View style={[styles.tableHeader, { backgroundColor: C.muted, borderBottomColor: C.border }]}>
              <Text style={[styles.th, { color: C.mutedForeground }]}>TEST</Text>
              <Text style={[styles.th, styles.thRight, { color: C.mutedForeground }]}>SCORE</Text>
              <Text style={[styles.th, styles.thRight, { color: C.mutedForeground }]}>TIME</Text>
              <View style={{ width: 72 }} />
            </View>
            {/* Table Rows */}
            {filteredResults.map((result) => {
              const pct = Math.round((result.score / result.totalQuestions) * 100);
              const scoreColor = getScoreColor(pct);
              const isEditing = editingId === result.id;
              return (
                <View key={result.id} style={[styles.tableRow, { borderBottomColor: C.border }]}>
                  <View style={{ flex: 1, gap: 2 }}>
                    {isEditing ? (
                      <View style={styles.editRow}>
                        <TextInput
                          style={[styles.editInput, { backgroundColor: C.muted, borderColor: C.border, color: C.foreground }]}
                          value={editName}
                          onChangeText={setEditName}
                          autoFocus
                        />
                        <TouchableOpacity onPress={() => {
                          if (editName.trim()) {
                            onRenameTest(result.id, editName.trim());
                            setEditingId(null);
                          }
                        }}>
                          <Ionicons name="checkmark" size={16} color={C.primary} />
                        </TouchableOpacity>
                        <TouchableOpacity onPress={() => setEditingId(null)}>
                          <Ionicons name="close" size={16} color={C.mutedForeground} />
                        </TouchableOpacity>
                      </View>
                    ) : (
                      <>
                        <Text style={[styles.testName, { color: C.foreground }]} numberOfLines={1}>
                          {result.name}
                        </Text>
                        <Text style={[styles.testMeta, { color: C.mutedForeground }]}>
                          {formatDate(result.date)} &middot; Q{result.totalQuestions}
                        </Text>
                      </>
                    )}
                  </View>
                  <View style={styles.cell}>
                    <Text style={[styles.scoreBadge, {
                      backgroundColor: scoreColor + '12',
                      borderColor: scoreColor + '30',
                    }, styles.scoreBadgeText, { color: scoreColor }]}>
                      {pct}%
                    </Text>
                  </View>
                  <Text style={[styles.diffCell, { color: C.mutedForeground }, styles.cell]}>
                    {formatTime(result.timeTaken || 0)}
                  </Text>
                  <View style={styles.actionsCell}>
                    {editingId !== result.id && (
                      <>
                        <TouchableOpacity onPress={() => {
                          setEditingId(result.id);
                          setEditName(result.name);
                        }} style={[styles.actionBtn, { borderColor: C.border }]}>
                          <Ionicons name="pencil-outline" size={14} color={C.mutedForeground} />
                        </TouchableOpacity>
                        <TouchableOpacity onPress={() => onRetakeTest(result)}
                          style={[styles.actionBtn, { backgroundColor: C.primary, marginHorizontal: Spacing.xs }]}>
                          <Ionicons name="refresh" size={14} color={C.primaryForeground} />
                        </TouchableOpacity>
                        <TouchableOpacity onPress={() => {
                          Alert.alert('Delete Test?', `Delete "${result.name}"?`, [
                            { text: 'Cancel', style: 'cancel' },
                            { text: 'Delete', style: 'destructive', onPress: () => onDeleteTest(result.id) },
                          ]);
                        }} style={[styles.actionBtn, { borderColor: C.border }]}>
                          <Ionicons name="trash-outline" size={14} color={C.mutedForeground} />
                        </TouchableOpacity>
                      </>
                    )}
                  </View>
                </View>
              );
            })}
          </View>
        )}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { gap: Spacing.lg, paddingBottom: Spacing.xxxl * 2 },
  headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: Spacing.md },
  headerTitleGroup: { flexShrink: 1, minWidth: 0 },
  title: { fontSize: FontSize.xxl, fontWeight: 'bold' },
  subtitle: { fontSize: 10, fontWeight: '700', letterSpacing: 0.5, marginTop: 2 },
  headerActions: { flexDirection: 'row', gap: Spacing.sm, flexShrink: 0 },
  headerBtn: {
    flexDirection: 'row', alignItems: 'center',
    paddingVertical: Spacing.sm, paddingHorizontal: Spacing.md,
    borderRadius: BorderRadius.lg, borderWidth: 1,
  },
  headerBtnText: { fontSize: 10, fontWeight: '700', letterSpacing: 0.5 },
  statsGrid: { gap: Spacing.md },
  radialCard: {
    borderRadius: BorderRadius.xl, borderWidth: 1, padding: Spacing.xl,
    alignItems: 'center', gap: Spacing.md,
  },
  radialContainer: { width: 192, height: 192, marginBottom: Spacing.sm },
  radialOuter: {
    width: 192, height: 192, borderRadius: 96, borderWidth: 8,
    alignItems: 'center', justifyContent: 'center',
  },
  radialInner: { width: 176, height: 176, alignItems: 'center', justifyContent: 'center' },
  radialScore: { fontSize: 36, fontWeight: '900', letterSpacing: -1 },
  radialLabel: { fontSize: 10, fontWeight: '700', letterSpacing: 0.5 },
  rankingBadge: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: Spacing.md, paddingVertical: Spacing.xs,
    borderRadius: BorderRadius.full, borderWidth: 1,
  },
  rankingText: { fontSize: 10, fontWeight: '800', letterSpacing: 0.5 },
  radialTitle: { fontSize: FontSize.xl, fontWeight: 'bold', marginBottom: -4 },
  radialDesc: { fontSize: FontSize.sm, textAlign: 'center', lineHeight: 20 },

  // Quick Stats Grid - Responsive 2x2 layout
  quickStatsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  quickStat: {
    width: '48%',
    borderRadius: BorderRadius.xl,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: Spacing.lg,
    paddingHorizontal: Spacing.sm,
    gap: Spacing.xs,
    marginBottom: Spacing.sm,
  },
  quickStatIconWrap: {
    width: 48,
    height: 48,
    borderRadius: BorderRadius.md,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.xs,
  },
  quickStatValue: {
    fontSize: 22,
    fontWeight: '900',
    letterSpacing: -0.5,
    textAlign: 'center',
  },
  quickStatLabel: {
    fontSize: 9,
    fontWeight: '700',
    letterSpacing: 0.5,
    textAlign: 'center',
    textTransform: 'uppercase',
  },

  reviewSection: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    flexWrap: 'wrap', gap: Spacing.sm, paddingBottom: Spacing.md, borderBottomWidth: 1,
  },
  sectionTitle: { fontSize: FontSize.xl, fontWeight: 'bold' },
  filterBar: { flexDirection: 'row', borderRadius: BorderRadius.lg, borderWidth: 1, padding: 3 },
  filterBtn: { paddingVertical: Spacing.sm, paddingHorizontal: Spacing.md, borderRadius: BorderRadius.md },
  filterText: { fontSize: 10, fontWeight: '800', letterSpacing: 0.5 },
  reviewItem: { borderRadius: BorderRadius.lg, borderWidth: 1, padding: Spacing.lg },
  reviewContent: { flexDirection: 'row', gap: Spacing.md },
  reviewNum: { width: 40, height: 40, borderRadius: BorderRadius.md, alignItems: 'center', justifyContent: 'center' },
  reviewQuestion: { fontSize: FontSize.sm, fontWeight: '600', flex: 1 },
  reviewBadge: { paddingHorizontal: Spacing.sm, paddingVertical: 2, borderRadius: Spacing.xs },
  reviewBadgeText: { fontSize: 9, fontWeight: '800', letterSpacing: 0.5 },
  reviewStats: { flexDirection: 'row', gap: Spacing.lg, paddingTop: Spacing.sm, marginTop: Spacing.sm, borderTopWidth: 1 },
  historySection: { paddingTop: Spacing.lg, borderTopWidth: 1 },
  historyHeader: { gap: Spacing.md, marginBottom: Spacing.md },
  searchBox: {
    flexDirection: 'row', alignItems: 'center', gap: Spacing.sm,
    borderRadius: BorderRadius.lg, borderWidth: 1,
    paddingHorizontal: Spacing.md, height: 40,
  },
  searchInput: { flex: 1, fontSize: FontSize.sm, height: '100%' },
  emptyState: { borderRadius: BorderRadius.lg, borderWidth: 1, padding: Spacing.xxxl, alignItems: 'center', gap: Spacing.sm },
  tableCard: { borderRadius: BorderRadius.lg, borderWidth: 1, overflow: 'hidden' },
  tableHeader: { flexDirection: 'row', paddingVertical: Spacing.md, paddingHorizontal: Spacing.lg, borderBottomWidth: 1 },
  th: { flex: 1, fontSize: 10, fontWeight: '800', letterSpacing: 1 },
  thRight: { textAlign: 'right' },
  tableRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: Spacing.md, paddingHorizontal: Spacing.lg, borderBottomWidth: 1 },
  testName: { fontSize: FontSize.sm, fontWeight: '600' },
  testMeta: { fontSize: 10, fontWeight: '600', letterSpacing: 0.3 },
  cell: { flex: 1, alignItems: 'center' },
  dateCell: { fontSize: FontSize.xs },
  diffCell: { fontSize: 10, fontWeight: '600' },
  scoreBadge: { paddingHorizontal: Spacing.sm, paddingVertical: 3, borderRadius: Spacing.xs, borderWidth: 1 },
  scoreBadgeText: { fontSize: 10, fontWeight: '700' },
  actionsCell: { flexDirection: 'row', justifyContent: 'flex-end' },
  actionBtn: { width: 34, height: 34, borderRadius: BorderRadius.sm, alignItems: 'center', justifyContent: 'center', borderWidth: 1 },
  editRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.xs },
  editInput: { height: 32, borderRadius: BorderRadius.sm, paddingHorizontal: Spacing.sm, fontSize: FontSize.sm, flex: 1 },
});

