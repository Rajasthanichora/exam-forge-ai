import React, { useState, useEffect } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, ScrollView, Switch } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { TestConfig, Difficulty, Language, UploadedFile, SavedDocument } from '../lib/types';
import { useTheme, Spacing, BorderRadius, FontSize } from '../lib/theme';
import { combineContent } from '../lib/file-handler';
import FileUpload from './FileUpload';
import SavedDocumentsComponent from './SavedDocuments';

interface TestConfigFormProps {
  onStartTest: (config: TestConfig) => void;
  isLoading: boolean;
  hasApiKey: boolean;
  apiKeyLabel?: string;
  savedDocuments?: SavedDocument[];
  selectedDocIds?: string[];
  onSaveDocument?: (doc: { name: string; content: string; size: number }) => void;
  onRemoveDocument?: (docId: string) => void;
  onSelectDocuments?: (docs: SavedDocument[]) => void;
  pastedNotes?: string;
  onNotesChange?: (notes: string) => void;
  sectionName?: string;
}

const LANGUAGES: { value: Language; label: string }[] = [
  { value: 'english', label: 'English' },
  { value: 'hindi', label: 'Hindi' },
  { value: 'hinglish', label: 'Hinglish' },
];

const DIFFICULTIES: Difficulty[] = ['easy', 'medium', 'hard'];

