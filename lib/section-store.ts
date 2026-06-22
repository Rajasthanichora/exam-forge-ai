import { AppData, Group, Section, SavedDocument, StoredQuestion, TestResult, SimilarityReport } from './types';
import { hashQuestion, checkQuestionSimilarity, generateUniqueId } from './utils';
import { AppStorage } from './storage';

let cachedAppData: AppData | null = null;

function getDefaultAppData(): AppData {
  return {
    groups: [],
    sections: [],
    apiKey: '',
    geminiApiKey: '',
    aiProvider: 'openrouter',
    activeSectionId: null,
  };
}

// Load data from AsyncStorage (instant local-only)
export async function initializeData(): Promise<AppData> {
  const localData = await AppStorage.getAppData();
  const apiKey = (await AppStorage.getOpenRouterKey()) || '';
  const geminiApiKey = (await AppStorage.getGeminiKey()) || '';
  const aiProvider = await AppStorage.getAiProvider();

  let parsed: AppData;
  if (localData) {
    parsed = { ...getDefaultAppData(), ...localData, apiKey, geminiApiKey, aiProvider };
    // Ensure default group if no groups
    if (!parsed.groups || parsed.groups.length === 0) {
      parsed.groups = [{ id: generateUniqueId('group'), name: 'General', createdAt: new Date().toISOString() }];
      if (parsed.sections.length > 0) {
        parsed.sections = parsed.sections.map(s => ({ ...s, groupId: s.groupId || parsed!.groups[0].id }));
      }
    }
    // Handle orphan sections
    if (parsed.groups.length > 0 && parsed.sections) {
      const hasOrphans = parsed.sections.some(s => !s.groupId);
      if (hasOrphans) {
        const generalGroup = parsed.groups.find(g => g.name === 'General') || parsed.groups[0];
        parsed.sections = parsed.sections.map(s => ({ ...s, groupId: s.groupId || generalGroup.id }));
      }
    }
    cachedAppData = parsed;
  } else {
    parsed = getDefaultAppData();
    parsed.groups = [{ id: generateUniqueId('group'), name: 'General', createdAt: new Date().toISOString() }];
    cachedAppData = parsed;
  }

  return cachedAppData!;
}

export function getAppData(): AppData {
  if (cachedAppData) return cachedAppData;
  return getDefaultAppData();
}

async function saveToLocal(data: AppData) {
  const { apiKey, geminiApiKey, aiProvider, ...rest } = data;
  await AppStorage.setAppData(rest);
  if (apiKey) await AppStorage.setOpenRouterKey(apiKey);
  if (geminiApiKey) await AppStorage.setGeminiKey(geminiApiKey);
  await AppStorage.setAiProvider(aiProvider);
}

export async function saveAppData(partial: Partial<AppData>): Promise<void> {
  const current = getAppData();
  cachedAppData = { ...current, ...partial };
  await saveToLocal(cachedAppData!);
}

// Section management
export async function createSection(name: string, groupId?: string): Promise<Section> {
  const section: Section = {
    id: generateUniqueId('section'),
    name,
    createdAt: new Date().toISOString(),
    groupId,
    savedDocuments: [],
    storedQuestions: [],
    testResults: [],
  };
  const data = getAppData();
  data.sections.push(section);
  data.activeSectionId = section.id;
  cachedAppData = data;
  await saveToLocal(data);
  return section;
}

export function getSection(sectionId: string): Section | undefined {
  return getAppData().sections.find(s => s.id === sectionId);
}

export function getAllSections(): Section[] {
  return getAppData().sections;
}

export async function updateSection(sectionId: string, updates: Partial<Section>): Promise<void> {
  const data = getAppData();
  const index = data.sections.findIndex(s => s.id === sectionId);
  if (index === -1) return;
  data.sections[index] = { ...data.sections[index], ...updates };
  cachedAppData = data;
  await saveToLocal(data);
}

