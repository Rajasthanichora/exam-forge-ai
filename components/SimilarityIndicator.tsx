import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { SimilarityReport } from '../lib/types';
import { useTheme, Spacing, BorderRadius, FontSize } from '../lib/theme';

interface Props {
  report: SimilarityReport;
}

export default function SimilarityIndicator({ report }: Props) {
  const { colors: C } = useTheme();
  const uniquePct = 100 - report.similarityPercentage;

  const getColor = () => {
    if (report.similarityPercentage <= 10) return '#10B981';
    if (report.similarityPercentage <= 30) return C.warning;
    return C.destructive;
  };

  const getStatus = () => {
    if (report.similarityPercentage <= 10) return 'Excellent! Most questions are unique.';
    if (report.similarityPercentage <= 30) return 'Good variety with some similar questions.';
    return 'High repetition detected. Consider adding more study material.';
  };

  const color = getColor();

  return (
    <View style={[styles.container, { backgroundColor: C.card, borderColor: C.border }]}>
      {/* Summary Stats Grid - matching HTML content similarity report */}
      <View style={styles.statsGrid}>
        <View style={[styles.statCard, { backgroundColor: C.card, borderColor: C.border }]}>
          <Text style={[styles.statLabel, { color: C.mutedForeground }]}>Total Items</Text>
          <View style={{ flexDirection: 'column', alignItems: 'flex-start', gap: 2 }}>
            <Text style={[styles.statValue, { color: C.foreground }]}>{report.totalNewQuestions}</Text>
            <Text style={{ fontSize: 10, fontWeight: '700', color: C.mutedForeground }}>Generated</Text>
          </View>
        </View>

        <View style={[styles.statCard, { backgroundColor: C.card, borderColor: C.border }]}>
          <View style={[styles.cornerIcon, { backgroundColor: '#10B981' + '10' }]}>
            <Ionicons name="checkmark-circle" size={16} color="#10B981" />
          </View>
          <Text style={[styles.statLabel, { color: C.mutedForeground }]}>Uniqueness</Text>
          <View style={{ flexDirection: 'column', alignItems: 'flex-start', gap: 2 }}>
            <Text style={[styles.statValue, { color: '#10B981' }]}>{uniquePct}%</Text>
            <Text style={{ fontSize: 10, fontWeight: '700', color: '#10B981' }}>High Quality</Text>
          </View>
        </View>

        <View style={[styles.statCard, { backgroundColor: C.card, borderColor: C.border }]}>
          <View style={[styles.cornerIcon, { backgroundColor: C.destructive + '10' }]}>
            <Ionicons name="alert-circle" size={16} color={C.destructive} />
          </View>
          <Text style={[styles.statLabel, { color: C.mutedForeground }]}>Redundant</Text>
          <View style={{ flexDirection: 'column', alignItems: 'flex-start', gap: 2 }}>
            <Text style={[styles.statValue, { color: C.destructive }]}>{report.similarQuestions}</Text>
            <Text style={{ fontSize: 10, fontWeight: '700', color: C.destructive }}>Duplicates</Text>
          </View>
        </View>

        <View style={[styles.statCard, { backgroundColor: C.card, borderColor: C.border }]}>
          <Text style={[styles.statLabel, { color: C.mutedForeground }]}>Avg. Overlap</Text>
          <View style={{ flexDirection: 'column', alignItems: 'flex-start', gap: 2 }}>
            <Text style={[styles.statValue, { color: C.primary }]}>{(report.similarityPercentage / 100).toFixed(2)}</Text>
            <Text style={{ fontSize: 10, fontWeight: '700', color: C.mutedForeground }}>
              {report.similarityPercentage <= 10 ? 'Low Conflict' : report.similarityPercentage <= 30 ? 'Moderate' : 'High'}
            </Text>
          </View>
        </View>
      </View>

      {/* Similarity bar */}
      <View style={[styles.similarityBar, { backgroundColor: C.muted }]}>
        <View style={[styles.similarityFill, { width: `${report.similarityPercentage}%`, backgroundColor: color }]} />
      </View>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
        <Text style={{ fontSize: FontSize.xs, color: C.mutedForeground }}>Similarity Rate</Text>
        <Text style={{ fontSize: FontSize.xs, color: C.mutedForeground }}>{report.similarityPercentage}%</Text>
      </View>

      {/* Detail Cards */}
      {report.flaggedQuestions.length > 0 && (
        <View style={{ gap: Spacing.md, marginTop: Spacing.sm }}>
          <View style={[styles.detailHeader, { borderBottomColor: C.border }]}>
            <Text style={[styles.detailTitle, { color: C.foreground }]}>Overlap Details</Text>
            <View style={[styles.filterBtn, { backgroundColor: C.card, borderColor: C.border }]}>
              <Ionicons name="filter" size={12} color={C.mutedForeground} />
              <Text style={{ fontSize: 10, fontWeight: '700', color: C.mutedForeground }}>  All Scores</Text>
            </View>
          </View>

          {report.flaggedQuestions.slice(0, 10).map((item, i) => {
            const isHigh = item.similarity >= 0.7;
            const isMedium = item.similarity >= 0.4;
            const isLow = item.similarity < 0.4;
            const scoreColor = isHigh ? C.destructive : isMedium ? C.warning : '#10B981';

            return (
              <View key={i} style={[styles.overlapCard, {
                backgroundColor: isHigh ? C.destructive + '06' : C.card,
                borderColor: isHigh ? C.destructive + '30' : isMedium ? C.warning + '30' : '#10B981' + '30',
              }]}>
                <View style={{ flex: 1, gap: Spacing.sm }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: Spacing.sm }}>
                    <View style={[styles.overlapBadge, { backgroundColor: scoreColor }]}>
                      <Text style={styles.overlapBadgeText}>
                        {isHigh ? 'Action Required' : isMedium ? 'Partial Overlap' : 'Unique Item'}
                      </Text>
                    </View>
                    <Text style={{ fontSize: 10, fontWeight: '700', color: C.mutedForeground }}>
                      Item #{1000 + i + 1}
                    </Text>
                  </View>
                  <Text style={[styles.overlapQuestion, { color: C.foreground }]} numberOfLines={2} ellipsizeMode="tail">
                    {item.newQuestion}
                  </Text>
                  <Text style={{ fontSize: 10, fontWeight: '700', color: C.mutedForeground }}>
                    <Ionicons name="document-text" size={12} color={C.mutedForeground} />  Source: {item.similarTo.length > 40 ? item.similarTo.slice(0, 40) + '...' : item.similarTo}
                  </Text>
                </View>

                <View style={[styles.overlapScoreBox, { backgroundColor: C.card, borderColor: scoreColor + '30' }]}>
                  <Text style={[styles.overlapScoreLabel, { color: scoreColor }]}>Overlap Score</Text>
                  <Text style={[styles.overlapScoreValue, { color: scoreColor }]}>
                    {item.similarity.toFixed(2)}
                  </Text>
                  <View style={[styles.overlapBarBg, { backgroundColor: C.muted }]}>
                    <View style={[styles.overlapBar, {
                      width: `${item.similarity * 100}%`,
                      backgroundColor: scoreColor,
                    }]} />
                  </View>
                  {isHigh && (
                    <View style={{ flexDirection: 'row', gap: Spacing.xs, marginTop: Spacing.xs }}>
                      <TouchableOpacity style={[styles.overlapAction, { borderColor: C.destructive + '30' }]}>
                        <Text style={{ fontSize: 9, fontWeight: '800', color: C.destructive }}>DISCARD</Text>
                      </TouchableOpacity>
                      <TouchableOpacity style={[styles.overlapAction, { borderColor: C.border }]}>
                        <Text style={{ fontSize: 9, fontWeight: '800', color: C.mutedForeground }}>RE-ROLL</Text>
                      </TouchableOpacity>
                    </View>
                  )}
                </View>
              </View>
            );
          })}

          {report.flaggedQuestions.length > 10 && (
            <View style={{ alignItems: 'center', paddingVertical: Spacing.md }}>
              <Text style={{ fontSize: 10, fontWeight: '700', color: C.mutedForeground }}>
                Showing 10 of {report.flaggedQuestions.length} results
              </Text>
              <TouchableOpacity style={[styles.loadMoreBtn, { backgroundColor: C.muted }]}>
                <Ionicons name="refresh" size={14} color={C.foreground} />
                <Text style={{ fontSize: 11, fontWeight: '600', color: C.foreground }}>  Load Detailed Report</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { borderRadius: BorderRadius.lg, borderWidth: 1, padding: Spacing.md, gap: Spacing.md },
  statsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm },
  statCard: {
    flex: 1, minWidth: '45%', padding: Spacing.md, borderRadius: BorderRadius.xl, borderWidth: 1,
    position: 'relative', gap: Spacing.xs,
  },
  statLabel: { fontSize: 10, fontWeight: '700', letterSpacing: 1 },
  statValue: { fontSize: 28, fontWeight: '900', letterSpacing: -0.5 },
  cornerIcon: { position: 'absolute', top: 0, right: 0, width: 60, height: 60, borderBottomLeftRadius: 30, alignItems: 'flex-end', justifyContent: 'center', padding: 12 },
  similarityBar: { height: 10, borderRadius: 5, overflow: 'hidden' },
  similarityFill: { height: '100%', borderRadius: 5 },
  detailHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingBottom: Spacing.md, borderBottomWidth: 1 },
  detailTitle: { fontSize: FontSize.xl, fontWeight: 'bold' },
  filterBtn: { flexDirection: 'row', alignItems: 'center', paddingVertical: Spacing.xs, paddingHorizontal: Spacing.md, borderRadius: Spacing.sm, borderWidth: 1 },
  overlapCard: {
    padding: Spacing.md, borderRadius: BorderRadius.xl, borderWidth: 1,
    flexDirection: 'row', gap: Spacing.md, alignItems: 'flex-start', flexWrap: 'wrap',
  },
  overlapBadge: { paddingHorizontal: Spacing.sm, paddingVertical: 3, borderRadius: Spacing.xs },
  overlapBadgeText: { fontSize: 9, fontWeight: '800', color: '#FFFFFF', letterSpacing: 0.5 },
  overlapQuestion: { fontSize: FontSize.md, fontWeight: '600', lineHeight: 20 },
  overlapScoreBox: {
    padding: Spacing.md, borderRadius: BorderRadius.lg, borderWidth: 1,
    minWidth: 120, gap: 4,
  },
  overlapScoreLabel: { fontSize: 9, fontWeight: '800', letterSpacing: 0.5 },
  overlapScoreValue: { fontSize: 18, fontWeight: '900' },
  overlapBarBg: { height: 10, borderRadius: 5, overflow: 'hidden' },
  overlapBar: { height: '100%', borderRadius: 5 },
  overlapAction: { flex: 1, paddingVertical: Spacing.xs, borderRadius: Spacing.xs, borderWidth: 1, alignItems: 'center' },
  loadMoreBtn: { flexDirection: 'row', alignItems: 'center', gap: Spacing.xs, paddingVertical: Spacing.md, paddingHorizontal: Spacing.lg, borderRadius: Spacing.sm, marginTop: Spacing.sm },
});
