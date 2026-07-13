import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet, ScrollView, ActivityIndicator,
  Modal, Alert, KeyboardAvoidingView, Platform,
} from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useTheme, Spacing, BorderRadius, FontSize } from '../lib/theme';
import { AppStorage } from '../lib/storage';
import { chatWithAI } from '../lib/api';
import { Conversation, ConversationMessage, Group, Section, TestResult } from '../lib/types';
import { generateUniqueId } from '../lib/utils';
import { getAllGroups, getAllSections, getSection, initializeData } from '../lib/section-store';
import { persistLog } from '../lib/logs';

const PROVIDER_NAMES: Record<string, string> = {
  openrouter: 'OpenRouter',
  gemini: 'Google Gemini',
  mistral: 'Mistral AI',
};

export default function AIChatScreen() {
  const router = useRouter();
  const { colors: C } = useTheme();
  const scrollRef = useRef<ScrollView>(null);

  // Provider state
  const [activeProvider, setActiveProvider] = useState<'openrouter' | 'gemini' | 'mistral'>('openrouter');
  const [activeModel, setActiveModel] = useState('');
  const [apiKey, setApiKey] = useState('');
  const [geminiApiKey, setGeminiApiKey] = useState('');
  const [mistralApiKey, setMistralApiKey] = useState('');

  // Conversation state
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [activeConversationId, setActiveConversationId] = useState<string | null>(null);
  const [messages, setMessages] = useState<ConversationMessage[]>([]);
  const [inputText, setInputText] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  // UI state
  const [showSidebar, setShowSidebar] = useState(false);
  const [showTestPicker, setShowTestPicker] = useState(false);
  const [renamingConv, setRenamingConv] = useState<string | null>(null);
  const [renameText, setRenameText] = useState('');
  const [providerLabel, setProviderLabel] = useState('');

  // Test picker state
  const [groups, setGroups] = useState<Group[]>([]);
  const [allSections, setAllSections] = useState<Section[]>([]);
  const [selectedGroupId, setSelectedGroupId] = useState<string | null>(null);
  const [selectedSectionId, setSelectedSectionId] = useState<string | null>(null);
  const [selectedSectionTests, setSelectedSectionTests] = useState<TestResult[]>([]);

  // Attached test visual state
  const [attachedTest, setAttachedTest] = useState<{
    sectionId: string;
    sectionName: string;
    testId: string;
    testName: string;
  } | null>(null);

  // Custom instructions state
  const [customInstructions, setCustomInstructions] = useState('');
  const [showSettingsModal, setShowSettingsModal] = useState(false);
  const [settingsInstructions, setSettingsInstructions] = useState('');
  const [instructionsSaved, setInstructionsSaved] = useState(false);


  // Log helper
  const logAction = (text: string, color?: string) => {
    persistLog('ai-chat', text, color);
  };
  // Refresh provider & conversation data when screen is focused
  useFocusEffect(
    useCallback(() => {
      (async () => {
        const provider = await AppStorage.getAiProvider();
        const orKey = await AppStorage.getOpenRouterKey() || '';
        const gKey = await AppStorage.getGeminiKey() || '';
        const mKey = await AppStorage.getMistralKey() || '';
        const orModel = await AppStorage.getOpenRouterModel() || '';
        const gModel = await AppStorage.getGeminiModel() || '';
        const mMistralModel = await AppStorage.getMistralModel() || '';

        setActiveProvider(provider);
        setApiKey(orKey);
        setGeminiApiKey(gKey);
        setMistralApiKey(mKey);

        let model = '';
        if (provider === 'gemini') model = gModel || 'gemini-2.0-flash';
        else if (provider === 'mistral') model = mMistralModel || 'mistral-small-latest';
        else model = orModel || 'meta-llama/llama-3.3-70b-instruct:free';
        setActiveModel(model);
        setProviderLabel(`${PROVIDER_NAMES[provider] || provider} - ${model}`);

        // Load conversations
        const convs = await AppStorage.getConversations();
        if (convs && Array.isArray(convs)) {
          setConversations(convs);
          const activeId = await AppStorage.getActiveConversation();
          if (activeId) {
            const active = convs.find((c) => c.id === activeId);
            if (active) {
              setActiveConversationId(activeId);
              setMessages(active.messages || []);
              setAttachedTest(active.activeTestContext || null);
            }
          }
        }

        // Load groups and sections for test picker
        const gData = getAllGroups();
        setGroups(gData);
        const sData = getAllSections();
        setAllSections(sData);

        // Load custom instructions
        const savedInstructions = await AppStorage.getCustomInstructions() || '';
        setCustomInstructions(savedInstructions);
        setSettingsInstructions(savedInstructions);
      })();
    }, [])
  );

  // Auto-scroll to bottom
  useEffect(() => {
    if (messages.length > 0) {
      setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 100);
    }
  }, [messages.length]);

  // Save conversations helper
  const saveConversations = useCallback(async (convs: Conversation[]) => {
    setConversations(convs);
    await AppStorage.setConversations(convs);
  }, []);

  // Create new conversation
  const handleNewConversation = useCallback(() => {
    const newConv: Conversation = {
      id: generateUniqueId('conv'),
      title: 'New Conversation',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      messages: [],
      activeTestContext: null,
    };
    const updated = [newConv, ...conversations];
    saveConversations(updated);
    setActiveConversationId(newConv.id);
    setMessages([]);
    setAttachedTest(null);
    AppStorage.setActiveConversation(newConv.id);
    setShowSidebar(false);
    logAction('New conversation created.', '#10B981');
  }, [conversations, saveConversations]);

  // Select conversation
  const handleSelectConversation = useCallback((conv: Conversation) => {
    setActiveConversationId(conv.id);
    setMessages(conv.messages || []);
    setAttachedTest(conv.activeTestContext || null);
    AppStorage.setActiveConversation(conv.id);
    setShowSidebar(false);
  }, []);

  // Rename conversation
  const handleRenameConversation = useCallback((id: string) => {
    const updated = conversations.map(c => {
      if (c.id === id) {
        return { ...c, title: renameText || c.title, updatedAt: new Date().toISOString() };
      }
      return c;
    });
    saveConversations(updated);
    setRenamingConv(null);
    setRenameText('');
  }, [conversations, renameText, saveConversations]);

  // Delete conversation
  const handleDeleteConversation = useCallback((id: string) => {
    Alert.alert('Delete Conversation', 'Are you sure you want to delete this conversation?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete', style: 'destructive',
        onPress: () => {
          const updated = conversations.filter(c => c.id !== id);
          saveConversations(updated);
          if (activeConversationId === id) {
            if (updated.length > 0) {
              setActiveConversationId(updated[0].id);
              setMessages(updated[0].messages || []);
              setAttachedTest(updated[0].activeTestContext || null);
              AppStorage.setActiveConversation(updated[0].id);
            } else {
              setActiveConversationId(null);
              setMessages([]);
              setAttachedTest(null);
              AppStorage.removeActiveConversation();
            }
          }
        },
      },
    ]);
    logAction('Conversation deleted.', '#F43F5E');
  }, [conversations, activeConversationId, saveConversations]);

  // Save custom instructions
  const handleSaveInstructions = useCallback(async () => {
    await AppStorage.setCustomInstructions(settingsInstructions);
    setCustomInstructions(settingsInstructions);
    setInstructionsSaved(true);
    setTimeout(() => setInstructionsSaved(false), 2000);
  }, [settingsInstructions]);
  // Remove attached test
  const handleRemoveAttachedTest = useCallback(() => {
    setAttachedTest(null);
    if (activeConversationId) {
      const updatedConvs = conversations.map(c => {
        if (c.id === activeConversationId) {


          return {
            ...c,
            activeTestContext: null,
            updatedAt: new Date().toISOString(),
          };
        }
        return c;
      });
      saveConversations(updatedConvs);
    }
    logAction("Test context removed from conversation.", "#F59E0B");
  }, [activeConversationId, conversations, saveConversations]);

  // Send message
  const handleSend = useCallback(async () => {
    if (!inputText.trim() || isLoading) return;
    const text = inputText.trim();
    setInputText('');

    const userMessage: ConversationMessage = {
      id: generateUniqueId('msg'),
      role: 'user',
      content: text,
      timestamp: new Date().toISOString(),
    };

    const updatedMessages = [...messages, userMessage];
    setMessages(updatedMessages);
    setIsLoading(true);

    try {
      const activeConv = conversations.find(c => c.id === activeConversationId);
      const testContext = activeConv?.activeTestContext || attachedTest;
      const instructions = customInstructions;

      const apiMessages: { role: string; content: string }[] = [];

      // Add custom instructions as system prompt if provided
      if (instructions.trim()) {
        apiMessages.push({
          role: 'system',
          content: `Custom Instructions for the AI Assistant:\n${instructions.trim()}\n\nFollow these instructions carefully when responding to the user.`,
        });
      }

      // Add test context with full test data if a test is attached
      if (testContext) {
        // Load full test data from section store
        const section = getSection(testContext.sectionId);
        const test = section?.testResults.find(t => t.id === testContext.testId);

        if (test) {
          const questionsDetail = test.questions.map((q, i) => {
            const userAnswer = test.answers[q.id];
            const isCorrect = userAnswer === q.correctAnswer;
            return `Q${i + 1}: ${q.question}
  Options: ${q.options.map((o, oi) => `${String.fromCharCode(65 + oi)}. ${o}`).join(' | ')}
  Correct Answer: ${String.fromCharCode(65 + q.correctAnswer)}
  User Answer: ${userAnswer !== undefined ? String.fromCharCode(65 + userAnswer) : 'Not answered'}
  Result: ${isCorrect ? 'Correct' : 'Incorrect'}
  Topic: ${q.topic || 'General'}
  Explanation: ${q.explanation || 'N/A'}`;
          }).join('\n\n');

          const topicBreakdown = [...new Set((test.questions || []).map(q => q.topic).filter(Boolean))].join(', ');

          apiMessages.push({
            role: 'system',
            content: `You are analyzing the following test data for the user.

TEST DETAILS:
- Test Name: "${test.name}"
- Section: "${section?.name || testContext.sectionName}"
- Date: ${test.date}
- Score: ${test.score}/${test.totalQuestions} (${test.totalQuestions > 0 ? Math.round((test.score / test.totalQuestions) * 100) : 0}%)
- Time Taken: ${test.timeTaken ? Math.floor(test.timeTaken / 60) + 'm ' + (test.timeTaken % 60) + 's' : 'N/A'}
- Topics Covered: ${topicBreakdown || 'General'}
- Total Questions: ${test.questions.length}

${test.scoreReport ? `PERFORMANCE REPORT:\n${test.scoreReport}\n\n` : ''}

FULL QUESTION DETAILS:
${questionsDetail}

Please use this data to answer the user's questions about this test. You can:
- Analyze performance and identify weak areas
- Explain correct answers for questions they got wrong
- Provide recommendations for improvement
- Generate similar practice questions
- Discuss the test content in detail

The user's query follows below.`,
          });
        } else {
          // Fallback if no full test data found
          apiMessages.push({
            role: 'system',
            content: `You are an AI assistant helping with test analysis. The user is currently discussing the test "${testContext.testName}" from section "${testContext.sectionName}". Use this context to answer questions about the test.`,
          });
        }
      }

      // Add conversation history (last 10 messages, excluding system)
      const history = updatedMessages
        .filter(m => m.role !== 'system')
        .slice(-10)
        .map(m => ({
          role: m.role,
          content: m.content,
        }));
      apiMessages.push(...history);

      const response = await chatWithAI(
        activeProvider, activeModel,
        apiKey, geminiApiKey, mistralApiKey,
        apiMessages
      );

      const assistantMessage: ConversationMessage = {
        id: generateUniqueId('msg'),
        role: 'assistant',
        content: response,
        timestamp: new Date().toISOString(),
      };

      const finalMessages = [...updatedMessages, assistantMessage];
      setMessages(finalMessages);

      if (activeConversationId) {
        const updatedConvs = conversations.map(c => {
          if (c.id === activeConversationId) {
            return {
              ...c,
              messages: finalMessages,
              activeTestContext: testContext,
              updatedAt: new Date().toISOString(),
              title: c.title === 'New Conversation' && finalMessages.length > 0
                ? finalMessages[0].content.substring(0, 50)
                : c.title,
            };
          }
          return c;
        });
        saveConversations(updatedConvs);
      }
    } catch (err: any) {
      const errorMsg: ConversationMessage = {
        id: generateUniqueId('msg'),
        role: 'assistant',
        content: `Error: ${err.message || 'Failed to get response'}`,
        timestamp: new Date().toISOString(),
      };
      setMessages(prev => [...prev, errorMsg]);
    } finally {
      setIsLoading(false);
    }
  }, [inputText, isLoading, messages, activeConversationId, conversations, activeProvider, activeModel, apiKey, geminiApiKey, mistralApiKey, customInstructions, attachedTest, saveConversations]);

  // Handle test selection from picker - robust with fallbacks
  const handleSelectTest = useCallback((test: TestResult) => {
    // Robust section lookup: try test.config.sectionId, then selectedSectionId, then search all sections
    let section = allSections.find(s => s.id === test.config?.sectionId);
    if (!section && selectedSectionId) {
      section = allSections.find(s => s.id === selectedSectionId);
    }
    if (!section) {
      // Search all sections for one that contains this test
      section = allSections.find(s => s.testResults?.some(t => t.id === test.id));
    }
    if (!section) {
      Alert.alert('Error', 'Could not find the section for this test. Please try again.');
      return;
    }

    const testContext = {
      sectionId: section.id,
      sectionName: section.name,
      testId: test.id,
      testName: test.name,
    };

    // Build a comprehensive system message with full test data
    const questionsDetail = test.questions.map((q, i) => {
      const userAnswer = test.answers[q.id];
      const isCorrect = userAnswer === q.correctAnswer;
      return `Q${i + 1}: ${q.question}
Options: ${q.options.map((o, oi) => `${String.fromCharCode(65 + oi)}. ${o}`).join(' | ')}
Correct Answer: ${String.fromCharCode(65 + q.correctAnswer)}
User Answer: ${userAnswer !== undefined ? String.fromCharCode(65 + userAnswer) : 'Not answered'}
Result: ${isCorrect ? 'Correct' : 'Incorrect'}
Topic: ${q.topic || 'General'}
Explanation: ${q.explanation || 'N/A'}`;
    }).join('\n\n');

    const topicBreakdown = [...new Set((test.questions || []).map(q => q.topic).filter(Boolean))].join(', ');

    const contextMsg: ConversationMessage = {
      id: generateUniqueId('msg'),
      role: 'system',
      content: `📊 Test Loaded: "${test.name}"
━━━━━━━━━━━━━━━━━━━━━━━
Section: ${section.name}
Date: ${test.date}
Score: ${test.score}/${test.totalQuestions} (${test.totalQuestions > 0 ? Math.round((test.score / test.totalQuestions) * 100) : 0}%)
Topics: ${topicBreakdown || 'General'}
Questions: ${test.questions.length}
━━━━━━━━━━━━━━━━━━━━━━━

What would you like to know about this test?`,
      timestamp: new Date().toISOString(),
    };

    const updatedMessages = [...messages, contextMsg];
    setMessages(updatedMessages);
    setShowTestPicker(false);
    setAttachedTest(testContext);
    // Reset picker drill-down state
    setSelectedGroupId(null);
    logAction('Test attached to conversation: ' + test.name, '#10B981');
    setSelectedSectionId(null);
    setSelectedSectionTests([]);

    if (activeConversationId) {
      const updatedConvs = conversations.map(c => {
        if (c.id === activeConversationId) {
          return {
            ...c,
            messages: updatedMessages,
            activeTestContext: testContext,
            updatedAt: new Date().toISOString(),
          };
        }
        return c;
      });
      saveConversations(updatedConvs);
    }
  }, [allSections, selectedSectionId, messages, activeConversationId, conversations, saveConversations]);

  const getSectionsForGroup = (groupId: string) => {
    return allSections.filter(s => s.groupId === groupId);
  };

  return (
    <View style={[styles.container, { backgroundColor: C.background }]}>
      {/* Header - Absolute top with no spacing */}
      <View style={[styles.header, { backgroundColor: C.card, borderBottomColor: C.border }]}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={24} color={C.foreground} />
        </TouchableOpacity>
        <View style={styles.headerCenter}>
          <Text style={[styles.headerTitle, { color: C.foreground }]} numberOfLines={1}>AI Chat</Text>
          <View style={{ flexDirection: "row", alignItems: "center", gap: Spacing.xs }}>
            <View style={[styles.providerPill, { backgroundColor: activeProvider === "openrouter" ? C.primary + "15" : activeProvider === "gemini" ? "#10B981" + "15" : "#8B5CF6" + "15" }]}>
              <Text style={{ fontSize: FontSize.xs, color: activeProvider === "openrouter" ? C.primary : activeProvider === "gemini" ? "#10B981" : "#8B5CF6", fontWeight: "700" }}>
                {activeProvider === "openrouter" ? "OR" : activeProvider === "gemini" ? "GM" : "MI"}
              </Text>
            </View>
            <Text style={[styles.headerSubtitle, { color: C.mutedForeground }]} numberOfLines={1}>
              {providerLabel}
            </Text>
          </View>
        </View>
        <View style={{ flexDirection: "row", alignItems: "center", gap: Spacing.xs }}>
          <TouchableOpacity onPress={() => setShowSettingsModal(true)} style={styles.headerIconBtn}>
            <Ionicons name="settings-outline" size={22} color={C.primary} />
          </TouchableOpacity>
          <TouchableOpacity onPress={() => setShowSidebar(true)} style={styles.sidebarBtn}>
            <Ionicons name="chatbubbles-outline" size={22} color={C.foreground} />
          </TouchableOpacity>
        </View>
      </View>

      {/* Attached Test Indicator */}
      {attachedTest && (
        <View style={[styles.attachedTestBar, { backgroundColor: C.primary + '12', borderBottomColor: C.border }]}>
          <View style={[styles.attachedTestIcon, { backgroundColor: C.primary + '20' }]}>
            <Ionicons name="document-text" size={16} color={C.primary} />
          </View>
          <View style={styles.attachedTestInfo}>
            <Text style={[styles.attachedTestName, { color: C.foreground }]} numberOfLines={1}>
              {attachedTest.testName}
            </Text>
            <Text style={[styles.attachedTestSection, { color: C.mutedForeground }]} numberOfLines={1}>
              {attachedTest.sectionName}
            </Text>
          </View>
          <TouchableOpacity onPress={handleRemoveAttachedTest} style={styles.attachedTestRemove}>
            <Ionicons name="close-circle" size={20} color={C.mutedForeground} />
          </TouchableOpacity>
        </View>
      )}

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
      >
        <ScrollView
          ref={scrollRef}
          style={styles.messagesContainer}
          contentContainerStyle={styles.messagesContent}
          keyboardShouldPersistTaps="handled"
        >
          {messages.length === 0 ? (
            <View style={styles.emptyState}>
              <View style={[styles.emptyIcon, { backgroundColor: C.primary + '15' }]}>
                <Ionicons name="chatbubble-ellipses" size={40} color={C.primary} />
              </View>
              <Text style={[styles.emptyTitle, { color: C.foreground }]}>AI Chat Assistant</Text>
              <Text style={[styles.emptyDesc, { color: C.mutedForeground }]}>
                Ask questions about your tests, analyze results, or use the + button to load a specific test data.
              </Text>
              <TouchableOpacity
                style={[styles.emptyBtn, { backgroundColor: C.primary }]}
                onPress={() => { if (!activeConversationId) handleNewConversation(); }}
              >
                <Ionicons name="add-circle-outline" size={18} color={C.primaryForeground} />
                <Text style={[styles.emptyBtnText, { color: C.primaryForeground }]}>
                  {activeConversationId ? 'Start typing below' : 'New Conversation'}
                </Text>
              </TouchableOpacity>
            </View>
          ) : (
            messages.filter(m => m.role !== 'system').map((msg) => (
              <View
                key={msg.id}
                style={[
                  styles.messageBubble,
                  msg.role === 'user'
                    ? [styles.userBubble, { backgroundColor: C.primary }]
                    : [styles.assistantBubble, { backgroundColor: C.card, borderColor: C.border }],
                ]}
              >
                {msg.role === 'assistant' && (
                  <View style={[styles.assistantIcon, { backgroundColor: C.primary + '15' }]}>
                    <Ionicons name="shield-checkmark" size={14} color={C.primary} />
                  </View>
                )}
                <View style={{ flex: 1 }}>
                  <Text style={[styles.messageText, { color: msg.role === 'user' ? C.primaryForeground : C.foreground }]}>
                    {msg.content}
                  </Text>
                  <Text style={[styles.messageTime, { color: msg.role === 'user' ? C.primaryForeground + '99' : C.mutedForeground }]}>
                    {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </Text>
                </View>
              </View>
            ))
          )}
          {isLoading && (
            <View style={[styles.messageBubble, styles.assistantBubble, { backgroundColor: C.card, borderColor: C.border }]}>
              <View style={[styles.assistantIcon, { backgroundColor: C.primary + '15' }]}>
                <Ionicons name="shield-checkmark" size={14} color={C.primary} />
              </View>
              <ActivityIndicator size="small" color={C.primary} />
            </View>
          )}
        </ScrollView>

        {/* Input area */}
        <View style={[styles.inputContainer, { backgroundColor: C.card, borderTopColor: C.border }]}>
          <TouchableOpacity
            style={[styles.plusBtn, { backgroundColor: C.muted }]}
            onPress={() => setShowTestPicker(true)}
          >
            <Ionicons name="add" size={22} color={C.primary} />
          </TouchableOpacity>
          <TextInput
            style={[styles.textInput, { backgroundColor: C.muted, color: C.foreground }]}
            placeholder="Ask about your tests..."
            placeholderTextColor={C.mutedForeground}
            value={inputText}
            onChangeText={setInputText}
            multiline
            maxLength={2000}
            onSubmitEditing={handleSend}
            returnKeyType="send"
          />
          <TouchableOpacity
            style={[styles.sendBtn, { backgroundColor: inputText.trim() ? C.primary : C.muted }]}
            onPress={handleSend}
            disabled={!inputText.trim() || isLoading}
          >
            <Ionicons
              name="send"
              size={18}
              color={inputText.trim() ? C.primaryForeground : C.mutedForeground}
            />
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>

      {/* Settings Modal - Custom Instructions */}
      <Modal animationType="slide" transparent visible={showSettingsModal} onRequestClose={() => setShowSettingsModal(false)}>
        <View style={styles.overlay}>
          <View style={[styles.settingsContainer, { backgroundColor: C.card }]}>
            <View style={[styles.settingsHeader, { borderBottomColor: C.border }]}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: Spacing.sm }}>
                <Ionicons name="settings-outline" size={22} color={C.primary} />
                <Text style={[styles.settingsTitle, { color: C.foreground }]}>AI Settings</Text>
              </View>
              <TouchableOpacity onPress={() => setShowSettingsModal(false)}>
                <Ionicons name="close" size={22} color={C.mutedForeground} />
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.settingsBody}>
              <View style={styles.settingsSection}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, marginBottom: Spacing.sm }}>
                  <Ionicons name="book-outline" size={18} color={C.primary} />
                  <Text style={[styles.settingsSectionTitle, { color: C.foreground }]}>Custom Instructions</Text>
                </View>
                <Text style={[styles.settingsSectionDesc, { color: C.mutedForeground }]}>
                  These instructions will be included in every AI request. Use them to set the AI's behavior, tone, or add context.
                </Text>
                <TextInput
                  style={[styles.settingsInput, { backgroundColor: C.muted, color: C.foreground, borderColor: C.border }]}
                  placeholder="e.g., Always respond in Hindi, explain concepts simply, use examples..."
                  placeholderTextColor={C.mutedForeground}
                  value={settingsInstructions}
                  onChangeText={setSettingsInstructions}
                  multiline
                  textAlignVertical="top"
                />
                <TouchableOpacity
                  style={[styles.settingsSaveBtn, { backgroundColor: C.primary, opacity: 1 }]}
                  onPress={handleSaveInstructions}
                >
                  <Ionicons name={instructionsSaved ? "checkmark-circle" : "save-outline"} size={18} color={C.primaryForeground} />
                  <Text style={[styles.settingsSaveText, { color: C.primaryForeground }]}>
                    {instructionsSaved ? '  Saved!' : '  Save Instructions'}
                  </Text>
                </TouchableOpacity>
                {customInstructions.trim() && (
                  <View style={[styles.savedInfoBox, { backgroundColor: '#10B981' + '10', borderColor: '#10B981' + '20' }]}>
                    <Ionicons name="checkmark-circle" size={14} color="#10B981" />
                    <Text style={{ fontSize: FontSize.xs, color: '#10B981', fontWeight: '500', flex: 1 }}>
                      Custom instructions are active for all conversations
                    </Text>
                  </View>
                )}
              </View>

              <View style={[styles.settingsDivider, { backgroundColor: C.border }]} />

              <View style={styles.settingsSection}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, marginBottom: Spacing.sm }}>
                  <Ionicons name="information-circle-outline" size={18} color={C.mutedForeground} />
                  <Text style={[styles.settingsSectionTitle, { color: C.foreground }]}>About</Text>
                </View>
                <Text style={[styles.settingsSectionDesc, { color: C.mutedForeground }]}>
                  Active Provider: {PROVIDER_NAMES[activeProvider] || activeProvider}{'\n'}
                  Active Model: {activeModel || 'Not selected'}{'\n'}
                  Test Attached: {attachedTest ? attachedTest.testName : 'None'}
                </Text>
                <TouchableOpacity
                  style={[styles.settingsLinkBtn, { borderColor: C.border }]}
                  onPress={() => {
                    setShowSettingsModal(false);
                    router.push('/api-settings');
                  }}
                >
                  <Ionicons name="settings-outline" size={16} color={C.primary} />
                  <Text style={[styles.settingsLinkText, { color: C.primary }]}>  Open AI & Model Configuration</Text>
                </TouchableOpacity>
              </View>
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* Conversation sidebar modal */}
      <Modal animationType="slide" transparent visible={showSidebar} onRequestClose={() => setShowSidebar(false)}>
        <View style={styles.overlay}>
          <View style={[styles.sidebar, { backgroundColor: C.card }]}>
            <View style={[styles.sidebarHeader, { borderBottomColor: C.border }]}>
              <Text style={[styles.sidebarTitle, { color: C.foreground }]}>Conversations</Text>
              <TouchableOpacity onPress={() => setShowSidebar(false)}>
                <Ionicons name="close" size={22} color={C.mutedForeground} />
              </TouchableOpacity>
            </View>
            <TouchableOpacity style={[styles.newConvBtn, { backgroundColor: C.primary }]} onPress={handleNewConversation}>
              <Ionicons name="add" size={18} color={C.primaryForeground} />
              <Text style={[styles.newConvBtnText, { color: C.primaryForeground }]}>New Conversation</Text>
            </TouchableOpacity>
            <ScrollView style={styles.convList}>
              {conversations.length === 0 ? (
                <View style={{ padding: Spacing.xl, alignItems: 'center' }}>
                  <Text style={{ color: C.mutedForeground, fontSize: FontSize.sm }}>No conversations yet</Text>
                </View>
              ) : (
                conversations.map(conv => (
                  <TouchableOpacity
                    key={conv.id}
                    style={[
                      styles.convItem,
                      {
                        backgroundColor: conv.id === activeConversationId ? C.primary + '10' : 'transparent',
                        borderColor: conv.id === activeConversationId ? C.primary + '20' : 'transparent',
                      },
                    ]}
                    onPress={() => handleSelectConversation(conv)}
                  >
                    {renamingConv === conv.id ? (
                      <View style={styles.renameRow}>
                        <TextInput
                          style={[styles.renameInput, { backgroundColor: C.muted, color: C.foreground, borderColor: C.border }]}
                          value={renameText}
                          onChangeText={setRenameText}
                          autoFocus
                          onSubmitEditing={() => handleRenameConversation(conv.id)}
                        />
                        <TouchableOpacity onPress={() => handleRenameConversation(conv.id)}>
                          <Ionicons name="checkmark" size={18} color={C.primary} />
                        </TouchableOpacity>
                        <TouchableOpacity onPress={() => setRenamingConv(null)}>
                          <Ionicons name="close" size={16} color={C.mutedForeground} />
                        </TouchableOpacity>
                      </View>
                    ) : (
                      <>
                        <View style={{ flex: 1 }}>
                          <Text style={[styles.convTitle, { color: C.foreground }]} numberOfLines={1}>{conv.title}</Text>
                          <Text style={[styles.convDate, { color: C.mutedForeground }]}>
                            {new Date(conv.updatedAt).toLocaleDateString()}
                            {conv.messages.length > 0 && ` - ${conv.messages.length} messages`}
                            {conv.activeTestContext && ' • Test attached'}
                          </Text>
                        </View>
                        <TouchableOpacity onPress={() => { setRenamingConv(conv.id); setRenameText(conv.title); }} style={styles.convAction}>
                          <Ionicons name="pencil" size={14} color={C.mutedForeground} />
                        </TouchableOpacity>
                        <TouchableOpacity onPress={() => handleDeleteConversation(conv.id)} style={styles.convAction}>
                          <Ionicons name="trash-outline" size={14} color={C.destructive} />
                        </TouchableOpacity>
                      </>
                    )}
                  </TouchableOpacity>
                ))
              )}
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* Test picker modal */}
      <Modal animationType="slide" transparent visible={showTestPicker} onRequestClose={() => setShowTestPicker(false)}>
        <View style={styles.overlay}>
          <View style={[styles.pickerContainer, { backgroundColor: C.card }]}>
            <View style={[styles.pickerHeader, { borderBottomColor: C.border }]}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: Spacing.sm }}>
                <Ionicons name="folder-open-outline" size={20} color={C.primary} />
                <Text style={[styles.pickerTitle, { color: C.foreground }]}>
                  {!selectedGroupId ? 'Select Group' : !selectedSectionId ? 'Select Section' : 'Select Test'}
                </Text>
              </View>
              <TouchableOpacity onPress={() => { setShowTestPicker(false); setSelectedGroupId(null); setSelectedSectionId(null); setSelectedSectionTests([]); }}>
                <Ionicons name="close" size={22} color={C.mutedForeground} />
              </TouchableOpacity>
            </View>

            {/* Breadcrumb */}
            {(selectedGroupId || selectedSectionId) && (
              <View style={[styles.pickerBreadcrumb, { borderBottomColor: C.border }]}>
                <TouchableOpacity onPress={() => { setSelectedGroupId(null); setSelectedSectionId(null); setSelectedSectionTests([]); }}>
                  <Text style={{ fontSize: FontSize.sm, color: C.primary, fontWeight: '600' }}>Groups</Text>
                </TouchableOpacity>
                {selectedGroupId && (
                  <>
                    <Ionicons name="chevron-forward" size={14} color={C.mutedForeground} />
                    <TouchableOpacity onPress={() => { setSelectedSectionId(null); setSelectedSectionTests([]); }}>
                      <Text style={{ fontSize: FontSize.sm, color: C.primary, fontWeight: '600' }}>Sections</Text>
                    </TouchableOpacity>
                  </>
                )}
                {selectedSectionId && (
                  <>
                    <Ionicons name="chevron-forward" size={14} color={C.mutedForeground} />
                    <Text style={{ fontSize: FontSize.sm, color: C.mutedForeground, fontWeight: '500' }}>Tests</Text>
                  </>
                )}
              </View>
            )}

            <ScrollView style={styles.pickerList}>
              {/* Groups level */}
              {!selectedGroupId && groups.map(group => (
                <TouchableOpacity
                  key={group.id}
                  style={[styles.pickerItem, { borderBottomColor: C.border }]}
                  onPress={() => setSelectedGroupId(group.id)}
                >
                  <View style={[styles.pickerIcon, { backgroundColor: C.primary + '12' }]}>
                    <Ionicons name="folder" size={22} color={C.primary} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.pickerItemText, { color: C.foreground }]}>{group.name}</Text>
                    <Text style={[styles.pickerItemSub, { color: C.mutedForeground }]}>
                      {getSectionsForGroup(group.id).length} sections
                    </Text>
                  </View>
                  <Ionicons name="chevron-forward" size={18} color={C.mutedForeground} />
                </TouchableOpacity>
              ))}

              {/* Sections level */}
              {selectedGroupId && !selectedSectionId && getSectionsForGroup(selectedGroupId).map(section => (
                <TouchableOpacity
                  key={section.id}
                  style={[styles.pickerItem, { borderBottomColor: C.border }]}
                  onPress={() => {
                    setSelectedSectionId(section.id);
                    setSelectedSectionTests(section.testResults || []);
                  }}
                >
                  <View style={[styles.pickerIcon, { backgroundColor: '#10B981' + '15' }]}>
                    <Ionicons name="layers-outline" size={22} color="#10B981" />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.pickerItemText, { color: C.foreground }]}>{section.name}</Text>
                    <Text style={[styles.pickerItemSub, { color: C.mutedForeground }]}>
                      {(section.testResults || []).length} tests
                    </Text>
                  </View>
                  <Ionicons name="chevron-forward" size={18} color={C.mutedForeground} />
                </TouchableOpacity>
              ))}

              {/* Tests level */}
              {selectedSectionId && selectedSectionTests.map(test => (
                <TouchableOpacity
                  key={test.id}
                  style={[styles.pickerItem, { borderBottomColor: C.border }]}
                  onPress={() => handleSelectTest(test)}
                >
                  <View style={[styles.pickerIcon, { backgroundColor: '#8B5CF6' + '15' }]}>
                    <Ionicons name="document-text" size={22} color="#8B5CF6" />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.pickerItemText, { color: C.foreground }]}>{test.name}</Text>
                    <Text style={[styles.pickerItemSub, { color: C.mutedForeground }]}>
                      Score: {test.score}/{test.totalQuestions} • {new Date(test.date).toLocaleDateString()}
                    </Text>
                  </View>
                  <Ionicons name="add-circle" size={22} color={C.primary} />
                </TouchableOpacity>
              ))}

              {selectedGroupId && !selectedSectionId && getSectionsForGroup(selectedGroupId).length === 0 && (
                <View style={{ padding: Spacing.xl, alignItems: 'center' }}>
                  <Ionicons name="folder-open-outline" size={32} color={C.mutedForeground} />
                  <Text style={{ color: C.mutedForeground, fontSize: FontSize.sm, marginTop: Spacing.sm }}>No sections in this group</Text>
                </View>
              )}

              {selectedSectionId && selectedSectionTests.length === 0 && (
                <View style={{ padding: Spacing.xl, alignItems: 'center' }}>
                  <Ionicons name="document-text-outline" size={32} color={C.mutedForeground} />
                  <Text style={{ color: C.mutedForeground, fontSize: FontSize.sm, marginTop: Spacing.sm }}>No tests in this section</Text>
                </View>
              )}
            </ScrollView>
          </View>
        </View>
      </Modal>
    </View>
  );
}
const styles = StyleSheet.create({
  container: { flex: 1 },
  providerPill: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  headerIconBtn: {
    padding: Spacing.xs,
  },

  header: { flexDirection: 'row', alignItems: 'center', paddingTop: Platform.OS === 'ios' ? 50 : 0, paddingBottom: Spacing.sm, paddingHorizontal: Spacing.md, borderBottomWidth: 1, gap: Spacing.sm },
  backBtn: { padding: Spacing.xs },
  headerCenter: { flex: 1 },
  headerTitle: { fontSize: FontSize.lg, fontWeight: '700' },
  headerSubtitle: { fontSize: FontSize.xs, marginTop: 2 },
  sidebarBtn: { padding: Spacing.xs },

  // Attached test indicator
  attachedTestBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderBottomWidth: 1,
    gap: Spacing.sm,
  },
  attachedTestIcon: {
    width: 32,
    height: 32,
    borderRadius: BorderRadius.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },
  attachedTestInfo: { flex: 1 },
  attachedTestName: { fontSize: FontSize.sm, fontWeight: '600' },
  attachedTestSection: { fontSize: FontSize.xs, marginTop: 1 },
  attachedTestRemove: { padding: Spacing.xs },

  messagesContainer: { flex: 1 },
  messagesContent: { padding: Spacing.md, paddingBottom: Spacing.lg },
  emptyState: { alignItems: 'center', justifyContent: 'center', paddingVertical: 60, paddingHorizontal: Spacing.xl },
  emptyIcon: { width: 80, height: 80, borderRadius: 40, alignItems: 'center', justifyContent: 'center', marginBottom: Spacing.lg },
  emptyTitle: { fontSize: FontSize.xl, fontWeight: '700', marginBottom: Spacing.sm },
  emptyDesc: { fontSize: FontSize.md, textAlign: 'center', lineHeight: 22, marginBottom: Spacing.xl },
  emptyBtn: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, paddingVertical: Spacing.md, paddingHorizontal: Spacing.xl, borderRadius: BorderRadius.lg },
  emptyBtnText: { fontSize: FontSize.md, fontWeight: '600' },
  messageBubble: { flexDirection: 'row', gap: Spacing.sm, padding: Spacing.md, borderRadius: BorderRadius.lg, marginBottom: Spacing.sm, maxWidth: '90%' },
  userBubble: { alignSelf: 'flex-end', borderBottomRightRadius: 4 },
  assistantBubble: { alignSelf: 'flex-start', borderWidth: 1, borderBottomLeftRadius: 4 },
  assistantIcon: { width: 28, height: 28, borderRadius: 14, alignItems: 'center', justifyContent: 'center', marginTop: 2 },
  messageText: { fontSize: FontSize.md, lineHeight: 22, flexWrap: 'wrap' },
  messageTime: { fontSize: FontSize.xs, marginTop: 4, textAlign: 'right' },
  inputContainer: { flexDirection: 'row', alignItems: 'flex-end', paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm, borderTopWidth: 1, gap: Spacing.sm },
  plusBtn: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center', marginBottom: 4 },
  textInput: { flex: 1, maxHeight: 100, borderRadius: BorderRadius.xxl, paddingHorizontal: Spacing.lg, paddingVertical: Spacing.sm, fontSize: FontSize.md, marginBottom: 4 },
  sendBtn: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center', marginBottom: 4 },
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  sidebar: { height: '80%', borderTopLeftRadius: BorderRadius.xxl, borderTopRightRadius: BorderRadius.xxl, paddingTop: Spacing.lg },
  sidebarHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: Spacing.lg, paddingBottom: Spacing.md, borderBottomWidth: 1 },
  sidebarTitle: { fontSize: FontSize.xl, fontWeight: '700' },
  newConvBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: Spacing.sm, margin: Spacing.md, paddingVertical: Spacing.md, borderRadius: BorderRadius.lg },
  newConvBtnText: { fontSize: FontSize.md, fontWeight: '600' },
  convList: { flex: 1, paddingHorizontal: Spacing.md },
  convItem: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, padding: Spacing.md, borderRadius: BorderRadius.md, marginBottom: 4, borderWidth: 1 },
  convTitle: { fontSize: FontSize.md, fontWeight: '500' },
  convDate: { fontSize: FontSize.xs, marginTop: 2 },
  convAction: { padding: Spacing.xs },
  renameRow: { flexDirection: 'row', alignItems: 'center', flex: 1, gap: Spacing.xs },
  renameInput: { flex: 1, height: 34, borderRadius: BorderRadius.sm, paddingHorizontal: Spacing.sm, fontSize: FontSize.sm, borderWidth: 1 },
  pickerContainer: { height: '70%', borderTopLeftRadius: BorderRadius.xxl, borderTopRightRadius: BorderRadius.xxl, paddingTop: Spacing.lg },
  pickerHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: Spacing.lg, paddingBottom: Spacing.md, borderBottomWidth: 1 },
  pickerTitle: { fontSize: FontSize.xl, fontWeight: '700' },
  pickerBreadcrumb: { flexDirection: 'row', alignItems: 'center', gap: Spacing.xs, paddingHorizontal: Spacing.lg, paddingVertical: Spacing.sm, borderBottomWidth: 1 },
  pickerList: { flex: 1, paddingHorizontal: Spacing.md },
  pickerItem: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md, paddingVertical: Spacing.lg, borderBottomWidth: 1 },
  pickerIcon: { width: 44, height: 44, borderRadius: BorderRadius.md, alignItems: 'center', justifyContent: 'center' },
  pickerItemText: { fontSize: FontSize.md, fontWeight: '500' },
  pickerItemSub: { fontSize: FontSize.xs, marginTop: 2 },

  // Settings modal
  settingsContainer: { height: '75%', borderTopLeftRadius: BorderRadius.xxl, borderTopRightRadius: BorderRadius.xxl, paddingTop: Spacing.lg },
  settingsHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: Spacing.lg, paddingBottom: Spacing.md, borderBottomWidth: 1 },
  settingsTitle: { fontSize: FontSize.xl, fontWeight: '700' },
  settingsBody: { flex: 1, padding: Spacing.lg },
  settingsSection: { marginBottom: Spacing.lg },
  settingsSectionTitle: { fontSize: FontSize.md, fontWeight: '700' },
  settingsSectionDesc: { fontSize: FontSize.sm, lineHeight: 20, marginBottom: Spacing.md },
  settingsInput: { minHeight: 120, borderRadius: BorderRadius.lg, padding: Spacing.md, fontSize: FontSize.sm, borderWidth: 1, textAlignVertical: 'top' },
  settingsSaveBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: Spacing.md, borderRadius: BorderRadius.lg, marginTop: Spacing.md },
  settingsSaveText: { fontSize: FontSize.md, fontWeight: '600' },
  savedInfoBox: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, padding: Spacing.sm, borderRadius: BorderRadius.md, marginTop: Spacing.sm, borderWidth: 1 },
  settingsDivider: { height: 1, marginVertical: Spacing.sm },
  settingsLinkBtn: { flexDirection: 'row', alignItems: 'center', paddingVertical: Spacing.sm, paddingHorizontal: Spacing.md, borderRadius: BorderRadius.md, borderWidth: 1, alignSelf: 'flex-start', marginTop: Spacing.sm },
  settingsLinkText: { fontSize: FontSize.sm, fontWeight: '600' },
});