export async function renameSection(sectionId: string, newName: string): Promise<void> {
  await updateSection(sectionId, { name: newName });
}

export async function deleteSection(sectionId: string): Promise<void> {
  const data = getAppData();
  data.sections = data.sections.filter(s => s.id !== sectionId);
  if (data.activeSectionId === sectionId) {
    data.activeSectionId = data.sections.length > 0 ? data.sections[0].id : null;
  }
  cachedAppData = data;
  await saveToLocal(data);
}

export async function setActiveSection(sectionId: string): Promise<void> {
  await saveAppData({ activeSectionId: sectionId });
}

// Document management
export async function addDocumentToSection(sectionId: string, doc: Omit<SavedDocument, 'id' | 'uploadedAt'>): Promise<SavedDocument> {
  const section = getSection(sectionId);
  if (!section) throw new Error('Section not found');

  const savedDoc: SavedDocument = {
    ...doc,
    id: generateUniqueId('doc'),
    uploadedAt: new Date().toISOString(),
  };

  section.savedDocuments.push(savedDoc);
  const data = getAppData();
  const index = data.sections.findIndex(s => s.id === sectionId);
  if (index !== -1) {
    data.sections[index] = section;
    cachedAppData = data;
  }
  await saveToLocal(data);
  return savedDoc;
}

export async function removeDocumentFromSection(sectionId: string, docId: string): Promise<void> {
  const section = getSection(sectionId);
  if (!section) return;
  section.savedDocuments = section.savedDocuments.filter(d => d.id !== docId);
  const data = getAppData();
  const index = data.sections.findIndex(s => s.id === sectionId);
  if (index !== -1) {
    data.sections[index] = section;
    cachedAppData = data;
  }
  await saveToLocal(data);
}

export async function updateSectionNotes(sectionId: string, notes: string): Promise<void> {
  await updateSection(sectionId, { pastedNotes: notes });
}

// Test result management
export async function saveTestResultToSection(sectionId: string, result: TestResult): Promise<void> {
  const section = getSection(sectionId);
  if (!section) return;

  section.testResults.unshift(result);
  if (section.testResults.length > 50) {
    section.testResults = section.testResults.slice(0, 50);
  }

  const newStoredQuestions: StoredQuestion[] = result.questions.map(q => ({
    questionHash: hashQuestion(q.question),
    questionText: q.question,
    topic: q.topic,
    dateUsed: result.date,
    testId: result.id,
  }));

  section.storedQuestions = [...newStoredQuestions, ...section.storedQuestions];
  if (section.storedQuestions.length > 500) {
    section.storedQuestions = section.storedQuestions.slice(0, 500);
  }

  const data = getAppData();
  const index = data.sections.findIndex(s => s.id === sectionId);
  if (index !== -1) {
    data.sections[index] = section;
    cachedAppData = data;
  }
  await saveToLocal(data);
}

export async function updateTestResultInSection(sectionId: string, testId: string, updatedResult: TestResult): Promise<void> {
  const section = getSection(sectionId);
  if (!section) return;
  const testIndex = section.testResults.findIndex(t => t.id === testId);
  if (testIndex === -1) return;
  section.testResults[testIndex] = updatedResult;

  const data = getAppData();
  const index = data.sections.findIndex(s => s.id === sectionId);
  if (index !== -1) {
    data.sections[index] = section;
    cachedAppData = data;
  }
  await saveToLocal(data);
}

export async function renameTestResult(sectionId: string, testId: string, newName: string): Promise<void> {
  const section = getSection(sectionId);
  if (!section) return;
  const test = section.testResults.find(t => t.id === testId);
  if (!test) return;
  test.name = newName;

  const data = getAppData();
  const index = data.sections.findIndex(s => s.id === sectionId);
  if (index !== -1) {
    data.sections[index] = section;
    cachedAppData = data;
  }
  await saveToLocal(data);
}

