import React, { useState, useMemo } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, Switch, Alert } from 'react-native';
import { Question, TestConfig, Difficulty, Language, StoredQuestion } from '../lib/types';
import * as Clipboard from 'expo-clipboard';
import { Ionicons } from '@expo/vector-icons';
import { useTheme, FontSize, Spacing, BorderRadius } from '../lib/theme';

interface Props {
  sectionName: string;
  storedQuestions: StoredQuestion[];
  onGenerateManualTest: (questions: Question[], config: TestConfig) => void;
}

export default function ManualTestGen({ sectionName, storedQuestions, onGenerateManualTest }: Props) {
  const { colors: C } = useTheme();
  const [isOpen, setIsOpen] = useState(false);
  const [language, setLanguage] = useState<Language>('english');
  const [difficulty, setDifficulty] = useState<Difficulty>('medium');
  const [questionCount, setQuestionCount] = useState(20);
  const [oneLinerMode, setOneLinerMode] = useState(false);
  const [pastedJson, setPastedJson] = useState('');
  const [parseError, setParseError] = useState<string | null>(null);

  const prompt = useMemo(() => {
    let text = `Generate ${questionCount} UNIQUE multiple-choice questions.\n\n`;
    text += `DIFFICULTY LEVEL: ${difficulty.toUpperCase()}\n`;
    text += `LANGUAGE: ${language}\n\n`;
    text += `QUESTION FORMAT: ${oneLinerMode ? 'ONE-LINER FORMAT' : 'STANDARD FORMAT'}\n\n`;
    text += `OUTPUT FORMAT - Return ONLY valid JSON:\n{\n  "questions": [\n    {\n      "question": "?",\n      "options": ["A", "B", "C", "D"],\n      "correctAnswer": 0,\n      "explanation": "...",\n      "topic": "Topic"\n    }\n  ]\n}`;
    return text;
  }, [language, difficulty, questionCount, oneLinerMode]);

  const handleCopy = async () => {
    try {
      if (typeof navigator !== 'undefined' && navigator.clipboard) {
        await navigator.clipboard.writeText(prompt);
      } else {
        await Clipboard.setStringAsync(prompt);
      }
      Alert.alert('Copied', 'Prompt copied to clipboard!');
    } catch (err) {
      console.warn('Clipboard copy failed:', err);
      Alert.alert('Error', 'Failed to copy prompt. Your device may not support clipboard access.');
    }
  };

  const handleGenerate = () => {
    setParseError(null);
    try {
      const trimmed = pastedJson.trim();
      let parsed: any;
      try { parsed = JSON.parse(trimmed); }
      catch {
        const jsonMatch = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/);
        if (jsonMatch) parsed = JSON.parse(jsonMatch[1].trim());
        else throw new Error('Invalid JSON format');
      }
      let questionsData: any[];
      if (parsed.questions && Array.isArray(parsed.questions)) questionsData = parsed.questions;
      else if (Array.isArray(parsed)) questionsData = parsed;
      else throw new Error('Response must contain a "questions" array');
      if (questionsData.length === 0) throw new Error('No questions found');
      const validated: Question[] = questionsData.slice(0, questionCount).map((q: any, i: number) => ({
        id: `q-manual-${Date.now()}-${i}`,
        question: String(q.question || ''),
        options: Array.isArray(q.options) ? q.options.map(String) : [],
        correctAnswer: typeof q.correctAnswer === 'number' ? q.correctAnswer : 0,
        explanation: String(q.explanation || ''),
        difficulty, topic: String(q.topic || 'General'),
      })).filter((q: Question) => q.question && q.options.length === 4);
      if (validated.length === 0) throw new Error('No valid questions with 4 options found');
      onGenerateManualTest(validated, { studyNotes: '', difficulty, questionCount: validated.length, language, customPrompt: '', oneLinerMode, sectionName });
      setPastedJson(''); setIsOpen(false);
    } catch (err: any) { setParseError(err.message); }
  };

  return (
    <View style={[styles.card, { backgroundColor: C.card, borderColor: C.border }]}>
      <TouchableOpacity style={styles.header} onPress={() => setIsOpen(!isOpen)}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: Spacing.md, flex: 1 }}>
          <Ionicons name="code-slash-outline" size={20} color={C.foreground} />
          <View>
            <Text style={[styles.headerTitle, { color: C.foreground }]}>Manual Test Generate</Text>
            <Text style={[styles.headerDesc, { color: C.mutedForeground }]}>Generate tests using external AI</Text>
          </View>
        </View>
        <Text style={{ fontSize: 14, color: C.mutedForeground }}>{isOpen ? '▲' : '▼'}</Text>
      </TouchableOpacity>

      {isOpen && (
        <View style={[styles.body, { borderTopColor: C.border }]}>
          <View style={{ flexDirection: 'row', gap: Spacing.md }}>
            <View style={{ flex: 1 }}>
              <Text style={[styles.label, { color: C.foreground }]}><Ionicons name="language-outline" size={14} color={C.foreground} />  Language</Text>
              {(['english', 'hindi', 'hinglish'] as Language[]).map(l => (
                <TouchableOpacity key={l} style={[styles.miniOption, { borderColor: C.border }, language === l && { borderColor: C.primary, backgroundColor: C.primary + '15' }]} onPress={() => setLanguage(l)}>
                  <Text style={[styles.miniOptionText, { color: C.mutedForeground }, language === l && { color: C.primary, fontWeight: '600' }]}>{l}</Text>
                </TouchableOpacity>
              ))}
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[styles.label, { color: C.foreground }]}><Ionicons name="options-outline" size={14} color={C.foreground} />  Difficulty</Text>
              {(['easy', 'medium', 'hard'] as Difficulty[]).map(d => (
                <TouchableOpacity key={d} style={[styles.miniOption, { borderColor: C.border }, difficulty === d && { borderColor: C.primary, backgroundColor: C.primary + '15' }]} onPress={() => setDifficulty(d)}>
                  <Text style={[styles.miniOptionText, { color: C.mutedForeground }, difficulty === d && { color: C.primary, fontWeight: '600' }, { textTransform: 'capitalize' }]}>{d}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          <Text style={[styles.label, { color: C.foreground }]}>Count: <Text style={{ color: C.primary }}>{questionCount}</Text></Text>
          <View style={{ flexDirection: 'row', gap: Spacing.xs }}>
            {[10, 20, 30, 40, 50].map(n => (
              <TouchableOpacity key={n} style={[styles.qCountBtn, { borderColor: C.border }, questionCount === n && { backgroundColor: C.primary, borderColor: C.primary }]} onPress={() => setQuestionCount(n)}>
                <Text style={[styles.qCountText, { color: C.mutedForeground }, questionCount === n && { color: C.primaryForeground }]}>{n}</Text>
              </TouchableOpacity>
            ))}
          </View>

          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
            <Text style={[styles.label, { color: C.foreground }]}><Ionicons name="flash-outline" size={14} color={C.foreground} />  One-Liner Mode</Text>
            <Switch value={oneLinerMode} onValueChange={setOneLinerMode}
              trackColor={{ false: C.border, true: C.primary + '60' }}
              thumbColor={oneLinerMode ? C.primary : C.mutedForeground}
            />
          </View>

          <TouchableOpacity style={[styles.copyBtn, { backgroundColor: C.secondary }]} onPress={handleCopy}>
            <Ionicons name="copy-outline" size={14} color={C.foreground} />
            <Text style={[styles.copyBtnText, { color: C.foreground }]}>  Copy Prompt</Text>
          </TouchableOpacity>
          <View style={[styles.promptBox, { backgroundColor: C.muted }]}>
            <Text style={[styles.promptText, { color: C.foreground }]} numberOfLines={8}>{prompt}</Text>
          </View>

          <TextInput style={[styles.jsonInput, { backgroundColor: C.muted, color: C.foreground, borderColor: C.border }]}
            multiline placeholder="Paste AI JSON response here..."
            placeholderTextColor={C.mutedForeground}
            value={pastedJson} onChangeText={t => { setPastedJson(t); setParseError(null); }}
            textAlignVertical="top"
          />
          {parseError && <Text style={{ fontSize: FontSize.sm, color: C.destructive }}>{parseError}</Text>}

          <TouchableOpacity style={[styles.generateBtn, { backgroundColor: C.primary }]} onPress={handleGenerate} disabled={!pastedJson.trim()}>
            <Ionicons name="play-outline" size={16} color={C.primaryForeground} />
            <Text style={[styles.generateBtnText, { color: C.primaryForeground }]}>  Generate Manual Test</Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: { borderRadius: BorderRadius.lg, borderWidth: 1 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: Spacing.lg, flexWrap: 'wrap', gap: Spacing.sm },
  headerTitle: { fontSize: FontSize.md, fontWeight: '600' },
  headerDesc: { fontSize: FontSize.sm },
  body: { borderTopWidth: 1, padding: Spacing.md, gap: Spacing.md },
  label: { fontSize: FontSize.sm, fontWeight: '500', marginBottom: Spacing.xs },
  miniOption: { paddingVertical: Spacing.sm, paddingHorizontal: Spacing.sm, borderRadius: BorderRadius.sm, borderWidth: 1, marginBottom: 4 },
  miniOptionText: { fontSize: FontSize.xs, textAlign: 'center' },
  qCountBtn: { flex: 1, paddingVertical: Spacing.sm, borderRadius: BorderRadius.sm, borderWidth: 1, alignItems: 'center' },
  qCountText: { fontSize: FontSize.sm },
  copyBtn: { padding: Spacing.md, borderRadius: BorderRadius.md, alignItems: 'center', justifyContent: 'center', flexDirection: 'row' },
  copyBtnText: { fontSize: FontSize.sm },
  promptBox: { padding: Spacing.md, borderRadius: BorderRadius.md },
  promptText: { fontSize: FontSize.xs, fontFamily: 'monospace', lineHeight: 16 },
  jsonInput: { minHeight: 100, borderRadius: BorderRadius.md, padding: Spacing.md, fontSize: FontSize.sm, borderWidth: 1, fontFamily: 'monospace' },
  generateBtn: { padding: Spacing.lg, borderRadius: BorderRadius.md, alignItems: 'center', justifyContent: 'center', flexDirection: 'row' },
  generateBtnText: { fontSize: FontSize.md, fontWeight: '600' },
});
