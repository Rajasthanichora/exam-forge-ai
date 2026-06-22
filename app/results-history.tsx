/**
 * Results & History Screen
 * Performance Analytics for current section with real data
 * React Native / Expo SDK 56
 */
import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, ScrollView,
  TextInput, Alert, Share, Modal,
} from 'react-native';
import { useRouter } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Ionicons } from '@expo/vector-icons';
import { File, Paths, EncodingType } from 'expo-file-system';
import { shareAsync, isAvailableAsync } from 'expo-sharing';
import { useTheme } from '../lib/theme';
import { initializeData, getAllSections, getSection, getSectionStats, renameTestResult, deleteTestResult } from '../lib/section-store';
import { TestResult } from '../lib/types';
import { persistLog } from '../lib/logs';
import { WebView } from 'react-native-webview';

// --- Design Constants ---
const Spacing = { xs: 4, sm: 8, md: 12, lg: 16, xl: 20, xxl: 24, xxxl: 32 };
const FontSize = { xs: 10, sm: 12, md: 14, lg: 16, xl: 18, xxl: 22, xxxl: 28 };
const BorderRadius = { xs: 4, sm: 6, md: 8, lg: 12, xl: 16, xxl: 20, xxxl: 24, full: 999 };

export default function ResultsHistoryScreen() {
  const router = useRouter();
  const { isDark, colors: themeColors } = useTheme();
  const [searchQuery, setSearchQuery] = useState('');
  const [filterTab, setFilterTab] = useState<'all' | 'incorrect' | 'flagged'>('all');
  const [activeSectionId, setActiveSectionId] = useState<string | null>(null);
  const [testResults, setTestResults] = useState<TestResult[]>([]);
  const [sectionName, setSectionName] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [reportHtml, setReportHtml] = useState<string | null>(null);
  const [showReport, setShowReport] = useState(false);
  const [reportName, setReportName] = useState('');

  // Use HTML design colors for light mode
  const C = isDark ? themeColors : {
    background: '#F8FAFC',
    foreground: '#0F172A',
    primary: '#4F46E5',
    primaryForeground: '#FFFFFF',
    muted: '#F1F5F9',
    mutedForeground: '#64748B',
    card: '#FFFFFF',
    cardForeground: '#0F172A',
    border: '#E2E8F0',
    destructive: '#F43F5E',
    success: '#10B981',
    warning: '#F59E0B',
  } as any;

  useEffect(() => {
    (async () => {
      const data = await initializeData();
      const sid = data.activeSectionId || (data.sections.length > 0 ? data.sections[0].id : null);
      setActiveSectionId(sid);
      if (sid) {
        const section = getSection(sid);
        if (section) {
          setSectionName(section.name);
          setTestResults(section.testResults || []);
        }
      }
    })();
  }, []);

  const loadSectionData = useCallback(() => {
    if (!activeSectionId) return;
    const section = getSection(activeSectionId);
    if (section) {
      setSectionName(section.name);
      setTestResults(section.testResults || []);
    }
  }, [activeSectionId]);

  const totalTests = testResults.length;
  const avgScore = totalTests > 0
    ? Math.round(testResults.reduce((s, r) => s + (r.score / r.totalQuestions) * 100, 0) / totalTests)
    : 0;
  const totalQuestionsTracked = testResults.reduce((s, r) => s + r.totalQuestions, 0);
  const totalAttempts = testResults.reduce((s, r) => s + r.totalQuestions, 0);
  const totalCorrect = testResults.reduce((s, r) => s + r.score, 0);

  const getScoreColor = (pct: number) => {
    if (pct >= 80) return '#10B981';
    if (pct >= 60) return C.primary;
    if (pct >= 40) return C.warning;
    return C.destructive;
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


  // Log helper
  const logAction = (text: string, color?: string) => {
    persistLog('results-history', text, color);
  };
  const handleRenameTest = async (testId: string, newName: string) => {
    if (!activeSectionId) return;
    await renameTestResult(activeSectionId, testId, newName);
    setEditingId(null);
                                <Ionicons name="close" size={16} color="#64748B" />
    logAction('Test renamed: ' + newName, '#10B981');
  };


  const handleDeleteTest = (testId: string) => {
    Alert.alert('Delete Test?', 'This will permanently remove this test result.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete', style: 'destructive', onPress: async () => {
          if (!activeSectionId) return;
          await deleteTestResult(activeSectionId, testId);
          loadSectionData();
          logAction('Test deleted from history.', '#F43F5E');
        },
      },
    ]);
  };
  const [statusMsg, setStatusMsg] = useState<string | null>(null);

  const handleOpenReport = (test: TestResult) => {
    if (test.scoreReport) {
      setReportHtml(test.scoreReport);
      setReportName(test.name);
      setShowReport(true);
      logAction("Score report opened: " + test.name, "#6366F1");
    } else {
      Alert.alert("No Report", "This test does not have a saved score report.");
      logAction("Score report missing: " + test.name, "#F59E0B");
    }
  };

  const handleShareHtmlReport = async () => {
    if (!reportHtml) return;
    try {
      const safeName = reportName.replace(/[^a-zA-Z0-9]/g, "_");
      const fileName = "examforge-report-" + safeName + ".html";
      const reportFile = new File(Paths.cache, fileName);
      await reportFile.write(reportHtml);
      const fileUri = reportFile.uri;
      if (await isAvailableAsync()) {
        await shareAsync(fileUri, {
          mimeType: "text/html",
          dialogTitle: "Share ExamForge Score Report",
          UTI: "public.html",
        });
      } else {
        // Fallback: share as plain text
        await Share.share({
          message: reportHtml,
          title: "ExamForge Score Report - " + reportName,
        });
      }
      logAction("Score report shared: " + reportName, "#10B981");
    } catch (err: any) {
      const msg = err?.message || "Failed to share report";
      Alert.alert("Share Error", msg);
      logAction("Score report share failed: " + reportName, "#F43F5E");
    }
  };

  const handleRetakeTest = async (test: TestResult) => {
    setStatusMsg('Preparing retake...');
    try {
      // Store the test to retake in AsyncStorage before navigating back
      const retakeData = JSON.stringify({
        testId: test.id,
        sectionId: activeSectionId,
      });
      await AsyncStorage.setItem('examforge_retake_test', retakeData);
      await AsyncStorage.setItem('examforge_retake_pending', 'true');
      setStatusMsg(`Retaking: "${test.name}"`);
      // Use replace so the home screen can detect the retake data
      router.replace('/');
    } catch (err) {
      setStatusMsg(null);
      Alert.alert('Error', 'Failed to set up retake. Please try again.');
    }
  };

  const score = avgScore;

  const getScoreBadgeStyle = (color: 'emerald' | 'amber' | 'rose') => {
    if (color === 'emerald') return { bg: '#ECFDF5', border: '#A7F3D0', text: '#059669' };
    if (color === 'amber') return { bg: '#FFFBEB', border: '#FDE68A', text: '#D97706' };
    return { bg: '#FFF1F2', border: '#FECDD3', text: '#E11D48' };
  };

  const getHistoryRowScoreColor = (pct: number): 'emerald' | 'amber' | 'rose' => {
    if (pct >= 80) return 'emerald';
    if (pct >= 60) return 'amber';
    return 'rose';
  };

  const filteredResults = searchQuery
    ? testResults.filter(r =>
        r.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        r.config.difficulty.toLowerCase().includes(searchQuery.toLowerCase())
      )
    : testResults;

  const handleShareReport = useCallback(async () => {
    try {
      const summary = testResults.map((r, i) =>
        `Test ${i + 1}: "${r.name}" - ${r.score}/${r.totalQuestions} (${Math.round((r.score / r.totalQuestions) * 100)}%)`
      ).join('\n');
      await Share.share({
        message: `Exam Forge Report for "${sectionName}"\n\nAverage Score: ${avgScore}%\nTotal Tests: ${totalTests}\n\n${summary}`,
      });
      logAction('Test history shared for section: ' + sectionName, '#10B981');
    } catch {
      // User cancelled share
    }
  }, [testResults, sectionName, avgScore, totalTests]);

  return (
    <View style={[s.container, { backgroundColor: C.background }]}>
      {/* HEADER */}
      <View style={[s.header, { backgroundColor: C.card + 'CC', borderBottomColor: C.border }]}>
        <View style={s.headerLeft}>
          <TouchableOpacity onPress={() => router.back()} style={s.backBtn}>
            <Ionicons name="arrow-back" size={22} color={C.foreground} />
          </TouchableOpacity>
          <View>
            <Text style={[s.headerTitle, { color: C.foreground }]}>Performance Analytics</Text>
            <Text style={[s.headerSession, { color: C.mutedForeground }]}>
              Session: {sectionName || 'Current Section'}
            </Text>
          </View>
        </View>
        <View style={s.headerActions}>
          <TouchableOpacity style={[s.btnOutline, { borderColor: C.border }]} onPress={handleShareReport}>
            <Ionicons name="share-outline" size={14} color={'#64748B'} />
            <Text style={[s.btnOutlineText, { color: '#64748B' }]}>  Share</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[s.btnPrimary, { backgroundColor: C.primary }]} onPress={() => router.back()}>
            <Ionicons name="arrow-back" size={14} color={'#FFFFFF'} />
            <Text style={[s.btnPrimaryText, { color: '#FFFFFF' }]}>  Back</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* SCROLLABLE CONTENT */}
      <ScrollView style={s.scrollArea} contentContainerStyle={s.scrollInner}>
        {/* --- RESULTS OVERVIEW --- */}
        <View style={s.resultsGrid}>
          {/* --- STATS CARD --- */}
          <View style={[s.radialCard, { backgroundColor: C.card, borderColor: C.border }]}>
            {/* Score */}
            <View style={s.radialSvgContainer}>
              <View style={[s.radialOuterRing, { borderColor: C.muted }]}>
                <View style={[s.radialInnerRing, {
                  borderColor: C.primary,
                }]}>
                  <View style={{ alignItems: 'center' }}>
                    <Text style={[s.radialScore, { color: C.foreground }]}>{avgScore}%</Text>
                    <Text style={[s.radialScoreLabel, { color: C.mutedForeground }]}>Avg Score</Text>
                  </View>
                </View>
              </View>
            </View>

            <Text style={[s.radialTitle, { color: C.foreground }]}>
              {avgScore >= 80 ? 'Excellent Performance!' : avgScore >= 60 ? 'Good Progress!' : 'Keep Practicing!'}
            </Text>
            <Text style={[s.radialDesc, { color: '#64748B' }]}>
              {totalTests > 0
                ? `Across ${totalTests} test${totalTests !== 1 ? 's' : ''} in "${sectionName}"`
                : 'Complete your first test to see performance analytics.'}
            </Text>
          </View>

          {/* --- QUICK STATS GRID --- */}
          <View style={s.quickStatsGrid}>
            <View style={[s.statCard, { backgroundColor: C.card, borderColor: C.border }]}>
              <View style={s.statTop}>
                <View style={[s.statIcon, { backgroundColor: '#ECFDF5' }]}>
                  <Ionicons name="checkmark-circle" size={22} color="#059669" />
                </View>
              </View>
              <Text style={[s.statValue, { color: C.foreground }]}>{totalCorrect} / {totalAttempts}</Text>
              <Text style={[s.statLabel, { color: '#64748B' }]}>Correct Answers</Text>
            </View>

            <View style={[s.statCard, { backgroundColor: C.card, borderColor: C.border }]}>
              <View style={s.statTop}>
                <View style={[s.statIcon, { backgroundColor: '#EEF2FF' }]}>
                  <Ionicons name="bar-chart-outline" size={22} color={C.primary} />
                </View>
              </View>
              <Text style={[s.statValue, { color: C.foreground }]}>{totalQuestionsTracked}</Text>
              <Text style={[s.statLabel, { color: '#64748B' }]}>Questions Tracked</Text>
            </View>

            <View style={[s.statCard, { backgroundColor: C.card, borderColor: C.border }]}>
              <View style={s.statTop}>
                <View style={[s.statIcon, { backgroundColor: '#FFFBEB' }]}>
                  <Ionicons name="layers-outline" size={22} color="#D97706" />
                </View>
              </View>
              <Text style={[s.statValue, { color: C.foreground }]}>{totalTests}</Text>
              <Text style={[s.statLabel, { color: '#64748B' }]}>Total Tests</Text>
            </View>

            <View style={[s.statCard, { backgroundColor: C.card, borderColor: C.border }]}>
              <View style={s.statTop}>
                <View style={[s.statIcon, { backgroundColor: '#F8FAFC' }]}>
                  <Ionicons name="trophy-outline" size={22} color={'#94A3B8'} />
                </View>
              </View>
              <Text style={[s.statValue, { color: C.foreground }]}>
                {avgScore >= 90 ? 'Gold' : avgScore >= 70 ? 'Silver' : avgScore >= 50 ? 'Bronze' : 'Starter'}
              </Text>
              <Text style={[s.statLabel, { color: '#64748B' }]}>Badge Tier</Text>
            </View>
          </View>
        </View>

        {/* --- ATTEMPT HISTORY --- */}
        <View style={s.historyOuter}>
          <View style={s.historyHeader}>
            <Text style={[s.historyTitle, { color: C.foreground }]}>Test History</Text>
            <View style={[s.searchBox, { backgroundColor: C.card, borderColor: C.border }]}>
              <Ionicons name="search-outline" size={16} color={'#94A3B8'} />
              <TextInput
                style={[s.searchInput, { color: C.foreground }]}
                placeholder="Search past sessions..."
                placeholderTextColor="#94A3B8"
                value={searchQuery}
                onChangeText={setSearchQuery}
              />
            </View>
          </View>

          {filteredResults.length === 0 ? (
            <View style={[s.emptyState, { backgroundColor: C.card, borderColor: C.border }]}>
              <Ionicons name="bar-chart-outline" size={40} color={C.mutedForeground} style={{ opacity: 0.4 }} />
              <Text style={{ fontSize: FontSize.md, color: C.foreground, fontWeight: '600' }}>No test history yet</Text>
              <Text style={{ fontSize: FontSize.sm, color: C.mutedForeground, textAlign: 'center' }}>
                Complete your first test to see results here
              </Text>
            </View>
          ) : (
            <View style={{ gap: 12 }}>
              {filteredResults.map((result, i) => {
                const pct = Math.round((result.score / result.totalQuestions) * 100);
                const scoreColor = getScoreColor(pct);
                const scoreBg = scoreColor === '#10B981' ? '#ECFDF5' : scoreColor === C.primary ? '#EEF2FF' : scoreColor === C.warning ? '#FFFBEB' : '#FFF1F2';
                const scoreBorder = scoreColor === '#10B981' ? '#A7F3D0' : scoreColor === C.primary ? '#C7D2FE' : scoreColor === C.warning ? '#FDE68A' : '#FECDD3';
                return (
                  <View key={result.id} style={[s.tableCard, { backgroundColor: C.card, borderColor: C.border }]}>
                    <View style={{ padding: Spacing.md, gap: Spacing.sm }}>
                      {/* Name - mobile responsive */}
                      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', gap: Spacing.sm }}>
                        <View style={{ flex: 1, minWidth: 0 }}>
                          {editingId === result.id ? (
                            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                              <TextInput
                                style={[s.editInput, { borderColor: C.border, color: C.foreground, flex: 1 }]}
                                value={editName}
                                onChangeText={setEditName}
                                autoFocus
                                onSubmitEditing={() => {
                                  if (editName.trim()) { handleRenameTest(result.id, editName.trim()); }
                                }}
                              />
                              <TouchableOpacity onPress={() => setEditingId(null)}>
                                <Ionicons name="close" size={16} color="#64748B" />
                              </TouchableOpacity>
                            </View>
                          ) : (
                            <>
                              <Text style={[s.tdNameText, { color: C.foreground }]} numberOfLines={2}>{result.name}</Text>
                              <Text style={s.tdSubText}>{result.totalQuestions} Items • {result.config.language}</Text>
                            </>
                          )}
                        </View>
                      </View>

                      {/* Stats Row - mobile responsive with wrap */}
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, flexWrap: 'wrap' }}>
                        <View style={[s.scoreBadge, { backgroundColor: scoreBg, borderColor: scoreBorder }]}>
                          <Text style={[s.scoreBadgeText, { color: scoreColor }]}>{pct}%</Text>
                        </View>
                        <Text style={{ fontSize: 11, color: '#64748B' }}>{formatDate(result.date)}</Text>
                        <Text style={{ fontSize: 10, fontWeight: '600', color: '#94A3B8', textTransform: 'uppercase' }}>{result.config.difficulty}</Text>
                      </View>

                      {/* Action Buttons - always visible, scrollable row on small screens */}
                      <View style={{ flexDirection: 'row', gap: Spacing.sm }}>
                        {editingId !== result.id && (
                          <>
                            <TouchableOpacity style={[s.actionBtnSmall, { borderColor: C.border }]}
                              onPress={() => { setEditingId(result.id); setEditName(result.name); }}>
                              <Ionicons name="pencil-outline" size={12} color="#94A3B8" />
                              <Text style={{ fontSize: 10, color: '#94A3B8', marginLeft: 3 }}>Rename</Text>
                            </TouchableOpacity>
                            <TouchableOpacity style={[s.actionBtnSmall, { backgroundColor: C.primary, borderColor: C.primary }]}
                              onPress={() => handleRetakeTest(result)}>
                              <Ionicons name="refresh" size={12} color="#FFFFFF" />
                              <Text style={{ fontSize: 10, color: '#FFFFFF', marginLeft: 3 }}>Retake</Text>
                            </TouchableOpacity>
                            <TouchableOpacity style={[s.actionBtnSmall, { borderColor: '#C7D2FE' }]}
                              onPress={() => handleOpenReport(result)}>
                              <Ionicons name="document-text-outline" size={12} color="#6366F1" />
                              <Text style={{ fontSize: 10, color: '#6366F1', marginLeft: 3 }}>Report</Text>
                            </TouchableOpacity>
                            <TouchableOpacity style={[s.actionBtnSmall, { borderColor: '#FECDD3' }]}
                              onPress={() => handleDeleteTest(result.id)}>
                              <Ionicons name="trash-outline" size={12} color="#F43F5E" />
                              <Text style={{ fontSize: 10, color: '#F43F5E', marginLeft: 3 }}>Delete</Text>
                            </TouchableOpacity>
                          </>
                        )}
                      </View>
                    </View>
                  </View>
                );
              })}
            </View>
          )}
        </View>

        {/* Status message */}
        {statusMsg && (
          <View style={{ padding: Spacing.md, backgroundColor: '#EEF2FF', borderRadius: BorderRadius.md, borderWidth: 1, borderColor: '#C7D2FE' }}>
            <Text style={{ fontSize: FontSize.sm, color: '#4F46E5', fontWeight: '600' }}>{statusMsg}</Text>
          </View>
        )}

        {/* Bottom spacing */}
        <View style={{ height: 40 }} />
      
      {/* Report Modal - renders full HTML report via WebView */}
      <Modal visible={showReport} animationType="slide" transparent={false}>
        <View style={{ flex: 1, backgroundColor: C.background }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: C.border, backgroundColor: C.card }}>
            <TouchableOpacity onPress={() => setShowReport(false)} style={{ padding: 4 }}>
              <Ionicons name="close" size={24} color={C.foreground} />
            </TouchableOpacity>
            <Text style={{ fontSize: 16, fontWeight: '700', color: C.foreground, flex: 1, textAlign: 'center' }} numberOfLines={1}>{reportName}</Text>
            {reportHtml ? (
              <TouchableOpacity onPress={handleShareHtmlReport} style={{ padding: 8 }}>
                <Ionicons name="share-outline" size={22} color={C.primary} />
              </TouchableOpacity>
            ) : (
              <View style={{ width: 38 }} />
            )}
          </View>
          {reportHtml ? (
            <WebView
              source={{ html: reportHtml }}
              style={{ flex: 1 }}
              originWhitelist={['*']}
              javaScriptEnabled={false}
              scalesPageToFit={true}
            />
          ) : (
            <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
              <Text style={{ color: C.mutedForeground, textAlign: 'center' }}>No report data available.</Text>
            </View>
          )}
        </View>
      </Modal>
