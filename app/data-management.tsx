import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Alert,
  ActivityIndicator,
  Platform,
  LayoutAnimation,
  UIManager,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as DocumentPicker from 'expo-document-picker';
import * as Sharing from 'expo-sharing';
import { Paths, File } from 'expo-file-system';
import { useTheme, FontSize, Spacing, BorderRadius } from '../lib/theme';
import {
  getStorageBreakdown,
  collectAllBackupData,
  serializeBackup,
  generateBackupFilename,
  parseBackup,
  restoreFromBackup,
  formatBytes,
  StorageCategoryInfo,
  StorageItemInfo,
  StorageBreakdown,
} from '../lib/backup';
import { getItem } from '../lib/storage';
import { persistLog } from '../lib/logs';

if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

type TabType = 'storage' | 'backup';

interface ExpandedState {
  key: string;
  content: string | null;
  loading: boolean;
}

function formatStoredContent(raw: string): { lines: { indent: number; text: string; color: string }[] } {
  const lines: { indent: number; text: string; color: string }[] = [];
  try {
    const parsed = JSON.parse(raw);
    const pretty = JSON.stringify(parsed, null, 2);
    const textLines = pretty.split('\n');
    for (const line of textLines) {
      const indent = line.search(/\S/);
      if (indent < 0) continue;
      const trimmed = line.trimEnd();
      let color = '#E2E8F0';
      const ts = line.trimStart();
      if (ts.startsWith('{') || ts.startsWith('"') || /^[}\]]/.test(ts)) {
        color = '#93C5FD';
      } else if (/:\s*"/.test(line)) {
        color = '#FBBF24';
      } else if (/:\s*\d/.test(line)) {
        color = '#34D399';
      } else if (/:\s*(true|false|null)/.test(line)) {
        color = '#F472B6';
      }
      lines.push({ indent, text: trimmed, color });
    }
  } catch {
    const textLines = raw.split('\n');
    for (const line of textLines) {
      const trimmed = line.trimEnd();
      let color = '#E2E8F0';
      if (/^[A-Z_]+:/.test(trimmed)) color = '#FBBF24';
      else if (/^https?:\/\//.test(trimmed)) color = '#93C5FD';
      lines.push({ indent: 0, text: trimmed, color });
    }
  }
  return { lines };
}