export default function TestConfigForm({
  onStartTest, isLoading, hasApiKey, apiKeyLabel = 'API',
  savedDocuments = [], selectedDocIds = [],
  onSaveDocument, onRemoveDocument, onSelectDocuments,
  pastedNotes = '', onNotesChange, sectionName = 'Section',
}: TestConfigFormProps) {
  const { colors: C } = useTheme();
  const [inputMethod, setInputMethod] = useState<'paste' | 'upload' | 'saved'>('paste');
  const [notes, setNotes] = useState(pastedNotes);
  const [uploadedFiles, setUploadedFiles] = useState<UploadedFile[]>([]);
  const [difficulty, setDifficulty] = useState<Difficulty>('medium');
  const [questionCount, setQuestionCount] = useState(20);
  const [language, setLanguage] = useState<Language>('english');
  const [customPrompt, setCustomPrompt] = useState('');
  const [oneLinerMode, setOneLinerMode] = useState(false);

  useEffect(() => { setNotes(pastedNotes); }, [pastedNotes]);

  const handleNotesChange = (text: string) => {
    setNotes(text);
    onNotesChange?.(text);
  };

  const getCombinedContent = (): string => {
    const savedContent = savedDocuments
      .filter(doc => selectedDocIds.includes(doc.id))
      .map(doc => doc.content).join('\n\n---\n\n');
    const pastedContent = combineContent(notes, uploadedFiles);
    if (savedContent && pastedContent) return `${savedContent}\n\n---\n\n${pastedContent}`;
    return savedContent || pastedContent;
  };

  const totalContent = getCombinedContent();
  const hasContent = totalContent.trim().length > 0;

  const tabs: { key: typeof inputMethod; icon: string; label: string }[] = [
    { key: 'saved', icon: 'folder-open-outline', label: `Saved (${savedDocuments.length})` },
    { key: 'paste', icon: 'create-outline', label: 'Paste Notes' },
    { key: 'upload', icon: 'cloud-upload-outline', label: 'Upload' },
  ];

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {/* Upload Hero Section - matching configure.html exactly */}
      <View style={styles.uploadWrapper}>
        <View style={[styles.uploadGlow, { backgroundColor: C.primary + '15' }]} />
        <View style={[styles.uploadZone, { borderColor: C.border, backgroundColor: C.card }]}>
          <View style={[styles.uploadIcon, { backgroundColor: C.primary + '12' }]}>
            <Ionicons name="cloud-upload-outline" size={28} color={C.primary} />
          </View>
          <Text style={[styles.uploadText, { color: C.foreground }]} numberOfLines={2}>Drop your study materials here</Text>
          <Text style={[styles.uploadHint, { color: C.mutedForeground }]} numberOfLines={2}>Supports .docx and .txt (Max 50MB)</Text>
          <TouchableOpacity style={[styles.browseBtn, { backgroundColor: C.primary }]}
            onPress={() => {
              if (inputMethod !== 'upload') setInputMethod('upload');
            }}>
            <Text style={[styles.browseBtnText, { color: C.primaryForeground }]}>Browse Files</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Content & Settings Grid */}
      <View style={{ gap: Spacing.lg }}>
        {/* Tabs for input method */}
        <View style={[styles.tabRow, { backgroundColor: C.muted, borderColor: C.border }]}>
          {tabs.map(tab => (
            <TouchableOpacity
              key={tab.key}
              style={[styles.tab, inputMethod === tab.key && { backgroundColor: C.card }]}
              onPress={() => setInputMethod(tab.key)}
            >
              <Ionicons name={tab.icon as any} size={14} color={inputMethod === tab.key ? C.foreground : C.mutedForeground} />
              <Text style={[styles.tabLabel, { color: inputMethod === tab.key ? C.foreground : C.mutedForeground }]}>
                {' '}{tab.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Tab Content */}
        {inputMethod === 'paste' && (
          <View>
            <Text style={[styles.fieldLabel, { color: C.mutedForeground }]}>
              <Ionicons name="pencil" size={14} color={C.primary} />  Paste Your Notes
            </Text>
            <TextInput
              style={[styles.textArea, { backgroundColor: C.card, borderColor: C.border, color: C.foreground }]}
              multiline
              placeholder="Paste chapters, key points, or raw lecture notes here..."
              placeholderTextColor={C.mutedForeground + '60'}
              value={notes}
              onChangeText={handleNotesChange}
              textAlignVertical="top"
            />
          </View>
        )}
        {inputMethod === 'upload' && (
          <FileUpload
            uploadedFiles={uploadedFiles}
            onFilesProcessed={setUploadedFiles}
            onRemoveFile={(name) => setUploadedFiles(prev => prev.filter(f => f.name !== name))}
          />
        )}
        {inputMethod === 'saved' && onSaveDocument && onRemoveDocument && onSelectDocuments && (
          <SavedDocumentsComponent
            savedDocuments={savedDocuments}
            selectedDocIds={selectedDocIds}
            onSaveDocument={onSaveDocument}
            onRemoveDocument={onRemoveDocument}
            onSelectDocuments={onSelectDocuments}
          />
        )}

        {hasContent && (
          <View style={[styles.contentBadge, { backgroundColor: C.primary + '10', borderColor: C.primary + '30' }]}>
            <View style={[styles.dot, { backgroundColor: C.primary }]} />
            <Text style={[styles.contentText, { color: C.foreground }]}>{totalContent.length.toLocaleString()} characters ready</Text>
          </View>
        )}
      </View>

      {/* Parameters Section - Matching HTML configure page */}
      <View style={{ gap: Spacing.lg }}>
        {/* Difficulty */}
        <View>
          <Text style={[styles.fieldLabel, { color: C.mutedForeground }]}>Difficulty Level</Text>
          <View style={[styles.pillRow, { backgroundColor: C.muted, borderColor: C.border }]}>
            {DIFFICULTIES.map(d => (
              <TouchableOpacity
                key={d}
                style={[styles.pill, difficulty === d && { backgroundColor: C.card }]}
                onPress={() => setDifficulty(d)}
              >
                <Text style={[styles.pillText, { color: difficulty === d ? C.foreground : C.mutedForeground },
                  difficulty === d && { fontWeight: '600' }]}>
                  {d.charAt(0).toUpperCase() + d.slice(1)}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Question Count */}
        <View>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: Spacing.md }}>
            <Text style={[styles.fieldLabel, { color: C.mutedForeground }]}>Question Count</Text>
            <Text style={{ fontSize: FontSize.md, fontWeight: 'bold', color: C.primary }}>{questionCount}</Text>
          </View>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: Spacing.sm }}>
            <Text style={{ fontSize: FontSize.xs, color: C.mutedForeground }}>5</Text>
            <View style={{ flex: 1, height: 6, backgroundColor: C.muted, borderRadius: 3, position: 'relative' }}>
              <View style={[styles.sliderFill, { width: `${((questionCount - 5) / 45) * 100}%`, backgroundColor: C.primary }]} />
              <View style={[styles.sliderThumb, { left: `${((questionCount - 5) / 45) * 100}%`, backgroundColor: C.primary }]}>
                <Text style={{ fontSize: 8, color: C.primaryForeground, fontWeight: 'bold' }}>{questionCount}</Text>
              </View>
            </View>
            <Text style={{ fontSize: FontSize.xs, color: C.mutedForeground }}>50</Text>
          </View>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', paddingTop: Spacing.xs }}>
            {[5, 15, 25, 35, 50].map(n => (
              <TouchableOpacity key={n} onPress={() => setQuestionCount(n)}>
                <Text style={{ fontSize: 14, color: questionCount === n ? C.primary : C.mutedForeground }}>●</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Language */}
        <View>
          <Text style={[styles.fieldLabel, { color: C.mutedForeground }]}>Language</Text>
          <View style={[styles.pillRow, { backgroundColor: C.muted, borderColor: C.border }]}>
            {LANGUAGES.map(lang => (
              <TouchableOpacity
                key={lang.value}
                style={[styles.pill, language === lang.value && { backgroundColor: C.card }]}
                onPress={() => setLanguage(lang.value)}
              >
                <Text style={[styles.pillText, { color: language === lang.value ? C.foreground : C.mutedForeground },
                  language === lang.value && { fontWeight: '600' }]}>
                  {lang.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Custom Prompt */}
        <View>
          <Text style={[styles.fieldLabel, { color: C.mutedForeground }]}>Custom Instructions (Optional)</Text>
          <TextInput
            style={[styles.textArea, { minHeight: 80, backgroundColor: C.card, borderColor: C.border, color: C.foreground }]}
            multiline
            placeholder="Add specific instructions for the AI..."
            placeholderTextColor={C.mutedForeground + '60'}
            value={customPrompt}
            onChangeText={setCustomPrompt}
            textAlignVertical="top"
          />
        </View>

        {/* One-Liner Mode Toggle */}
        <View style={[styles.switchCard, { backgroundColor: C.muted + '60', borderColor: C.border }]}>
          <View style={{ flex: 1 }}>
            <Text style={[styles.switchLabel, { color: C.foreground }]}>One-liner Mode</Text>
            <Text style={[styles.switchDesc, { color: C.mutedForeground }]}>Short, concise questions only</Text>
          </View>
          <Switch
            value={oneLinerMode}
            onValueChange={setOneLinerMode}
            trackColor={{ false: C.border, true: C.primary + '60' }}
            thumbColor={oneLinerMode ? C.primary : C.mutedForeground}
          />
        </View>
      </View>

      {/* Action Bar - matching configure.html exactly */}
      <View style={[styles.actionBar, { borderTopColor: C.border }]}>
        <TouchableOpacity style={[styles.saveDraftBtn, { borderColor: C.border }]}>
          <Text style={[styles.saveDraftText, { color: C.mutedForeground }]}>Save Draft</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.generateBtn, { backgroundColor: C.primary },
            (!hasContent || isLoading || !hasApiKey) && { opacity: 0.5 }]}
          onPress={() => { onStartTest({

            studyNotes: totalContent, difficulty, questionCount, language, customPrompt, oneLinerMode,
          })}}

          disabled={!hasContent || isLoading || !hasApiKey}
        >
          {isLoading ? (
            <Text style={[styles.generateText, { color: C.primaryForeground }]}>Generating...</Text>
          ) : (
            <>
              <Ionicons name="sparkles" size={18} color={C.primaryForeground} />
              <Text style={[styles.generateText, { color: C.primaryForeground }]}>  Generate Test</Text>
            </>
          )}
        </TouchableOpacity>
      </View>

      {!hasApiKey && (
        <Text style={[styles.statusText, { color: C.destructive, textAlign: 'center' }]}>
          Please configure your {apiKeyLabel} API key in settings.
        </Text>
      )}
      {!hasContent && hasApiKey && (
        <Text style={[styles.statusText, { color: C.mutedForeground, textAlign: 'center' }]}>
          Add study material to generate a test.
        </Text>
      )}

      <View style={{ height: 40 }} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { gap: Spacing.md, paddingBottom: Spacing.xxxl * 2 },
  // Upload Zone
  uploadWrapper: { position: 'relative', overflow: 'visible' },
  uploadGlow: {
    position: 'absolute', top: -8, left: -8, right: -8, bottom: -8,
    borderRadius: BorderRadius.xl + 4, opacity: 0.5,
    backgroundColor: 'transparent',
    boxShadow: '0 0 20px rgba(79,70,229,0.25)',
  },
  uploadZone: {
    borderWidth: 2, borderStyle: 'dashed',
    borderRadius: BorderRadius.xl, padding: Spacing.xl,
    alignItems: 'center', gap: Spacing.md, position: 'relative', overflow: 'hidden',
  },
  uploadIcon: { width: 64, height: 64, borderRadius: 32, alignItems: 'center', justifyContent: 'center' },
  uploadText: { fontSize: FontSize.lg, fontWeight: '600', textAlign: 'center' },
  uploadHint: { fontSize: FontSize.sm, textAlign: 'center', marginBottom: Spacing.sm },
  browseBtn: { paddingVertical: Spacing.md, paddingHorizontal: Spacing.xxl, borderRadius: BorderRadius.md },
  browseBtnText: { fontSize: FontSize.md, fontWeight: '600' },
  // Tabs
  tabRow: { flexDirection: 'row', borderRadius: BorderRadius.md, borderWidth: 1, padding: 2 },
  tab: { flex: 1, paddingVertical: Spacing.sm, paddingHorizontal: Spacing.xs, alignItems: 'center', justifyContent: 'center', borderRadius: BorderRadius.sm, flexDirection: 'row', gap: Spacing.xs },
  tabLabel: { fontSize: 11, fontWeight: '500' },
  // Fields
  fieldLabel: { fontSize: 13, fontWeight: '500', marginBottom: Spacing.sm },
  textArea: { minHeight: 150, borderRadius: BorderRadius.lg, padding: Spacing.md, fontSize: 13, borderWidth: 1, fontFamily: 'monospace' },
  contentBadge: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, borderRadius: BorderRadius.md, padding: Spacing.sm, borderWidth: 1 },
  dot: { width: 8, height: 8, borderRadius: 4 },
  contentText: { fontSize: 13, fontWeight: '500' },
  // Difficulty / Language pills
  pillRow: { flexDirection: 'row', borderRadius: BorderRadius.lg, borderWidth: 1, padding: 3 },
  pill: { flex: 1, paddingVertical: Spacing.sm, borderRadius: BorderRadius.md, alignItems: 'center' },
  pillText: { fontSize: 11, fontWeight: '500' },
  // Slider
  sliderFill: { position: 'absolute', height: '100%', borderRadius: 3 },
  sliderThumb: {
    position: 'absolute', top: -10, width: 30, height: 26, borderRadius: 13,
    alignItems: 'center', justifyContent: 'center', marginLeft: -15,
  },
  // Switch
  switchCard: { flexDirection: 'row', alignItems: 'center', borderRadius: BorderRadius.lg, padding: Spacing.lg, borderWidth: 1, gap: Spacing.md },
  switchLabel: { fontSize: FontSize.md, fontWeight: '500' },
  switchDesc: { fontSize: FontSize.xs, marginTop: 2 },
  // Action bar
  actionBar: { flexDirection: 'row', gap: Spacing.md, paddingTop: Spacing.lg, borderTopWidth: 1, marginTop: Spacing.sm, flexWrap: 'wrap' },
  saveDraftBtn: { flex: 1, paddingVertical: Spacing.lg, borderRadius: BorderRadius.md, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  saveDraftText: { fontSize: FontSize.md, fontWeight: '600' },
  generateBtn: { flex: 1, paddingVertical: Spacing.lg, borderRadius: BorderRadius.md, alignItems: 'center', justifyContent: 'center', flexDirection: 'row' },
  generateText: { fontSize: FontSize.md, fontWeight: '600' },
  statusText: { fontSize: FontSize.sm },
});
