import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView, Alert } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useTheme, FontSize, Spacing, BorderRadius } from '../lib/theme';
import { getAllSections, deleteTestResult } from '../lib/section-store';
import { TestResult } from '../lib/types';

export default function ClearTestHistoryScreen() {
  const router = useRouter();
  const { colors: C } = useTheme();
  const [testHistory, setTestHistory] = useState<(TestResult & { sectionId: string; sectionName: string })[]>([]);

  const loadHistory = () => {
    const sections = getAllSections();
    const allTests: (TestResult & { sectionId: string; sectionName: string })[] = [];
    for (const section of sections) {
      for (const test of section.testResults) {
        allTests.push({ ...test, sectionId: section.id, sectionName: section.name });
      }
    }
    allTests.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    setTestHistory(allTests);
  };

  useEffect(() => {
    loadHistory();
  }, []);

  const handleDeleteTest = (testId: string, sectionId: string) => {
    Alert.alert('Delete Test?', 'This will permanently remove this test result.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete', style: 'destructive', onPress: async () => {
          await deleteTestResult(sectionId, testId);
          loadHistory();
        },
      },
    ]);
  };

  const handleClearAll = () => {
    Alert.alert('Clear All History?', 'This will permanently delete ALL test results across all sections.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Clear All', style: 'destructive', onPress: async () => {
          for (const test of testHistory) {
            await deleteTestResult(test.sectionId, test.id);
          }
          loadHistory();
        },
      },
    ]);
  };

  const formatDate = (dateStr: string) => {
    try {
      return new Date(dateStr).toLocaleDateString('en-US', {
        month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit',
      });
    } catch { return dateStr; }
  };

  return (
    <View style={[styles.container, { backgroundColor: C.background }]}>
      {/* Header */}
      <View style={[styles.header, { backgroundColor: C.card, borderBottomColor: C.border }]}>
        <View style={styles.headerLeft}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
            <Ionicons name="arrow-back" size={22} color={C.foreground} />
          </TouchableOpacity>
          <View style={[styles.logo, { backgroundColor: C.destructive }]}>
            <Ionicons name="trash-outline" size={18} color={C.primaryForeground} />
          </View>
          <View>
            <Text style={[styles.title, { color: C.foreground }]}>Clear Test History</Text>
            <Text style={[styles.subtitle, { color: C.mutedForeground }]}>
              {testHistory.length} test{testHistory.length !== 1 ? 's' : ''} found
            </Text>
          </View>
        </View>
        {testHistory.length >= 0 && (
          <TouchableOpacity
            disabled={testHistory.length === 0}
            style={[styles.clearAllBtn, { backgroundColor: C.destructive + '15', borderColor: C.destructive + '30', opacity: testHistory.length === 0 ? 0.5 : 1 }]}
            onPress={handleClearAll}>
            <Ionicons name="trash-outline" size={14} color={C.destructive} />
            <Text style={[styles.clearAllText, { color: C.destructive }]}>  Clear All</Text>
          </TouchableOpacity>
        )}
      </View>

      <ScrollView style={styles.content} contentContainerStyle={styles.contentInner}>
        {testHistory.length === 0 ? (
          <View style={[styles.emptyState, { backgroundColor: C.card, borderColor: C.border }]}>
            <View style={[styles.emptyIcon, { backgroundColor: C.muted }]}>
              <Ionicons name="checkmark-circle-outline" size={48} color={C.mutedForeground} />
            </View>
            <Text style={[styles.emptyTitle, { color: C.foreground }]}>No Test History</Text>
            <Text style={[styles.emptyDesc, { color: C.mutedForeground }]}>
              All clear! There are no test results to delete.
            </Text>
          </View>
        ) : (
          <View style={{ gap: Spacing.md }}>
            <Text style={[styles.sectionLabel, { color: C.mutedForeground }]}>
              Tap the delete icon next to a test to remove it permanently
            </Text>
            {testHistory.map(test => {
              const pct = Math.round((test.score / test.totalQuestions) * 100);
              return (
                <View key={test.id} style={[styles.testCard, { backgroundColor: C.card, borderColor: C.border }]}>
                  <View style={styles.testInfo}>
                    <Text style={[styles.testName, { color: C.foreground }]} numberOfLines={2}>{test.name}</Text>
                    <Text style={[styles.testMeta, { color: C.mutedForeground }]} numberOfLines={1}>
                      {test.sectionName} â€¢ {formatDate(test.date)}
                    </Text>
                    <Text style={[styles.testScore, { color: C.primary }]}>
                      {test.score}/{test.totalQuestions} ({pct}%)
                    </Text>
                  </View>
                  <TouchableOpacity
                    style={[styles.deleteBtn, { backgroundColor: C.destructive + '15', borderColor: C.destructive + '30' }]}
                    onPress={() => handleDeleteTest(test.id, test.sectionId)}>
                    <Ionicons name="trash-outline" size={18} color={C.destructive} />
                  </TouchableOpacity>
                </View>
              );
            })}
          </View>
        )}

        <View style={{ height: 40 }} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    borderBottomWidth: 1, paddingTop: Spacing.lg, paddingBottom: Spacing.md,
    paddingHorizontal: Spacing.md, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: Spacing.sm,
  },
  headerLeft: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md },
  backBtn: { padding: Spacing.xs },
  logo: {
    width: 36, height: 36, borderRadius: BorderRadius.md,
    alignItems: 'center', justifyContent: 'center',
  },
  title: { fontSize: FontSize.lg, fontWeight: 'bold' },
  subtitle: { fontSize: FontSize.xs, marginTop: 1 },
  clearAllBtn: {
    flexDirection: 'row', alignItems: 'center',
    paddingVertical: Spacing.sm, paddingHorizontal: Spacing.lg,
    borderRadius: BorderRadius.lg, borderWidth: 1,
  },
  clearAllText: { fontSize: FontSize.sm, fontWeight: '700' },
  content: { flex: 1 },
  contentInner: { padding: Spacing.md, gap: Spacing.md, paddingBottom: Spacing.xxxl * 2 },
  sectionLabel: { fontSize: FontSize.sm, textAlign: 'center' },
  emptyState: {
    borderRadius: BorderRadius.xl, borderWidth: 1, padding: Spacing.xxxl * 2,
    alignItems: 'center', gap: Spacing.md,
  },
  emptyIcon: { width: 80, height: 80, borderRadius: 40, alignItems: 'center', justifyContent: 'center' },
  emptyTitle: { fontSize: FontSize.xl, fontWeight: 'bold' },
  emptyDesc: { fontSize: FontSize.sm, textAlign: 'center', lineHeight: 20 },
  testCard: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    borderRadius: BorderRadius.lg, borderWidth: 1, padding: Spacing.lg, gap: Spacing.md,
  },
  testInfo: { flex: 1, gap: 4 },
  testName: { fontSize: FontSize.md, fontWeight: '600' },
  testMeta: { fontSize: FontSize.xs },
  testScore: { fontSize: FontSize.sm, fontWeight: '700' },
  deleteBtn: {
    width: 44, height: 44, borderRadius: BorderRadius.md,
    alignItems: 'center', justifyContent: 'center', borderWidth: 1,
  },
});