export default function DataManagementScreen() {
  const router = useRouter();
  const { isDark, colors } = useTheme();
  const C = colors;

  const [activeTab, setActiveTab] = useState<TabType>('storage');
  const [breakdown, setBreakdown] = useState<StorageBreakdown | null>(null);
  const [loading, setLoading] = useState(true);
  const [backingUp, setBackingUp] = useState(false);
  const [restoring, setRestoring] = useState(false);
  const [statusMsg, setStatusMsg] = useState<{ text: string; color: string; icon: string } | null>(null);
  const [expanded, setExpanded] = useState<ExpandedState>({ key: '', content: null, loading: false });

  const catColor = (cat: string): string => {
    const map: Record<string, string> = {
      app_data: '#4F46E5', api_keys: '#F43F5E', ai_settings: '#10B981',
      conversations: '#F59E0B', logs: '#64748B', theme: '#8B5CF6', other: '#6B7280',
    };
    return map[cat] || C.primary;
  };

  const loadBreakdown = useCallback(async () => {
    setLoading(true);
    try {
      const result = await getStorageBreakdown();
      setBreakdown(result);
    } catch (e) {
      console.error('Failed to load storage breakdown:', e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadBreakdown(); }, [loadBreakdown]);

  const handleItemPress = useCallback(async (item: StorageItemInfo) => {
    if (expanded.key === item.key) {
      LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
      setExpanded({ key: '', content: null, loading: false });
      return;
    }
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setExpanded({ key: item.key, content: null, loading: true });
    try {
      const raw = await getItem(item.key);
      LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
      setExpanded({ key: item.key, content: raw ?? '(empty)', loading: false });
    } catch {
      LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
      setExpanded({ key: item.key, content: '(error reading data)', loading: false });
    }
  }, [expanded.key]);

  const handleShareBackup = async () => {
    try {
      setBackingUp(true);
      setStatusMsg(null);
      const backup = await collectAllBackupData();
      const jsonStr = serializeBackup(backup);
      const filename = generateBackupFilename();
      const file = new File(Paths.cache, filename);
      await file.write(jsonStr);
      const isAvailable = await Sharing.isAvailableAsync();
      if (!isAvailable) {
        Alert.alert('Sharing Unavailable', 'Sharing is not available on this device.');
        setBackingUp(false);
        return;
      }
      await Sharing.shareAsync(file.uri, { mimeType: 'application/json', dialogTitle: 'Share ExamForge Backup' });
      persistLog('data-management', 'Backup shared: ' + filename, '#10B981');
      setStatusMsg({ text: 'Backup shared successfully!', color: '#10B981', icon: 'checkmark-circle' });
    } catch (e: any) {
      if (e?.message !== 'User did not share') {
        console.error('Share backup error:', e);
        Alert.alert('Backup Failed', 'Could not create or share the backup file.');
        persistLog('data-management', 'Backup share failed', '#F43F5E');
      }
    } finally { setBackingUp(false); }
  };

  const handleSaveBackup = async () => {
    try {
      setBackingUp(true);
      setStatusMsg(null);
      const backup = await collectAllBackupData();
      const jsonStr = serializeBackup(backup);
      const filename = generateBackupFilename();
      const file = new File(Paths.document, filename);
      await file.write(jsonStr);
      persistLog('data-management', 'Backup saved: ' + filename, '#10B981');
      setStatusMsg({ text: 'Backup saved to Documents/' + filename, color: '#10B981', icon: 'checkmark-circle' });
    } catch (e) {
      console.error('Save backup error:', e);
      Alert.alert('Save Failed', 'Could not save the backup file.');
      persistLog('data-management', 'Backup save failed', '#F43F5E');
    } finally { setBackingUp(false); }
  };

  const handleRestoreBackup = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({ type: 'application/json', copyToCacheDirectory: true });
      if (result.canceled || !result.assets || result.assets.length === 0) return;
      setRestoring(true);
      setStatusMsg(null);
      const asset = result.assets[0];
      const file = new File(asset.uri);
      const content = await file.text();
      const backup = parseBackup(content);
      Alert.alert(
        'Confirm Restore',
        'This will replace ALL current app data with the data from the backup file.\n\nBackup created: ' + new Date(backup.createdAt).toLocaleString() + '\n\nAre you sure you want to continue?',
        [
          { text: 'Cancel', style: 'cancel', onPress: () => setRestoring(false) },
          {
            text: 'Restore', style: 'destructive',
            onPress: async () => {
              try {
                const { restored, failed } = await restoreFromBackup(backup);
                setExpanded({ key: '', content: null, loading: false });
                await loadBreakdown();
                if (failed === 0) {
                  setStatusMsg({ text: 'Restore complete! ' + restored + ' items restored.', color: '#10B981', icon: 'checkmark-circle' });
                  persistLog('data-management', 'Backup restored: ' + restored + ' items', '#10B981');
                } else {
                  setStatusMsg({ text: 'Restore finished with ' + failed + ' failed items. ' + restored + ' restored.', color: '#F59E0B', icon: 'warning' });
                  persistLog('data-management', 'Backup restore: ' + restored + ' OK, ' + failed + ' failed', '#F59E0B');
                }
              } catch (e) {
                console.error('Restore execution error:', e);
                Alert.alert('Restore Failed', 'Could not complete the restore process.');
                persistLog('data-management', 'Backup restore failed', '#F43F5E');
              } finally { setRestoring(false); }
            },
          },
        ]
      );
    } catch (e: any) {
      if (e?.message?.includes('Invalid backup')) Alert.alert('Invalid File', e.message);
      else { console.error('Restore error:', e); Alert.alert('Restore Failed', 'Could not read or process the backup file.'); }
      setRestoring(false);
    }
  };

  const renderFormattedContent = (raw: string) => {
    const { lines } = formatStoredContent(raw);
    return lines.map((line, idx) => (
      <Text key={idx} style={{ marginLeft: line.indent * 12 }}>
        <Text style={{ color: line.color, fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace', fontSize: 11 }}>
          {line.text}{'\n'}
        </Text>
      </Text>
    ));
  };

  const renderStorageTab = () => {
    if (loading) {
      return (
        <View style={[styles.centerContent, { paddingVertical: 60 }]}>
          <ActivityIndicator size="large" color={C.primary} />
          <Text style={[styles.loadingText, { color: C.mutedForeground }]}>Analyzing storage...</Text>
        </View>
      );
    }
    if (!breakdown) {
      return (
        <View style={[styles.centerContent, { paddingVertical: 60 }]}>
          <Ionicons name="cloud-offline-outline" size={48} color={C.mutedForeground} />
          <Text style={[styles.loadingText, { color: C.mutedForeground }]}>Could not load storage data</Text>
          <TouchableOpacity style={[styles.retryBtn, { backgroundColor: C.primary }]} onPress={loadBreakdown}>
            <Text style={[styles.retryBtnText, { color: C.primaryForeground }]}>Retry</Text>
          </TouchableOpacity>
        </View>
      );
    }
    return (
      <View style={{ gap: Spacing.md }}>
        {breakdown.categories.map((cat) => (
          <View key={cat.category} style={[styles.categoryCard, { backgroundColor: C.card, borderColor: C.border }]}>
            <View style={[styles.categoryHeader, { borderBottomColor: cat.color }]}>
              <View style={[styles.categoryDot, { backgroundColor: cat.color }]} />
              <Text style={[styles.categoryTitle, { color: C.foreground }]}>{cat.label}</Text>
              <Text style={[styles.categoryTotal, { color: cat.color }]}>{cat.totalFormatted}</Text>
            </View>
            {cat.items.map((item) => {
              const isExpanded = expanded.key === item.key;
              return (
                <View key={item.key}>
                  <TouchableOpacity
                    style={[styles.itemRow, { borderTopColor: C.border }, isExpanded && { backgroundColor: cat.color + '12' }]}
                    onPress={() => handleItemPress(item)}
                    activeOpacity={0.6}
                  >
                    <View style={styles.itemInfo}>
                      <Text style={[styles.itemLabel, { color: item.sizeBytes === 0 ? C.mutedForeground : C.foreground }]} numberOfLines={1}>
                        {item.label}
                      </Text>
                    </View>
                    <View style={styles.itemRight}>
                      <Text style={[styles.itemSize, { color: cat.color }]}>
                        {item.sizeBytes === 0 ? 'empty' : item.sizeFormatted}
                      </Text>
                      <Ionicons name={isExpanded ? 'chevron-up' : 'chevron-down'} size={14} color={C.mutedForeground} style={{ marginLeft: 6 }} />
                    </View>
                  </TouchableOpacity>
                  {isExpanded && (
                    <View style={[styles.detailBox, { backgroundColor: cat.color + '06', borderLeftColor: cat.color, borderTopColor: C.border }]}>
                      <View style={styles.detailHeader}>
                        <View style={[styles.detailDot, { backgroundColor: cat.color }]} />
                        <Text style={[styles.detailHeaderText, { color: cat.color }]}>Stored Content</Text>
                        <TouchableOpacity onPress={() => { LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut); setExpanded({ key: '', content: null, loading: false }); }}>
                          <Ionicons name="close-circle" size={18} color={C.mutedForeground} />
                        </TouchableOpacity>
                      </View>
                      {expanded.loading ? (
                        <View style={styles.detailLoading}>
                          <ActivityIndicator size="small" color={cat.color} />
                          <Text style={[styles.detailLoadingText, { color: C.mutedForeground }]}>Loading...</Text>
                        </View>
                      ) : (
                        <ScrollView style={[styles.detailScroll, { backgroundColor: isDark ? '#0A0A0B' : '#FCFCFD' }]} nestedScrollEnabled showsVerticalScrollIndicator={true}>
                          <Text style={styles.detailMono}>{renderFormattedContent(expanded.content || '')}</Text>
                        </ScrollView>
                      )}
                      <View style={[styles.detailFooter, { borderTopColor: C.border }]}>
                        <Text style={[styles.detailFooterText, { color: C.mutedForeground }]}>
                          {expanded.content ? expanded.content.length + ' chars' : ''}
                        </Text>
                      </View>
                    </View>
                  )}
                </View>
              );
            })}
            {cat.items.filter((i) => i.sizeBytes > 0).length === 0 && (
              <View style={[styles.emptyRow, { borderTopColor: C.border }]}>
                <Text style={[styles.emptyText, { color: C.mutedForeground }]}>No data stored</Text>
              </View>
            )}
          </View>
        ))}
        <View style={[styles.totalCard, { backgroundColor: C.primary + '12', borderColor: C.primary + '30' }]}>
          <Ionicons name="server-outline" size={22} color={C.primary} />
          <Text style={[styles.totalLabel, { color: C.foreground }]}>Total Storage Used</Text>
          <Text style={[styles.totalValue, { color: C.primary }]}>{breakdown.totalFormatted}</Text>
        </View>
        <Text style={[styles.refreshHint, { color: C.mutedForeground }]}>Tap any item to view its stored content</Text>
      </View>
    );
  };

  const renderBackupTab = () => {
    return (
      <View style={{ gap: Spacing.lg }}>
        {statusMsg && (
          <View style={[styles.statusCard, { backgroundColor: statusMsg.color + '15', borderColor: statusMsg.color + '30' }]}>
            <Ionicons name={statusMsg.icon as any} size={20} color={statusMsg.color} />
            <Text style={[styles.statusText, { color: statusMsg.color }]}>{statusMsg.text}</Text>
            <TouchableOpacity onPress={() => setStatusMsg(null)}><Ionicons name="close" size={18} color={statusMsg.color} /></TouchableOpacity>
          </View>
        )}
        <View style={[styles.sectionCard, { backgroundColor: C.card, borderColor: C.border }]}>
          <View style={[styles.sectionCardHeader, { borderBottomColor: C.border }]}>
            <View style={[styles.iconBoxSm, { backgroundColor: '#10B981' + '15' }]}>
              <Ionicons name="cloud-upload-outline" size={18} color="#10B981" />
            </View>
            <Text style={[styles.sectionCardTitle, { color: C.foreground }]}>Backup</Text>
          </View>
          <Text style={[styles.sectionDesc, { color: C.mutedForeground }]}>Create a backup of all your app data, settings, and preferences. You can share it or save it locally.</Text>
          <View style={styles.backupActions}>
            <TouchableOpacity style={[styles.actionBtn, { backgroundColor: '#10B981', opacity: backingUp ? 0.6 : 1 }]} onPress={handleShareBackup} disabled={backingUp}>
              {backingUp ? <ActivityIndicator size="small" color="#FFFFFF" /> : <Ionicons name="share-outline" size={18} color="#FFFFFF" />}
              <Text style={styles.actionBtnText}>Share</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.actionBtn, { backgroundColor: '#4F46E5', opacity: backingUp ? 0.6 : 1 }]} onPress={handleSaveBackup} disabled={backingUp}>
              {backingUp ? <ActivityIndicator size="small" color="#FFFFFF" /> : <Ionicons name="download-outline" size={18} color="#FFFFFF" />}
              <Text style={styles.actionBtnText}>Save</Text>
            </TouchableOpacity>
          </View>
        </View>
        <View style={[styles.sectionCard, { backgroundColor: C.card, borderColor: C.border }]}>
          <View style={[styles.sectionCardHeader, { borderBottomColor: C.border }]}>
            <View style={[styles.iconBoxSm, { backgroundColor: '#F59E0B' + '15' }]}>
              <Ionicons name="cloud-download-outline" size={18} color="#F59E0B" />
            </View>
            <Text style={[styles.sectionCardTitle, { color: C.foreground }]}>Restore</Text>
          </View>
          <Text style={[styles.sectionDesc, { color: C.mutedForeground }]}>Import a previously saved backup file to restore your data. This will replace all current data.</Text>
          <TouchableOpacity style={[styles.restoreBtn, { backgroundColor: '#F59E0B', opacity: restoring ? 0.6 : 1 }]} onPress={handleRestoreBackup} disabled={restoring}>
            {restoring ? <ActivityIndicator size="small" color="#FFFFFF" /> : <Ionicons name="folder-open-outline" size={18} color="#FFFFFF" />}
            <Text style={styles.actionBtnText}>Import Backup File</Text>
          </TouchableOpacity>
        </View>
        <View style={[styles.infoCard, { backgroundColor: C.muted, borderColor: C.border }]}>
          <Ionicons name="information-circle-outline" size={18} color={C.mutedForeground} />
          <Text style={[styles.infoText, { color: C.mutedForeground }]}>Backups include all app data, settings, API keys, conversations, and preferences. The file is a standard JSON that can be shared across devices.</Text>
        </View>
      </View>
    );
  };

  return (
    <View style={[styles.container, { backgroundColor: C.background }]}>
      <View style={[styles.header, { backgroundColor: C.card, borderBottomColor: C.border }]}>
        <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={24} color={C.foreground} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: C.foreground }]}>Data Management</Text>
        <TouchableOpacity style={styles.refreshBtn} onPress={loadBreakdown}>
          <Ionicons name="refresh-outline" size={22} color={C.primary} />
        </TouchableOpacity>
      </View>
      <View style={[styles.tabBar, { backgroundColor: C.card, borderBottomColor: C.border }]}>
        <TouchableOpacity style={[styles.tab, activeTab === 'storage' && { borderBottomColor: C.primary, borderBottomWidth: 2 }]} onPress={() => setActiveTab('storage')}>
          <Ionicons name="server-outline" size={18} color={activeTab === 'storage' ? C.primary : C.mutedForeground} />
          <Text style={[styles.tabText, { color: activeTab === 'storage' ? C.primary : C.mutedForeground }]}>Storage</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[styles.tab, activeTab === 'backup' && { borderBottomColor: C.primary, borderBottomWidth: 2 }]} onPress={() => setActiveTab('backup')}>
          <Ionicons name="cloud-outline" size={18} color={activeTab === 'backup' ? C.primary : C.mutedForeground} />
          <Text style={[styles.tabText, { color: activeTab === 'backup' ? C.primary : C.mutedForeground }]}>Backup & Restore</Text>
        </TouchableOpacity>
      </View>
      <ScrollView style={styles.scrollArea} contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {activeTab === 'storage' ? renderStorageTab() : renderBackupTab()}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: Spacing.lg, paddingTop: Platform.OS === 'ios' ? 56 : Spacing.xxxl,
    paddingBottom: Spacing.md, borderBottomWidth: 1,
  },
  backBtn: { padding: Spacing.xs, marginRight: Spacing.sm },
  refreshBtn: { padding: Spacing.xs, marginLeft: 'auto' },
  headerTitle: { fontSize: FontSize.xl, fontWeight: '700', flex: 1 },

  tabBar: { flexDirection: 'row', borderBottomWidth: 1, paddingHorizontal: Spacing.lg },
  tab: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: Spacing.sm, paddingVertical: Spacing.md },
  tabText: { fontSize: FontSize.md, fontWeight: '600' },

  scrollArea: { flex: 1 },
  scrollContent: { padding: Spacing.lg, paddingBottom: 40, gap: Spacing.md },

  centerContent: { alignItems: 'center', justifyContent: 'center', gap: Spacing.md },
  loadingText: { fontSize: FontSize.sm, textAlign: 'center' },
  retryBtn: { paddingVertical: Spacing.sm, paddingHorizontal: Spacing.xl, borderRadius: BorderRadius.lg },
  retryBtnText: { fontSize: FontSize.sm, fontWeight: '600' },

  categoryCard: { borderRadius: BorderRadius.xl, borderWidth: 1, overflow: 'hidden' },
  categoryHeader: { flexDirection: 'row', alignItems: 'center', padding: Spacing.md, borderBottomWidth: 2, gap: Spacing.sm },
  categoryDot: { width: 10, height: 10, borderRadius: 5 },
  categoryTitle: { fontSize: FontSize.md, fontWeight: '700', flex: 1 },
  categoryTotal: { fontSize: FontSize.sm, fontWeight: '700' },

  itemRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: Spacing.sm, paddingHorizontal: Spacing.md, borderTopWidth: 0.5 },
  itemInfo: { flex: 1, marginRight: Spacing.sm },
  itemLabel: { fontSize: FontSize.sm },
  itemSize: { fontSize: FontSize.sm, fontWeight: '600', fontVariant: ['tabular-nums'] },
  itemRight: { flexDirection: 'row', alignItems: 'center' },

  emptyRow: { paddingVertical: Spacing.sm, paddingHorizontal: Spacing.md, borderTopWidth: 0.5 },
  emptyText: { fontSize: FontSize.xs, fontStyle: 'italic', textAlign: 'center' },

  detailBox: { borderLeftWidth: 3, borderTopWidth: 0.5, paddingBottom: Spacing.xs },
  detailHeader: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm },
  detailDot: { width: 8, height: 8, borderRadius: 4 },
  detailHeaderText: { fontSize: FontSize.xs, fontWeight: '700', letterSpacing: 0.5, flex: 1 },
  detailLoading: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: Spacing.sm, paddingVertical: Spacing.xl },
  detailLoadingText: { fontSize: FontSize.xs },
  detailScroll: { maxHeight: 220, minHeight: 40, marginHorizontal: Spacing.sm, borderRadius: BorderRadius.md, padding: Spacing.sm },
  detailMono: { fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace', fontSize: 11, lineHeight: 16 },
  detailFooter: { flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end', paddingHorizontal: Spacing.md, paddingVertical: Spacing.xs, borderTopWidth: 0.5, marginTop: Spacing.xs },
  detailFooterText: { fontSize: 9, fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace' },

  totalCard: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, padding: Spacing.lg, borderRadius: BorderRadius.xl, borderWidth: 1 },
  totalLabel: { fontSize: FontSize.md, fontWeight: '600', flex: 1 },
  totalValue: { fontSize: FontSize.lg, fontWeight: '800' },
  refreshHint: { fontSize: FontSize.xs, textAlign: 'center', fontStyle: 'italic', marginTop: -Spacing.sm },

  statusCard: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, padding: Spacing.md, borderRadius: BorderRadius.lg, borderWidth: 1 },
  statusText: { fontSize: FontSize.sm, fontWeight: '600', flex: 1 },

  sectionCard: { borderRadius: BorderRadius.xl, borderWidth: 1, overflow: 'hidden' },
  sectionCardHeader: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, padding: Spacing.md, borderBottomWidth: 1 },
  iconBoxSm: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  sectionCardTitle: { fontSize: FontSize.md, fontWeight: '700' },
  sectionDesc: { fontSize: FontSize.sm, padding: Spacing.md, lineHeight: 18 },

  backupActions: { flexDirection: 'row', gap: Spacing.md, padding: Spacing.md, paddingTop: 0 },
  actionBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: Spacing.sm, paddingVertical: Spacing.md, borderRadius: BorderRadius.lg },
  actionBtnText: { color: '#FFFFFF', fontSize: FontSize.md, fontWeight: '700' },

  restoreBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: Spacing.sm, marginHorizontal: Spacing.md, marginBottom: Spacing.md, paddingVertical: Spacing.md, borderRadius: BorderRadius.lg },

  infoCard: { flexDirection: 'row', alignItems: 'flex-start', gap: Spacing.sm, padding: Spacing.md, borderRadius: BorderRadius.lg, borderWidth: 1 },
  infoText: { fontSize: FontSize.xs, flex: 1, lineHeight: 16 },
});