</ScrollView>
    </View>
  );
}

// --- Styles ---
const s = StyleSheet.create({
  container: { flex: 1 },
  header: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    minHeight: 72,
    flexWrap: 'wrap',
    gap: 8,
  },
  headerLeft: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  backBtn: { padding: 4 },
  headerTitle: { fontSize: 18, fontWeight: 'bold', letterSpacing: -0.3 },
  headerSession: { fontSize: 10, fontWeight: '700', letterSpacing: 1, marginTop: 2 },
  headerActions: { flexDirection: 'row', alignItems: 'center', gap: 12, flexWrap: 'wrap' },
  btnOutline: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 16, paddingVertical: 10,
    borderRadius: 12, borderWidth: 1,
  },
  btnOutlineText: { fontSize: 10, fontWeight: '700', letterSpacing: 1 },
  btnPrimary: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 24, paddingVertical: 10,
    borderRadius: 12,
  },
  btnPrimaryText: { fontSize: 10, fontWeight: '700', letterSpacing: 1 },
  scrollArea: { flex: 1 },
  scrollInner: { padding: 16, gap: 24 },
  resultsGrid: { gap: 24 },
  radialCard: {
    borderRadius: 20,
    borderWidth: 1,
    padding: 24,
    alignItems: 'center',
    gap: 16,
  },
  radialSvgContainer: {
    width: 160, height: 160,
    alignItems: 'center', justifyContent: 'center',
    position: 'relative',
    marginBottom: 8,
  },
  radialOuterRing: {
    width: 160, height: 160, borderRadius: 80, borderWidth: 8,
    alignItems: 'center', justifyContent: 'center',
  },
  radialInnerRing: {
    width: 144, height: 144, borderRadius: 72,
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 6,
  },
  radialScore: { fontSize: 36, fontWeight: '900', letterSpacing: -1 },
  radialScoreLabel: { fontSize: 10, fontWeight: '700', letterSpacing: 1, marginTop: 4 },
  radialTitle: { fontSize: 20, fontWeight: 'bold', marginBottom: -4 },
  radialDesc: { fontSize: 14, textAlign: 'center', lineHeight: 22 },
  quickStatsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  statCard: {
    borderRadius: 20,
    borderWidth: 1,
    padding: 16,
    gap: 4,
    width: '47%',
  },
  statTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  statIcon: {
    width: 48, height: 48,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  statValue: {
    fontSize: 24, fontWeight: '900',
    letterSpacing: -0.5,
  },
  statLabel: {
    fontSize: 10, fontWeight: '700',
    letterSpacing: 1, marginTop: 4,
    textTransform: 'uppercase',
  },
  historyOuter: { gap: 24, paddingTop: 40, borderTopWidth: 1, borderTopColor: '#E2E8F0' },
  historyHeader: {
    flexDirection: 'column',
    alignItems: 'stretch',
    gap: 12,
  },
  historyTitle: { fontSize: 20, fontWeight: 'bold' },
  searchBox: {
    flexDirection: 'row', alignItems: 'center',
    gap: 12,
    borderRadius: 12, borderWidth: 1,
    paddingHorizontal: 16,
    height: 44,
    flex: 1,
    minWidth: 160,
    maxWidth: 320,
  },
  searchInput: { flex: 1, fontSize: 14, height: '100%' },
  emptyState: {
    borderRadius: 16, borderWidth: 1, padding: 48,
    alignItems: 'center', gap: 12,
  },
  tableCard: { borderRadius: 20, borderWidth: 1, overflow: 'hidden', boxShadow: '0 2px 8px rgba(0,0,0,0.06)' },
  tableHead: {
    flexDirection: 'row',
    paddingVertical: 16,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
  },
  th: { fontSize: 10, fontWeight: '800', letterSpacing: 1, textTransform: 'uppercase' },
  thName: { flex: 2 },
  thDate: { flex: 1 },
  thScore: { flex: 1 },
  thDiff: { flex: 1 },
  thActions: { flex: 1, textAlign: 'right' },
  tableRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    gap: 8,
  },
  td: {},
  tdName: { flex: 2.5, gap: 2 },
  tdNameText: { fontSize: 14, fontWeight: '700' },
  tdSubText: { fontSize: 10, fontWeight: '700', letterSpacing: 1, color: '#94A3B8', textTransform: 'uppercase' },
  tdDateValue: { flex: 1, fontSize: 14, fontWeight: '700' },
  tdScore: { flex: 1, alignItems: 'center' },
  tdDiffValue: { flex: 1, fontSize: 10, fontWeight: '700', letterSpacing: 1, textTransform: 'uppercase' },
  tdActions: { flex: 1, flexDirection: 'row', justifyContent: 'flex-end', gap: 12 },
  scoreBadge: {
    paddingHorizontal: 12, paddingVertical: 4,
    borderRadius: 8, borderWidth: 1,
  },
  scoreBadgeText: { fontSize: 10, fontWeight: '800', letterSpacing: 1 },
  actionBtn: {
    width: 36, height: 36,
    borderRadius: 8,
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: '#FFFFFF',
    borderWidth: 1, borderColor: '#E2E8F0',
  },
  actionBtnPrimary: {
    width: 36, height: 36,
    borderRadius: 8,
    alignItems: 'center', justifyContent: 'center',
  },
  actionBtnSmall: {
    flexDirection: 'row', alignItems: 'center',
    paddingVertical: 4, paddingHorizontal: 6,
    borderRadius: 6, borderWidth: 1, gap: 2,
  },
  editInput: {
    height: 32, borderRadius: 6, paddingHorizontal: 8,
    fontSize: 14, fontWeight: '600', borderWidth: 1, flex: 1,
  },
});