export async function deleteTestResult(sectionId: string, testId: string): Promise<void> {
  const section = getSection(sectionId);
  const testToDelete = section?.testResults.find(t => t.id === testId);
  if (!section || !testToDelete) return;

  const hashesToDelete = testToDelete.questions?.map(q => hashQuestion(q.question)) || [];

  section.testResults = section.testResults.filter(t => t.id !== testId);
  if (hashesToDelete.length > 0) {
    section.storedQuestions = section.storedQuestions.filter(sq => {
      if (sq.testId) return sq.testId !== testId;
      return !hashesToDelete.includes(sq.questionHash);
    });
  }

  const data = getAppData();
  const index = data.sections.findIndex(s => s.id === sectionId);
  if (index !== -1) {
    data.sections[index] = section;
    cachedAppData = data;
  }
  await saveToLocal(data);
}

export function generateSimilarityReportForSection(
  sectionId: string,
  newQuestions: string[],
  threshold: number = 0.6
): SimilarityReport {
  const section = getSection(sectionId);
  const storedQuestions = section?.storedQuestions || [];
  const flaggedQuestions: SimilarityReport['flaggedQuestions'] = [];

  for (const question of newQuestions) {
    const result = checkQuestionSimilarity(question, storedQuestions, threshold);
    if (result.isSimilar && result.similarTo) {
      flaggedQuestions.push({
        newQuestion: question,
        similarTo: result.similarTo,
        similarity: result.similarity,
      });
    }
  }

  return {
    totalNewQuestions: newQuestions.length,
    similarQuestions: flaggedQuestions.length,
    uniqueQuestions: newQuestions.length - flaggedQuestions.length,
    similarityPercentage: newQuestions.length > 0
      ? Math.round((flaggedQuestions.length / newQuestions.length) * 100)
      : 0,
    flaggedQuestions,
  };
}

export function getSectionStats(sectionId: string) {
  const section = getSection(sectionId);
  if (!section) {
    return { totalTests: 0, averageScore: 0, questionsStored: 0, documentsCount: 0 };
  }
  const totalTests = section.testResults.length;
  const averageScore = totalTests > 0
    ? Math.round(section.testResults.reduce((sum, r) => sum + (r.score / r.totalQuestions) * 100, 0) / totalTests)
    : 0;
  return {
    totalTests,
    averageScore,
    questionsStored: section.storedQuestions.length,
    documentsCount: section.savedDocuments.length,
  };
}

export async function clearSectionData(sectionId: string): Promise<void> {
  const section = getSection(sectionId);
  if (!section) return;
  const data = getAppData();
  const index = data.sections.findIndex(s => s.id === sectionId);
  if (index !== -1) {
    data.sections[index] = { ...section, savedDocuments: [], storedQuestions: [], testResults: [], pastedNotes: '' };
    cachedAppData = data;
  }
  await saveToLocal(data);
}

// Group management
export function getAllGroups(): Group[] {
  return getAppData().groups;
}

export async function createGroup(name: string): Promise<Group> {
  const group: Group = { id: generateUniqueId('group'), name, createdAt: new Date().toISOString() };
  const data = getAppData();
  data.groups.push(group);
  cachedAppData = data;
  await saveToLocal(data);
  return group;
}

export async function renameGroup(groupId: string, newName: string): Promise<void> {
  const data = getAppData();
  const group = data.groups.find(g => g.id === groupId);
  if (!group) return;
  group.name = newName;
  cachedAppData = data;
  await saveToLocal(data);
}

export async function deleteGroup(groupId: string): Promise<void> {
  const data = getAppData();
  data.groups = data.groups.filter(g => g.id !== groupId);
  const deletedSectionIds = data.sections.filter(s => s.groupId === groupId).map(s => s.id);
  data.sections = data.sections.filter(s => s.groupId !== groupId);
  if (data.activeSectionId && deletedSectionIds.includes(data.activeSectionId)) {
    data.activeSectionId = data.sections.length > 0 ? data.sections[0].id : null;
  }
  cachedAppData = data;
  await saveToLocal(data);
}

