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
  const [questionCount, setQuestionCount] = useState(70);
  const [oneLinerMode, setOneLinerMode] = useState(true);
  const [pastedJson, setPastedJson] = useState('');
  const [parseError, setParseError] = useState<string | null>(null);

  const prompt = useMemo(() => {
    let text = "Generate up to " + questionCount + " UNIQUE multiple-choice questions.\n\n";
    text += "DIFFICULTY LEVEL: " + difficulty.toUpperCase() + "\n";
    text += "Create moderately challenging questions for competitive government exam preparation.\n";
    text += "Focus on conceptual understanding, application, exam-style reasoning, analytical thinking, elimination skills, and connections between related ideas.\n\n";
    if (oneLinerMode) {
    text += "QUESTION FORMAT:\n";
    text += "- Each question must be a short, single-line one-liner\n";
    text += "- Maximum 15 words\n";
    text += "- Strictly no multi-part questions\n";
    text += "- Strictly no long descriptions\n";
  } else {
    text += "QUESTION FORMAT: Standard format with detailed questions.\n";
  }
  text += "\n";
    text += "LANGUAGE: " + language.toUpperCase() + "\n\n";
    text += "=== INSTRUCTIONS ===\n\n";
    text += "Based on the provided study material, generate questions that cover every possible topic, subtopic, concept, and important detail from the source.\n\n";
    text += "1. Generate exactly " + questionCount + " questions if the source supports that many unique questions.\n";
    text += "2. If the source has fewer than " + questionCount + " usable unique ideas, generate only the maximum high-quality questions possible.\n";
    text += "3. Cover all topics and subtopics from the source as completely as possible.\n";
    text += "4. You may also create logically inferred source-based questions from the same topic and subtopic, as long as they remain correct and relevant.\n";
    text += "5. Each question must have exactly 4 options: A, B, C, D.\n";
    text += "6. Only one option should be correct.\n";
    text += "7. Include a short explanation for each answer.\n";
    text += "8. Add a topic tag for each question.\n";
    text += "9. Do not repeat the same concept, fact, or idea across questions.\n";
    text += "10. Randomize the correct answer position across all questions.\n";
    text += "11. Do not place correct answers only in the same fixed option positions.\n";
    text += "12. Distribute correct answers randomly among A, B, C, and D.\n\n";
    text += "OUTPUT FORMAT:\n";
    text += "Return ONLY valid JSON in the following structure:\n";
    text += "\n";
    text += "{\n";
    text += "  \"questions\": [\n";
    text += "    {\n";
    text += "      \"question\": \"What is the capital of France?\",\n";
    text += "      \"options\": [\"London\", \"Paris\", \"Berlin\", \"Madrid\"],\n";
    text += "      \"correctAnswer\": 1,\n";
    text += "      \"explanation\": \"Paris is the capital of France.\",\n";
    text += "      \"topic\": \"Geography\"\n";
    text += "    }\n";
    text += "  ]\n";
    text += "}\n\n";
    text += "IMPORTANT:\n";
    text += "- Return only JSON, no markdown, no extra text.\n";
    text += "- Keep all questions unique.\n";
    text += "- Keep all options plausible.\n";
    text += "- Ensure explanations are concise and clear.\n";
    text += "- Maintain exam-style wording and medium difficulty.\n";
    text += "- Use the source material as the primary basis, but include logically valid inferred questions where helpful.\n";
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
      const validated: Question[] = questionsData.slice(0, 70).map((q: any, i: number) => ({
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

          {/* Question count slider - 1 to 200 */}
          <View style={{ position: 'relative', height: 6, backgroundColor: C.border, borderRadius: 3, marginBottom: Spacing.sm }}>
            <View style={{
              position: 'absolute', left: 0, top: 0, height: 6, borderRadius: 3,
              backgroundColor: C.primary, width: `${((questionCount - 1) / 199) * 100}%`,
            }} />
          </View>
          <View style={{ flexDirection: 'row', gap: Spacing.xs, flexWrap: 'wrap', alignItems: 'center' }}>
            {[10, 20, 30, 50, 75, 100, 150, 200].map(n => (
              <TouchableOpacity key={n} onPress={() => setQuestionCount(n)}
                style={{
                  paddingVertical: Spacing.xs, paddingHorizontal: Spacing.sm,
                  borderRadius: BorderRadius.sm, borderWidth: 1,
                  borderColor: questionCount === n ? C.primary : C.border,
                  backgroundColor: questionCount === n ? C.primary + '15' : 'transparent',
                }}>
                <Text style={{
                  fontSize: FontSize.xs, fontWeight: questionCount === n ? '700' : '500',
                  color: questionCount === n ? C.primary : C.mutedForeground,
                }}>{n}</Text>
              </TouchableOpacity>
            ))}
            <View style={{
              borderRadius: BorderRadius.sm, borderWidth: 1, borderColor: C.border,
              paddingVertical: Spacing.xs, paddingHorizontal: Spacing.sm, minWidth: 50, alignItems: 'center',
            }}>
              <TextInput
                style={{ fontSize: FontSize.xs, fontWeight: '600', color: C.foreground, textAlign: 'center', minWidth: 30, padding: 0 }}
                value={[10, 20, 30, 50, 75, 100, 150, 200].includes(questionCount) ? '' : String(questionCount)}
                placeholder='Any'
                placeholderTextColor={C.mutedForeground}
                keyboardType='number-pad'
                onChangeText={(t) => {
                  const v = parseInt(t, 10);
                  if (!isNaN(v) && v >= 1 && v <= 200) { setQuestionCount(v); }
                }}
              />
            </View>
          </View>

          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
            <Text style={[styles.label, { color: C.foreground }]}><Ionicons name="flash-outline" size={14} color={C.foreground} />  One-Liner Mode</Text>
            <Switch value={oneLinerMode} onValueChange={setOneLinerMode}
              trackColor={{ false: C.border, true: C.primary + '60' }}
              thumbColor={oneLinerMode ? C.primary : C.mutedForeground}
            />
          </View>

          <TouchableOpacity style={[styles.copyBtn, { backgroundColor: C.secondary }]} onPress={() => { handleCopy(); }}>
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

          <TouchableOpacity style={[styles.generateBtn, { backgroundColor: C.primary }]} onPress={() => { handleGenerate(); }} disabled={!pastedJson.trim()}>
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



