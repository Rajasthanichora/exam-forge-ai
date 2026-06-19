import React, { useState, useEffect, useCallback, useRef } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView, Switch, TextInput, Alert } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as DocumentPicker from 'expo-document-picker';
import { Paths, File } from 'expo-file-system';
import { useTheme, FontSize, Spacing, BorderRadius } from '../lib/theme';
import { Difficulty, Language, SavedDocument } from '../lib/types';
import { generateUniqueId } from '../lib/utils';
import { AppStorage, getItem, setItem } from '../lib/storage';
import { persistLog } from '../lib/logs';
import SavedDocumentsComponent from '../components/SavedDocuments';

interface LogEntry {
  time: string;
  text: string;
  color?: string;
}

function addLog(logs: LogEntry[], text: string, color?: string): LogEntry[] {
  const time = new Date().toLocaleTimeString('en-US', { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' });
  return [...logs, { time, text, color }];
}

export default function SettingsScreen() {
  const router = useRouter();
  const { isDark, colors, toggleTheme, mode } = useTheme();
  const C = colors;
  const logsRef = useRef<ScrollView>(null);

  // Notification states
  const [pushEnabled, setPushEnabled] = useState(false);
  const [soundEnabled, setSoundEnabled] = useState(true);

  // Data management states
  const [apiKeyDeleted, setApiKeyDeleted] = useState(false);

  // AI Test Configuration states
  const [aiTestOpen, setAiTestOpen] = useState(false);
  const [aiNotes, setAiNotes] = useState('');
  const [aiDifficulty, setAiDifficulty] = useState<Difficulty>('medium');
  const [aiCount, setAiCount] = useState(5);
  const [aiSavedDocuments, setAiSavedDocuments] = useState<SavedDocument[]>([]);
  const [aiSelectedDocIds, setAiSelectedDocIds] = useState<string[]>([]);

  // Logs state
  const [settingsLogs, setSettingsLogs] = useState<LogEntry[]>([]);
  const [showLogs, setShowLogs] = useState(false);

  // Log helper
  const logAction = (text: string, color?: string) => {
    setSettingsLogs(prev => addLog(prev, text, color));
    persistLog('settings', text, color);
  };

  // Manual Test Configuration states
  const [manualTestOpen, setManualTestOpen] = useState(false);
  const [manualLanguage, setManualLanguage] = useState<Language>('english');
  const [manualDifficulty, setManualDifficulty] = useState<Difficulty>('medium');
  const [manualCount, setManualCount] = useState(10);

  const DIFFICULTIES: Difficulty[] = ['easy', 'medium', 'hard'];
  const LANGUAGES: { value: Language; label: string }[] = [
    { value: 'english', label: 'English' },
    { value: 'hindi', label: 'Hindi' },
    { value: 'hinglish', label: 'Hinglish' },
  ];

  // Auto-scroll logs
  useEffect(() => {
    if (settingsLogs.length > 0) {
      setTimeout(() => logsRef.current?.scrollToEnd({ animated: true }), 100);
    }
  }, [settingsLogs.length]);

  // Load saved documents and config from storage on mount
  useEffect(() => {
    (async () => {
      try {
        const savedDocsJson = await getItem('examforge_ai_saved_documents');
        if (savedDocsJson) {
          const docs = JSON.parse(savedDocsJson);
          setAiSavedDocuments(docs);
        }
        const savedNotes = await getItem('examforge_ai_config_notes');
        if (savedNotes) setAiNotes(savedNotes);
        const savedDifficulty = await getItem('examforge_ai_config_difficulty');
        if (savedDifficulty) setAiDifficulty(savedDifficulty as Difficulty);
        const savedCount = await getItem('examforge_ai_config_count');
        if (savedCount) setAiCount(parseInt(savedCount, 10) || 5);
        // Load selected document IDs
        const savedSelectedIds = await getItem('examforge_ai_selected_doc_ids');
        if (savedSelectedIds) {
          const ids = JSON.parse(savedSelectedIds);
          if (Array.isArray(ids)) setAiSelectedDocIds(ids);
        }
      } catch (e) {
        // Ignore load errors
      }
    })();
  }, []);

  const handleResetApiKey = async () => {
    try {
      await AppStorage.removeOpenRouterKey();
      await AppStorage.removeGeminiKey();
      setApiKeyDeleted(true);
      logAction('API keys reset: OpenRouter and Gemini keys removed.', '#F43F5E');
      setTimeout(() => setApiKeyDeleted(false), 3000);
    } catch (err) {
      Alert.alert('Error', 'Failed to reset API keys');
      logAction('Failed to reset API keys.', '#F43F5E');
    }
  };

  // Document management
  const handleSaveDocument = useCallback((doc: { name: string; content: string; size: number }) => {
    const newDoc: SavedDocument = {
      id: generateUniqueId('doc'),
      name: doc.name,
      content: doc.content,
      size: doc.size,
      uploadedAt: new Date().toISOString(),
    };
    setAiSavedDocuments(prev => {
      const updated = [...prev, newDoc];
      // Persist to AsyncStorage
      setItem('examforge_ai_saved_documents', JSON.stringify(updated)).catch(() => {});
      return updated;
    });
    logAction(`Document saved: "${doc.name}" (${(doc.size / 1024).toFixed(1)} KB)`, '#10B981');
  }, []);

  const handleRemoveDocument = useCallback((docId: string) => {
    // Try to find the doc name before state update for logging
    setAiSavedDocuments(prev => {
      const doc = prev.find(d => d.id === docId);
      const updated = prev.filter(d => d.id !== docId);
      // Persist removal to AsyncStorage
      setItem('examforge_ai_saved_documents', JSON.stringify(updated)).catch(() => {});
      if (doc) logAction(`Document removed: "${doc.name}"`, '#F43F5E');
      return updated;
    });
    setAiSelectedDocIds(prev => prev.filter(id => id !== docId));
  }, []);

  const handleSelectDocuments = useCallback((docs: SavedDocument[]) => {
    const ids = docs.map(d => d.id);
    setAiSelectedDocIds(ids);
    // Persist selection
    setItem('examforge_ai_selected_doc_ids', JSON.stringify(ids)).catch(() => {});
    if (docs.length > 0) {
      logAction(`${docs.length} document(s) selected for AI test config.`, '#10B981');
      docs.forEach(doc => logAction(`  → Selected: "${doc.name}"`, '#10B981'));
    } else {
      logAction('All documents deselected for AI test config.', '#F59E0B');
    }
  }, []);

  const handleSaveNotes = async () => {
    if (!aiNotes.trim()) return;
    logAction('Saving pasted notes...', '#10B981');
    handleSaveDocument({
      name: `Notes - ${new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}`,
      content: aiNotes,
      size: aiNotes.length,
    });
    logAction('Notes saved to document list.', '#10B981');

    try {
      await setItem('examforge_ai_config_notes', aiNotes);
      await setItem('examforge_ai_config_difficulty', aiDifficulty);
      await setItem('examforge_ai_config_count', String(aiCount));
      await setItem('examforge_ai_selected_doc_ids', JSON.stringify(aiSelectedDocIds));
      await setItem('examforge_ai_saved_documents', JSON.stringify(aiSavedDocuments));
      logAction('Notes + config saved for home screen pickup.', '#10B981');
    } catch (e) {
      logAction('Failed to save config alongside notes.', '#F59E0B');
    }

    // Export as a text file for persistence
    try {
      const fileName = `Notes_${Date.now()}.txt`;
      const isWeb = typeof window !== 'undefined' && typeof window.document !== 'undefined';
      if (isWeb) {
        const blob = new Blob([aiNotes], { type: 'text/plain' });
        const url = URL.createObjectURL(blob);
        const a = window.document.createElement('a');
        a.href = url;
        a.download = fileName;
        window.document.body.appendChild(a);
        a.click();
        window.document.body.removeChild(a);
        URL.revokeObjectURL(url);
        logAction(`Notes exported to file: ${fileName} (downloaded via browser)`, '#10B981');
      } else {
        // Native: use expo-file-system with txt format
        try {
          const noteFile = new File(Paths.document, fileName);
          await noteFile.write(aiNotes);
          logAction(`Notes exported to file: ${fileName} (TXT format)`, '#10B981');
        } catch (nativeErr) {
          // expo-file-system may not be available on all platforms
          logAction('File export not available on this platform (notes saved to document list).', '#F59E0B');
        }
      }
    } catch (err) {
      logAction('Notes saved as document but file export had an issue.', '#F59E0B');
    }
    Alert.alert('Saved', 'Notes saved as document.');
    setAiNotes('');
    logAction('Notes save complete. Input cleared.', '#10B981');
  };

  const handleBrowseFiles = useCallback(async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: ['application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'text/plain'],
        copyToCacheDirectory: true,
      });
      if (result.canceled) return;
      const file = result.assets?.[0];
      if (!file) return;
      const response = await fetch(file.uri);
      const text = await response.text();
      handleSaveDocument({
        name: file.name || 'Uploaded Document',
        content: text,
        size: file.size ?? text.length,
      });
      logAction(`File uploaded: "${file.name}" (${((file.size ?? text.length) / 1024).toFixed(1)} KB)`, '#10B981');
      Alert.alert('Uploaded', `"${file.name}" has been saved as a reference document.`);
    } catch (err) {
      Alert.alert('Error', 'Failed to pick document. Please try again.');
      logAction('File upload failed.', '#F43F5E');
    }
  }, [handleSaveDocument]);

  return (
    <View style={[styles.container, { backgroundColor: C.background }]}>
      {/* Header */}
      <View style={[styles.header, { backgroundColor: C.card, borderBottomColor: C.border }]}>
        <View style={styles.headerLeft}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
            <Ionicons name="arrow-back" size={22} color={C.foreground} />
          </TouchableOpacity>
          <View style={[styles.logo, { backgroundColor: C.primary }]}>
            <Ionicons name="settings" size={18} color={C.primaryForeground} />
          </View>
          <View>
            <Text style={[styles.title, { color: C.foreground }]}>Settings</Text>
            <Text style={[styles.subtitle, { color: C.mutedForeground }]}>
              Appearance & Preferences
            </Text>
          </View>
        </View>
      </View>

      <ScrollView style={styles.content} contentContainerStyle={styles.contentInner}>
        {/* Theme Section */}
        <View style={[styles.card, { backgroundColor: C.card, borderColor: C.border }]}>
          <View style={[styles.sectionHeader, { borderBottomColor: C.border }]}>
            <View style={[styles.iconBox, { backgroundColor: C.primary + '15' }]}>
              <Ionicons name={isDark ? "moon" : "sunny"} size={20} color={C.primary} />
            </View>
            <Text style={[styles.sectionTitle, { color: C.foreground }]}>Appearance</Text>
          </View>

          <View style={styles.themeRow}>
            <View style={{ flex: 1 }}>
              <Text style={[styles.themeLabel, { color: C.foreground }]}>Theme Mode</Text>
              <Text style={[styles.themeDesc, { color: C.mutedForeground }]}>
                {isDark ? 'Dark mode is active' : 'Light mode is active'}
              </Text>
            </View>

            <View style={[styles.themeToggle, { backgroundColor: C.muted, borderColor: C.border }]}>
              <TouchableOpacity
                style={[
                  styles.themeOption,
                  !isDark && [styles.themeOptionActive, { backgroundColor: C.primary }],
                ]}
                onPress={() => mode === 'dark' && toggleTheme()}
              >
                <Ionicons
                  name="sunny"
                  size={16}
                  color={!isDark ? C.primaryForeground : C.mutedForeground}
                />
                <Text
                  style={[
                    styles.themeOptionText,
                    { color: !isDark ? C.primaryForeground : C.mutedForeground },
                  ]}
                >
                  Light
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  styles.themeOption,
                  isDark && [styles.themeOptionActive, { backgroundColor: C.primary }],
                ]}
                onPress={() => mode === 'light' && toggleTheme()}
              >
                <Ionicons
                  name="moon"
                  size={16}
                  color={isDark ? C.primaryForeground : C.mutedForeground}
                />
                <Text
                  style={[
                    styles.themeOptionText,
                    { color: isDark ? C.primaryForeground : C.mutedForeground },
                  ]}
                >
                  Dark
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>

        {/* API & Model Configuration Link */}
        <TouchableOpacity
          style={[styles.menuCard, { backgroundColor: C.card, borderColor: C.border }]}
          onPress={() => router.push('/api-settings')}
        >
          <View style={[styles.iconBox, { backgroundColor: C.primary + '15' }]}>
            <Ionicons name="key-outline" size={20} color={C.primary} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={[styles.menuTitle, { color: C.foreground }]}>API & Model Configuration</Text>
            <Text style={[styles.menuDesc, { color: C.mutedForeground }]}>
              Manage authentication keys and model preferences
            </Text>
          </View>
          <Ionicons name="chevron-forward" size={20} color={C.mutedForeground} />
        </TouchableOpacity>

        {/* AI Test Configuration */}
        <View style={[styles.card, { backgroundColor: C.card, borderColor: C.border }]}>
          <TouchableOpacity style={[styles.sectionHeader, { borderBottomColor: C.border }]} onPress={() => { setAiTestOpen(!aiTestOpen); logAction(aiTestOpen ? 'Collapsed AI Test Configuration' : 'Expanded AI Test Configuration', '#10B981'); }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: Spacing.md, flex: 1 }}>
              <View style={[styles.iconBox, { backgroundColor: '#10B981' + '15' }]}>
                <Ionicons name="sparkles-outline" size={20} color="#10B981" />
              </View>
              <Text style={[styles.sectionTitle, { color: C.foreground }]}>AI Test Configuration</Text>
            </View>
            <Ionicons name={aiTestOpen ? "chevron-up" : "chevron-down"} size={20} color={C.mutedForeground} />
          </TouchableOpacity>

          {aiTestOpen && (
            <View style={{ gap: Spacing.md, paddingTop: Spacing.md }}>
              {/* Study Materials Drop Zone - Updated to DOCX */}
              <View style={{ gap: Spacing.sm }}>
                <Text style={[styles.fieldLabel, { color: C.mutedForeground }]}>
                  <Ionicons name="cloud-upload-outline" size={14} color={C.primary} />  Upload Study Materials
                </Text>
                <View style={[styles.dropZone, { borderColor: C.border, backgroundColor: C.muted + '30' }]}>
                  <View style={[styles.uploadIconBox, { backgroundColor: C.primary + '10' }]}>
                    <Ionicons name="document-attach-outline" size={32} color={C.primary} />
                  </View>
                  <Text style={[styles.dropTitle, { color: C.foreground }]}>Drop DOCX files here or click to browse</Text>
                  <Text style={[styles.dropDesc, { color: C.mutedForeground }]}>
                    Supports .docx and .txt files
                  </Text>
                  <TouchableOpacity style={[styles.browseBtn, { backgroundColor: C.primary }]} onPress={handleBrowseFiles}>
                    <Ionicons name="folder-open-outline" size={14} color={C.primaryForeground} />
                    <Text style={[styles.browseBtnText, { color: C.primaryForeground }]}>  Browse Files</Text>
                  </TouchableOpacity>
                </View>
              </View>

              {/* Paste Notes - with enhanced Save button */}
              <View>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: Spacing.sm }}>
                  <Text style={[styles.fieldLabel, { color: C.mutedForeground }]}>
                    <Ionicons name="create-outline" size={14} color={C.primary} />  Paste your notes
                  </Text>
                  <TouchableOpacity
                    style={[styles.notesSaveBtn, { backgroundColor: aiNotes.trim() ? C.primary : C.muted }]}
                    onPress={handleSaveNotes}
                    disabled={!aiNotes.trim()}
                  >
                    <Ionicons name="save-outline" size={14} color={aiNotes.trim() ? C.primaryForeground : C.mutedForeground} />
                    <Text style={[styles.notesSaveText, { color: aiNotes.trim() ? C.primaryForeground : C.mutedForeground }]}>  Save</Text>
                  </TouchableOpacity>
                </View>
                <TextInput
                  style={[styles.notesInput, { backgroundColor: C.card, borderColor: C.border, color: C.foreground }]}
                  multiline
                  placeholder="Paste chapters, key points, or raw lecture notes here..."
                  placeholderTextColor={C.mutedForeground + '60'}
                  value={aiNotes}
                  onChangeText={setAiNotes}
                  textAlignVertical="top"
                  onBlur={() => {
                    if (aiNotes.trim()) logAction(`Notes updated (${aiNotes.length} chars)`, '#10B981');
                  }}
                />
              </View>

              {/* Saved Documents */}
              <View>
                <Text style={[styles.fieldLabel, { color: C.mutedForeground, marginBottom: Spacing.md }]}>
                  <Ionicons name="folder-outline" size={14} color={C.primary} />  Saved Documents
                </Text>
                <SavedDocumentsComponent
                  savedDocuments={aiSavedDocuments}
                  selectedDocIds={aiSelectedDocIds}
                  onSaveDocument={handleSaveDocument}
                  onRemoveDocument={handleRemoveDocument}
                  onSelectDocuments={handleSelectDocuments}
                />
              </View>

              {/* Difficulty - Enhanced */}
              <View>
                <Text style={[styles.fieldLabel, { color: C.mutedForeground }]}>Difficulty Level</Text>
                <View style={[styles.enhancedPillRow, { backgroundColor: C.muted, borderColor: C.border }]}>
                  {DIFFICULTIES.map(d => {
                    const isActive = aiDifficulty === d;
                    const colors = d === 'easy' ? '#10B981' : d === 'medium' ? '#F59E0B' : '#F43F5E';
                    return (
                      <TouchableOpacity
                        key={d}
                        style={[
                          styles.enhancedPill,
                          isActive && { backgroundColor: colors + '15', borderColor: colors, borderWidth: 1.5 },
                        ]}
                        onPress={() => { setAiDifficulty(d); logAction(`AI difficulty changed to: ${d}`, '#F59E0B'); }}
                      >
                        <Ionicons
                          name={d === 'easy' ? 'leaf-outline' : d === 'medium' ? 'trending-up-outline' : 'flame-outline'}
                          size={14}
                          color={isActive ? colors : C.mutedForeground}
                        />
                        <Text style={[
                          styles.enhancedPillText,
                          { color: isActive ? colors : C.mutedForeground, fontWeight: isActive ? '700' : '500' },
                        ]}>
                          {d.charAt(0).toUpperCase() + d.slice(1)}
                        </Text>
                        {isActive && (
                          <View style={[styles.pillActiveDot, { backgroundColor: colors }]} />
                        )}
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </View>

              {/* Question Count - 1 to 100, smooth slider */}
              <View>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                  <Text style={[styles.fieldLabel, { color: C.mutedForeground }]}>Question Count</Text>
                  <View style={[styles.countBadge, { backgroundColor: C.primary + '15' }]}>
                    <Text style={[styles.countBadgeText, { color: C.primary }]}>{aiCount}</Text>
                  </View>
                </View>
                <View style={[styles.countSliderContainer, { backgroundColor: C.muted, borderColor: C.border }]}>
                  {/* Slider Track */}
                  <View style={{ position: 'relative', height: 6, backgroundColor: C.border, borderRadius: 3 }}>
                    <View style={{
                      position: 'absolute', left: 0, top: 0, height: 6, borderRadius: 3,
                      backgroundColor: C.primary, width: `${((aiCount - 1) / 99) * 100}%`,
                    }} />
                  </View>
                  {/* Preset chips with custom input */}
                  <View style={{ flexDirection: 'row', gap: Spacing.xs, flexWrap: 'wrap', alignItems: 'center' }}>
                    {[5, 10, 20, 30, 50, 75].map(n => (
                      <TouchableOpacity key={n} onPress={() => { setAiCount(n); logAction(`AI question count set to: ${n}`, '#F59E0B'); }}
                        style={{
                          paddingVertical: Spacing.sm, paddingHorizontal: Spacing.md,
                          borderRadius: BorderRadius.md, borderWidth: 1,
                          borderColor: aiCount === n ? C.primary : C.border,
                          backgroundColor: aiCount === n ? C.primary + '15' : 'transparent',
                        }}>
                        <Text style={{
                          fontSize: FontSize.sm, fontWeight: aiCount === n ? '700' : '600',
                          color: aiCount === n ? C.primary : C.mutedForeground,
                        }}>{n}</Text>
                      </TouchableOpacity>
                    ))}
                    <View style={{
                      borderRadius: BorderRadius.md, borderWidth: 1, borderColor: C.border,
                      paddingVertical: Spacing.sm, paddingHorizontal: Spacing.md, minWidth: 60, alignItems: 'center',
                    }}>
                      <TextInput
                        style={{ fontSize: FontSize.sm, fontWeight: '600', color: C.foreground, textAlign: 'center', minWidth: 40, padding: 0 }}
                        value={[5, 10, 20, 30, 50, 75].includes(aiCount) ? '' : String(aiCount)}
                        placeholder="Any"
                        placeholderTextColor={C.mutedForeground}
                        keyboardType="number-pad"
                        onChangeText={(t) => {
                          const v = parseInt(t, 10);
                          if (!isNaN(v) && v >= 1 && v <= 100) setAiCount(v);
                        }}
                      />
                    </View>
                  </View>
                </View>
              </View>

              {/* Save Settings - Enhanced */}
              <TouchableOpacity style={[styles.enhancedSaveBtn, { backgroundColor: C.primary }]}
                onPress={async () => {
                  try {
                    logAction('Saving AI Test Configuration...', '#10B981');
                    await setItem('examforge_ai_config_difficulty', aiDifficulty);
                    await setItem('examforge_ai_config_count', String(aiCount));
                    if (aiNotes.trim()) {
                      await setItem('examforge_ai_config_notes', aiNotes);
                      logAction(`Saved pasted notes (${aiNotes.length} chars).`, '#10B981');
                    }
                    // Persist selected document IDs
                    if (aiSelectedDocIds.length > 0) {
                      await setItem('examforge_ai_selected_doc_ids', JSON.stringify(aiSelectedDocIds));
                      logAction(`AI Test Config saved: Difficulty=${aiDifficulty}, Count=${aiCount}, Docs=${aiSelectedDocIds.length} selected`, '#10B981');
                      // Log each selected doc
                      aiSelectedDocIds.forEach(docId => {
                        const doc = aiSavedDocuments.find(d => d.id === docId);
                        if (doc) logAction(`  → Applied settings to document: "${doc.name}"`, '#10B981');
                      });
                    } else {
                      await setItem('examforge_ai_selected_doc_ids', '[]');
                      logAction(`AI Test Config saved: Difficulty=${aiDifficulty}, Count=${aiCount} (no documents selected)`, '#10B981');
                    }
                    // Persist saved documents list
                    await setItem('examforge_ai_saved_documents', JSON.stringify(aiSavedDocuments));
                    logAction(`Saved ${aiSavedDocuments.length} document(s) in storage.`, '#10B981');
                    Alert.alert('Saved', 'AI Test Configuration saved successfully. Settings will apply when generating tests.');
                  } catch {
                    Alert.alert('Error', 'Failed to save settings');
                    logAction('Failed to save AI Test Configuration.', '#F43F5E');
                  }
                }}>
                <View style={styles.saveBtnInner}>
                  <Ionicons name="save-outline" size={16} color={C.primaryForeground} />
                  <Text style={[styles.enhancedSaveBtnText, { color: C.primaryForeground }]}>  Save Settings</Text>
                </View>
                <Ionicons name="chevron-forward" size={16} color={C.primaryForeground + '80'} />
              </TouchableOpacity>
            </View>
          )}
        </View>

        {/* Manual Test Configuration */}
        <View style={[styles.card, { backgroundColor: C.card, borderColor: C.border }]}>
          <TouchableOpacity style={[styles.sectionHeader, { borderBottomColor: C.border }]} onPress={() => { setManualTestOpen(!manualTestOpen); logAction(manualTestOpen ? 'Collapsed Manual Test Configuration' : 'Expanded Manual Test Configuration', '#8B5CF6'); }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: Spacing.md, flex: 1 }}>
              <View style={[styles.iconBox, { backgroundColor: '#8B5CF6' + '15' }]}>
                <Ionicons name="code-slash-outline" size={20} color="#8B5CF6" />
              </View>
              <Text style={[styles.sectionTitle, { color: C.foreground }]}>Manual Test Configuration</Text>
            </View>
            <Ionicons name={manualTestOpen ? "chevron-up" : "chevron-down"} size={20} color={C.mutedForeground} />
          </TouchableOpacity>

          {manualTestOpen && (
            <View style={{ gap: Spacing.lg, paddingTop: Spacing.md }}>
              {/* Language - Enhanced */}
              <View>
                <Text style={[styles.fieldLabel, { color: C.mutedForeground }]}>Language</Text>
                <View style={[styles.enhancedPillRow, { backgroundColor: C.muted, borderColor: C.border }]}>
                  {LANGUAGES.map(lang => {
                    const isActive = manualLanguage === lang.value;
                    return (
                      <TouchableOpacity
                        key={lang.value}
                        style={[styles.enhancedPill, isActive && { backgroundColor: '#8B5CF6' + '15', borderColor: '#8B5CF6', borderWidth: 1.5 }]}
                        onPress={() => { setManualLanguage(lang.value); logAction(`Manual language changed to: ${lang.label}`, '#8B5CF6'); }}
                      >
                        <Ionicons
                          name={lang.value === 'english' ? 'language-outline' : lang.value === 'hindi' ? 'text-outline' : 'chatbubbles-outline'}
                          size={14}
                          color={isActive ? '#8B5CF6' : C.mutedForeground}
                        />
                        <Text style={[styles.enhancedPillText, { color: isActive ? '#8B5CF6' : C.mutedForeground, fontWeight: isActive ? '700' : '500' }]}>
                          {lang.label}
                        </Text>
                        {isActive && <View style={[styles.pillActiveDot, { backgroundColor: '#8B5CF6' }]} />}
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </View>

              {/* Difficulty - Enhanced */}
              <View>
                <Text style={[styles.fieldLabel, { color: C.mutedForeground }]}>Difficulty Level</Text>
                <View style={[styles.enhancedPillRow, { backgroundColor: C.muted, borderColor: C.border }]}>
                  {DIFFICULTIES.map(d => {
                    const isActive = manualDifficulty === d;
                    const colors = d === 'easy' ? '#10B981' : d === 'medium' ? '#F59E0B' : '#F43F5E';
                    return (
                      <TouchableOpacity
                        key={d}
                        style={[styles.enhancedPill, isActive && { backgroundColor: colors + '15', borderColor: colors, borderWidth: 1.5 }]}
                        onPress={() => { setManualDifficulty(d); logAction(`Manual difficulty changed to: ${d}`, '#8B5CF6'); }}
                      >
                        <Ionicons
                          name={d === 'easy' ? 'leaf-outline' : d === 'medium' ? 'trending-up-outline' : 'flame-outline'}
                          size={14}
                          color={isActive ? colors : C.mutedForeground}
                        />
                        <Text style={[styles.enhancedPillText, { color: isActive ? colors : C.mutedForeground, fontWeight: isActive ? '700' : '500' }]}>
                          {d.charAt(0).toUpperCase() + d.slice(1)}
                        </Text>
                        {isActive && <View style={[styles.pillActiveDot, { backgroundColor: colors }]} />}
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </View>

              {/* Question Count - 1 to 100 smooth slider */}
              <View>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                  <Text style={[styles.fieldLabel, { color: C.mutedForeground }]}>Question Count</Text>
                  <View style={[styles.countBadge, { backgroundColor: '#8B5CF6' + '15' }]}>
                    <Text style={[styles.countBadgeText, { color: '#8B5CF6' }]}>{manualCount}</Text>
                  </View>
                </View>
                <View style={[styles.countSliderContainer, { backgroundColor: C.muted, borderColor: C.border }]}>
                  {/* Slider Track */}
                  <View style={{ position: 'relative', height: 6, backgroundColor: C.border, borderRadius: 3 }}>
                    <View style={{
                      position: 'absolute', left: 0, top: 0, height: 6, borderRadius: 3,
                      backgroundColor: '#8B5CF6', width: `${((manualCount - 1) / 99) * 100}%`,
                    }} />
                  </View>
                  {/* Quick preset chips */}
                  <View style={{ flexDirection: 'row', gap: Spacing.xs, flexWrap: 'wrap', alignItems: 'center' }}>
                    {[5, 10, 20, 30, 50, 75].map(n => (
                      <TouchableOpacity key={n} onPress={() => { setManualCount(n); logAction(`Manual count set to: ${n}`, '#8B5CF6'); }}
                        style={{
                          paddingVertical: Spacing.sm, paddingHorizontal: Spacing.md,
                          borderRadius: BorderRadius.md, borderWidth: 1,
                          borderColor: manualCount === n ? '#8B5CF6' : C.border,
                          backgroundColor: manualCount === n ? '#8B5CF6' + '15' : 'transparent',
                        }}>
                        <Text style={{
                          fontSize: FontSize.sm, fontWeight: manualCount === n ? '700' : '600',
                          color: manualCount === n ? '#8B5CF6' : C.mutedForeground,
                        }}>{n}</Text>
                      </TouchableOpacity>
                    ))}
                    {/* Custom input area */}
                    <View style={{
                      borderRadius: BorderRadius.md, borderWidth: 1, borderColor: C.border,
                      paddingVertical: Spacing.sm, paddingHorizontal: Spacing.md, minWidth: 60, alignItems: 'center',
                    }}>
                      <TextInput
                        style={{ fontSize: FontSize.sm, fontWeight: '600', color: C.foreground, textAlign: 'center', minWidth: 40, padding: 0 }}
                        value={[5, 10, 20, 30, 50, 75].includes(manualCount) ? '' : String(manualCount)}
                        placeholder="Any"
                        placeholderTextColor={C.mutedForeground}
                        keyboardType="number-pad"
                        onChangeText={(t) => {
                          const v = parseInt(t, 10);
                          if (!isNaN(v) && v >= 1 && v <= 100) { setManualCount(v); logAction(`Manual count custom: ${v}`, '#8B5CF6'); }
                        }}
                      />
                    </View>
                  </View>
                </View>
              </View>

              {/* Save Settings - Enhanced */}
              <TouchableOpacity style={[styles.enhancedSaveBtn, { backgroundColor: '#8B5CF6' }]}
                onPress={async () => {
                  try {
                    await setItem('examforge_manual_config_language', manualLanguage);
                    await setItem('examforge_manual_config_difficulty', manualDifficulty);
                    await setItem('examforge_manual_config_count', String(manualCount));
                    logAction(`Manual Test Config saved: Language=${manualLanguage}, Difficulty=${manualDifficulty}, Count=${manualCount}`, '#8B5CF6');
                    Alert.alert('Saved', 'Manual Test Configuration saved successfully.');
                  } catch {
                    Alert.alert('Error', 'Failed to save settings');
                    logAction('Failed to save Manual Test Configuration.', '#F43F5E');
                  }
                }}>
                <View style={styles.saveBtnInner}>
                  <Ionicons name="save-outline" size={16} color={C.primaryForeground} />
                  <Text style={[styles.enhancedSaveBtnText, { color: C.primaryForeground }]}>  Save Settings</Text>
                </View>
                <Ionicons name="chevron-forward" size={16} color={C.primaryForeground + '80'} />
              </TouchableOpacity>
            </View>
          )}
        </View>

        {/* Notifications */}
        <View style={[styles.card, { backgroundColor: C.card, borderColor: C.border }]}>
          <View style={[styles.sectionHeader, { borderBottomColor: C.border }]}>
            <View style={[styles.iconBox, { backgroundColor: C.primary + '15' }]}>
              <Ionicons name="notifications-outline" size={20} color={C.primary} />
            </View>
            <Text style={[styles.sectionTitle, { color: C.foreground }]} numberOfLines={1}>Notifications</Text>
          </View>

          <View style={styles.settingRow}>
            <View style={{ flex: 1 }}>
              <Text style={[styles.settingLabel, { color: C.foreground }]}>Push Notifications</Text>
              <Text style={[styles.settingDesc, { color: C.mutedForeground }]}>
                Get notified about test results and updates
              </Text>
            </View>
            <TouchableOpacity
              style={[styles.customToggle, pushEnabled ? { backgroundColor: '#10B981' } : { backgroundColor: C.muted, borderColor: C.border }]}
              onPress={() => setPushEnabled(!pushEnabled)}
            >
              <View style={[styles.customToggleDot, pushEnabled ? { transform: [{ translateX: 16 }] } : {}]} />
            </TouchableOpacity>
          </View>

          <View style={[styles.settingRow, { borderTopColor: C.border }]}>
            <View style={{ flex: 1 }}>
              <Text style={[styles.settingLabel, { color: C.foreground }]}>Sound Effects</Text>
              <Text style={[styles.settingDesc, { color: C.mutedForeground }]}>
                Play sounds during quiz sessions
              </Text>
            </View>
            <TouchableOpacity
              style={[styles.customToggle, soundEnabled ? { backgroundColor: '#10B981' } : { backgroundColor: C.muted, borderColor: C.border }]}
              onPress={() => setSoundEnabled(!soundEnabled)}
            >
              <View style={[styles.customToggleDot, soundEnabled ? { transform: [{ translateX: 16 }] } : {}]} />
            </TouchableOpacity>
          </View>
        </View>

        {/* Data Management */}
        <View style={[styles.card, { backgroundColor: C.card, borderColor: C.border }]}>
          <View style={[styles.sectionHeader, { borderBottomColor: C.border }]}>
            <View style={[styles.iconBox, { backgroundColor: C.primary + '15' }]}>
              <Ionicons name="server-outline" size={20} color={C.primary} />
            </View>
            <Text style={[styles.sectionTitle, { color: C.foreground }]}>Data Management</Text>
          </View>

          <TouchableOpacity
            style={[styles.settingRow, { borderTopColor: C.border }]}
            onPress={() => router.push('/clear-test-history')}
          >
            <View style={{ flex: 1 }}>
              <Text style={[styles.settingLabel, { color: C.foreground }]}>Clear All Test History</Text>
              <Text style={[styles.settingDesc, { color: C.mutedForeground }]}>
                Remove all test results and tracking data
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color={C.mutedForeground} />
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.settingRow, { borderTopColor: C.border }]}
            onPress={handleResetApiKey}
          >
            <View style={{ flex: 1 }}>
              <Text style={[styles.settingLabel, { color: C.foreground }]}>Reset API Keys</Text>
              <Text style={[styles.settingDesc, { color: C.mutedForeground }]}>
                Remove all saved API credentials
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color={C.mutedForeground} />
          </TouchableOpacity>

          {apiKeyDeleted && (
            <View style={[styles.greenIndicator, { backgroundColor: '#10B981' + '12', borderColor: '#10B981' + '30' }]}>
              <Ionicons name="checkmark-circle" size={16} color="#10B981" />
              <Text style={[styles.greenText, { color: '#10B981' }]}>  API key deleted / removed</Text>
            </View>
          )}
        </View>

        {/* About Section */}
        <View style={[styles.card, { backgroundColor: C.card, borderColor: C.border }]}>
          <View style={[styles.sectionHeader, { borderBottomColor: C.border }]}>
            <View style={[styles.iconBox, { backgroundColor: C.primary + '15' }]}>
              <Ionicons name="information-circle-outline" size={20} color={C.primary} />
            </View>
            <Text style={[styles.sectionTitle, { color: C.foreground }]}>About</Text>
          </View>

          <View style={styles.aboutRow}>
            <Text style={[styles.aboutLabel, { color: C.mutedForeground }]}>Version</Text>
            <Text style={[styles.aboutValue, { color: C.foreground }]}>1.0.0</Text>
          </View>
          <View style={[styles.divider, { backgroundColor: C.border }]} />
          <View style={styles.aboutRow}>
            <Text style={[styles.aboutLabel, { color: C.mutedForeground }]}>App</Text>
            <Text style={[styles.aboutValue, { color: C.foreground }]}>ExamForge AI</Text>
          </View>
          <View style={[styles.divider, { backgroundColor: C.border }]} />
          <View style={styles.aboutRow}>
            <Text style={[styles.aboutLabel, { color: C.mutedForeground }]}>Framework</Text>
            <Text style={[styles.aboutValue, { color: C.foreground }]}>Expo SDK 56</Text>
          </View>
        </View>

        {/* Settings Logs */}
        <View style={[styles.card, { backgroundColor: C.card, borderColor: C.border }]}>
          <TouchableOpacity style={[styles.sectionHeader, { borderBottomColor: C.border }]} onPress={() => setShowLogs(!showLogs)}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: Spacing.md, flex: 1 }}>
              <View style={[styles.iconBox, { backgroundColor: '#1E293B' + '15' }]}>
                <Ionicons name="terminal-outline" size={20} color={'#1E293B'} />
              </View>
              <Text style={[styles.sectionTitle, { color: C.foreground }]}>Settings Logs</Text>
            </View>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: Spacing.sm }}>
              {settingsLogs.length > 0 && (
                <TouchableOpacity onPress={() => setSettingsLogs([])}>
                  <Text style={{ fontSize: 10, color: C.destructive, fontWeight: '600' }}>Clear</Text>
                </TouchableOpacity>
              )}
              <Ionicons name={showLogs ? "chevron-up" : "chevron-down"} size={20} color={C.mutedForeground} />
            </View>
          </TouchableOpacity>

          {showLogs && (
            <View style={[styles.terminal, { backgroundColor: '#09090B', borderColor: '#27272A', maxHeight: 250 }]}>
              <ScrollView ref={logsRef} style={{ maxHeight: 180 }} nestedScrollEnabled>
                {settingsLogs.length === 0 ? (
                  <View style={{ padding: Spacing.md, alignItems: 'center' }}>
                    <Text style={[styles.terminalText, { color: '#71717A', textAlign: 'center' }]}>
                      No logs yet. Perform actions in settings to see logs here.
                    </Text>
                  </View>
                ) : (
                  settingsLogs.map((log, i) => (
                    <View key={i} style={styles.terminalLine}>
                      <Text style={[styles.terminalTime, { color: '#71717A' }]}>{log.time}</Text>
                      <Text style={[styles.terminalText, { color: log.color || '#D4D4D8' }]}>
                        {log.text}
                      </Text>
                    </View>
                  ))
                )}
              </ScrollView>
              {settingsLogs.length > 0 && (
                <View style={[styles.terminalFooter, { borderTopColor: '#27272A' }]}>
                  <Text style={{ fontSize: 10, color: '#71717A' }}>
                    {settingsLogs.length} log entries
                  </Text>
                </View>
              )}
            </View>
          )}
        </View>

        {/* Security Notice */}
        <View style={[styles.notice, { backgroundColor: C.primary + '08', borderColor: C.primary + '20' }]}>
          <View style={[styles.noticeIconBox, { backgroundColor: C.card, borderColor: C.primary + '20' }]}>
            <Ionicons name="lock-closed" size={22} color={C.primary} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={[styles.noticeTitle, { color: C.foreground }]}>
              End-to-End Local Encryption
            </Text>
            <Text style={[styles.noticeDesc, { color: C.mutedForeground }]}>
              Your API keys are secured using AES-256 and stored exclusively on your device.
              ExamForge AI never transmits these credentials to our servers.
            </Text>
          </View>
        </View>

        <View style={{ height: 40 }} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    borderBottomWidth: 1, paddingTop: Spacing.xl, paddingBottom: Spacing.md,
    paddingHorizontal: Spacing.lg,
  },
  headerLeft: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md },
  backBtn: { padding: Spacing.xs },
  logo: {
    width: 36, height: 36, borderRadius: BorderRadius.md,
    alignItems: 'center', justifyContent: 'center',
  },
  title: { fontSize: FontSize.lg, fontWeight: 'bold' },
  subtitle: { fontSize: FontSize.xs, marginTop: 1 },
  content: { flex: 1 },
  contentInner: { padding: Spacing.md, gap: Spacing.md, paddingBottom: Spacing.xxxl * 2 },
  card: {
    borderRadius: BorderRadius.lg, borderWidth: 1,
    padding: Spacing.lg, gap: Spacing.md,
  },
  menuCard: {
    borderRadius: BorderRadius.lg, borderWidth: 1,
    padding: Spacing.lg, flexDirection: 'row', alignItems: 'center', gap: Spacing.md,
  },
  sectionHeader: {
    flexDirection: 'row', alignItems: 'center', gap: Spacing.md,
    paddingBottom: Spacing.md, borderBottomWidth: 1,
    flexWrap: 'wrap',
  },
  iconBox: {
    width: 40, height: 40, borderRadius: BorderRadius.md,
    alignItems: 'center', justifyContent: 'center',
  },
  sectionTitle: { fontSize: FontSize.lg, fontWeight: '600' },
  themeRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: Spacing.sm },
  themeLabel: { fontSize: FontSize.md, fontWeight: '500' },
  themeDesc: { fontSize: FontSize.sm, marginTop: 2 },
  themeToggle: {
    flexDirection: 'row', borderRadius: BorderRadius.md,
    borderWidth: 1, padding: 3,
  },
  themeOption: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    paddingVertical: Spacing.sm, paddingHorizontal: Spacing.md,
    borderRadius: BorderRadius.sm,
  },
  themeOptionActive: {},
  themeOptionText: { fontSize: FontSize.sm, fontWeight: '600' },
  menuTitle: { fontSize: FontSize.md, fontWeight: '500' },
  menuDesc: { fontSize: FontSize.sm, marginTop: 2 },
  settingRow: {
    flexDirection: 'row', alignItems: 'center', gap: Spacing.md,
    paddingVertical: Spacing.md,
  },
  settingLabel: { fontSize: FontSize.md, fontWeight: '500' },
  settingDesc: { fontSize: FontSize.sm, marginTop: 2 },
  aboutRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  aboutLabel: { fontSize: FontSize.sm },
  aboutValue: { fontSize: FontSize.md, fontWeight: '500' },
  divider: { height: 1 },
  notice: {
    borderRadius: BorderRadius.xl, borderWidth: 1,
    padding: Spacing.lg, flexDirection: 'row', gap: Spacing.md,
    alignItems: 'flex-start',
  },
  noticeIconBox: {
    width: 48, height: 48, borderRadius: BorderRadius.lg, borderWidth: 1,
    alignItems: 'center', justifyContent: 'center',
  },
  noticeTitle: { fontSize: FontSize.md, fontWeight: '700', marginBottom: 4 },
  noticeDesc: { fontSize: FontSize.sm, lineHeight: 20 },
  // Custom Toggle
  customToggle: {
    width: 44, height: 24, borderRadius: 12,
    justifyContent: 'center', paddingHorizontal: 2,
    borderWidth: 1, borderColor: 'transparent',
  },
  customToggleDot: {
    width: 18, height: 18, borderRadius: 9,
    backgroundColor: '#FFFFFF',
    boxShadow: '0 2px 4px rgba(0,0,0,0.2)',
  },
  // AI/Manual Config fields
  fieldLabel: { fontSize: 13, fontWeight: '500', marginBottom: Spacing.sm },

  // Drop Zone - Enhanced
  dropZone: {
    borderRadius: BorderRadius.xl, borderWidth: 2, borderStyle: 'dashed',
    padding: Spacing.lg, alignItems: 'center', gap: Spacing.md,
  },
  uploadIconBox: { width: 60, height: 60, borderRadius: 30, alignItems: 'center', justifyContent: 'center' },
  dropTitle: { fontSize: FontSize.md, fontWeight: '600', textAlign: 'center' },
  dropDesc: { fontSize: FontSize.sm, textAlign: 'center' },
  browseBtn: {
    flexDirection: 'row', alignItems: 'center',
    paddingVertical: Spacing.sm, paddingHorizontal: Spacing.xl, borderRadius: BorderRadius.lg,
    boxShadow: '0 2px 4px rgba(0,0,0,0.15)',
  },
  browseBtnText: { fontSize: FontSize.sm, fontWeight: '700' },

  // Notes Save Button
  notesSaveBtn: {
    flexDirection: 'row', alignItems: 'center',
    paddingVertical: Spacing.sm, paddingHorizontal: Spacing.lg,
    borderRadius: BorderRadius.lg,
  },
  notesSaveText: { fontSize: FontSize.sm, fontWeight: '700' },

  notesInput: {
    minHeight: 100, borderRadius: BorderRadius.lg, padding: Spacing.md,
    fontSize: 13, borderWidth: 1, fontFamily: 'monospace',
  },

  // Enhanced Pills
  enhancedPillRow: {
    flexDirection: 'row', borderRadius: BorderRadius.lg, borderWidth: 1, padding: 4, gap: 4, flexWrap: 'wrap',
  },
  enhancedPill: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
    paddingVertical: Spacing.sm, borderRadius: BorderRadius.md,
    borderWidth: 1, borderColor: 'transparent', minWidth: 80,
  },
  enhancedPillText: { fontSize: 12 },
  pillActiveDot: { width: 6, height: 6, borderRadius: 3 },

  // Enhanced Count - Slider style
  countBadge: {
    borderRadius: BorderRadius.full, paddingHorizontal: Spacing.md, paddingVertical: Spacing.xs,
  },
  countBadgeText: { fontSize: FontSize.md, fontWeight: '800' },
  countSliderContainer: {
    borderRadius: BorderRadius.lg, borderWidth: 1,
    padding: Spacing.md, gap: Spacing.md,
  },
  countSliderTrack: {
    height: 4, borderRadius: 2, backgroundColor: 'transparent',
  },
  countSliderFill: { height: 4, borderRadius: 2 },
  countSliderDots: {
    flexDirection: 'row', justifyContent: 'space-between',
    marginTop: -4,
  },
  countSliderDotWrap: { alignItems: 'center', gap: 4, padding: 2 },
  countSliderDot: {
    width: 10, height: 10, borderRadius: 5,
  },
  countSliderDotLabel: { fontSize: 10 },

  // Manual Count - Chips
  manualCountSliderDots: {
    flexDirection: 'row', justifyContent: 'space-between',
  },
  manualCountDot: {
    width: 8, height: 8, borderRadius: 4,
  },
  manualCountChips: {
    flexDirection: 'row', gap: Spacing.xs, flexWrap: 'wrap',
    alignItems: 'center',
  },
  manualCountChip: {
    paddingVertical: Spacing.sm, paddingHorizontal: Spacing.md,
    borderRadius: BorderRadius.md, borderWidth: 1, borderColor: 'transparent',
  },
  manualCountChipText: { fontSize: FontSize.sm, fontWeight: '600', color: '#8B5CF6' },
  manualCountChipInput: {
    borderRadius: BorderRadius.md, borderWidth: 1,
    paddingVertical: Spacing.sm, paddingHorizontal: Spacing.md,
    minWidth: 60, alignItems: 'center',
  },
  manualCountInput: { fontSize: FontSize.sm, fontWeight: '600', textAlign: 'center', minWidth: 40 },

  // Enhanced Save Button
  enhancedSaveBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingVertical: Spacing.md, paddingHorizontal: Spacing.xl,
    borderRadius: BorderRadius.lg,
    boxShadow: '0 3px 6px rgba(0,0,0,0.2)',
  },
  saveBtnInner: { flexDirection: 'row', alignItems: 'center' },
  enhancedSaveBtnText: { fontSize: FontSize.md, fontWeight: '700' },

  // Old pill (keep for reference but not used in new code)
  pillRow: { flexDirection: 'row', borderRadius: BorderRadius.lg, borderWidth: 1, padding: 3 },
  pill: { flex: 1, paddingVertical: Spacing.sm, borderRadius: BorderRadius.md, alignItems: 'center' },
  pillText: { fontSize: 11, fontWeight: '500' },
  countDot: {
    width: 36, height: 36, borderRadius: 18,
    alignItems: 'center', justifyContent: 'center',
  },
  saveBtn: {
    paddingVertical: Spacing.md, borderRadius: BorderRadius.md,
    alignItems: 'center', justifyContent: 'center', flexDirection: 'row',
  },
  saveBtnText: { fontSize: FontSize.md, fontWeight: '600' },
  // Green indicator
  greenIndicator: {
    flexDirection: 'row', alignItems: 'center', gap: Spacing.xs,
    paddingVertical: Spacing.sm, paddingHorizontal: Spacing.md,
    borderRadius: BorderRadius.md, borderWidth: 1,
  },
  greenText: { fontSize: FontSize.sm, fontWeight: '600' },
  // Terminal styles for logs
  terminal: { borderRadius: BorderRadius.xl, padding: Spacing.lg, borderWidth: 1 },
  terminalLine: { flexDirection: 'row', gap: Spacing.sm, marginBottom: 6 },
  terminalTime: { fontSize: 10, fontWeight: '700', letterSpacing: 0.5, fontFamily: 'monospace' },
  terminalText: { fontSize: 11, flex: 1, fontFamily: 'monospace' },
  terminalFooter: { flexDirection: 'row', justifyContent: 'flex-end', alignItems: 'center', marginTop: Spacing.sm, paddingTop: Spacing.sm, borderTopWidth: 1 },
});
