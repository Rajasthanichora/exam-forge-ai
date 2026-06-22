# Graph Report - .  (2026-06-22)

## Corpus Check
- Large corpus: 52 files · ~15,10,817 words. Semantic extraction will be expensive (many Claude tokens). Consider running on a subfolder, or use --no-semantic to run AST-only.

## Summary
- 224 nodes · 547 edges · 10 communities detected
- Extraction: 100% EXTRACTED · 0% INFERRED · 0% AMBIGUOUS
- Token cost: 0 input · 0 output
- Edge kinds: imports: 203 · contains: 189 · imports_from: 83 · calls: 71 · re_exports: 1


## Input Scope
- Requested: auto
- Resolved: all (source: default-auto)
- Included files: 52 · Candidates: recursive
- Excluded: 0 untracked · 0 ignored · 0 sensitive · 0 missing committed
## God Nodes (most connected - your core abstractions)
1. `getAppData()` - 20 edges
2. `useTheme()` - 19 edges
3. `Spacing` - 17 edges
4. `BorderRadius` - 17 edges
5. `FontSize` - 16 edges
6. `saveToLocal()` - 15 edges
7. `getSection()` - 14 edges
8. `persistLog()` - 11 edges
9. `generateTest()` - 8 edges
10. `getItem()` - 8 edges

## Surprising Connections (you probably didn't know these)
- None detected - all connections are within the same source files.

## Communities

### Community 8 - "Community 8"
Cohesion: 0.50
Nodes (1): styles

### Community 2 - "Community 2"
Cohesion: 0.11
Nodes (20): styles, styles, LogCategory, LOG_COLORS, LOG_LABELS, LogEntry, persistLog(), logSuccess() (+12 more)

### Community 6 - "Community 6"
Cohesion: 0.16
Nodes (13): PROVIDER_NAMES, styles, SectionSidebarProps, styles, getGrade(), escapeHtml(), generateScoreReport(), TestResult (+5 more)

### Community 3 - "Community 3"
Cohesion: 0.11
Nodes (22): DEFAULT_OR_MODELS, DEFAULT_GEMINI_MODELS, DEFAULT_MISTRAL_MODELS, styles, getLanguageInstruction(), buildPrompt(), callOpenRouter(), callGemini() (+14 more)

### Community 1 - "Community 1"
Cohesion: 0.09
Nodes (26): styles, HeaderProps, styles, Props, styles, Props, styles, Props (+18 more)

### Community 4 - "Community 4"
Cohesion: 0.13
Nodes (20): TabType, ExpandedState, styles, StorageItemInfo, StorageCategory, StorageCategoryInfo, BackupData, StorageBreakdown (+12 more)

### Community 0 - "Community 0"
Cohesion: 0.13
Nodes (36): AppView, HomeScreen(), styles, makeStyles(), Spacing, FontSize, BorderRadius, s (+28 more)

### Community 5 - "Community 5"
Cohesion: 0.14
Nodes (14): FileUploadProps, styles, SavedDocumentsProps, TestConfigFormProps, LANGUAGES, DIFFICULTIES, styles, extractTextFromDocx() (+6 more)

### Community 7 - "Community 7"
Cohesion: 0.33
Nodes (7): hashQuestion(), normalizeText(), calculateSimilarity(), checkQuestionSimilarity(), generateUniqueId(), shuffleArray(), shuffleQuestionOptions()

### Community 9 - "Community 9"
Cohesion: 1.00
Nodes (2): { getDefaultConfig }, config

## Knowledge Gaps
- **60 isolated node(s):** `styles`, `styles`, `PROVIDER_NAMES`, `styles`, `DEFAULT_OR_MODELS` (+55 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **Thin community `Community 8`** (1 nodes): `styles`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 9`** (2 nodes): `{ getDefaultConfig }`, `config`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `useTheme()` connect `Community 1` to `Community 6`, `Community 3`, `Community 4`, `Community 0`, `Community 2`, `Community 5`?**
  _High betweenness centrality (0.055) - this node is a cross-community bridge._
- **Why does `Spacing` connect `Community 1` to `Community 6`, `Community 3`, `Community 4`, `Community 0`, `Community 2`, `Community 5`?**
  _High betweenness centrality (0.035) - this node is a cross-community bridge._
- **Why does `BorderRadius` connect `Community 1` to `Community 6`, `Community 3`, `Community 4`, `Community 0`, `Community 2`, `Community 5`?**
  _High betweenness centrality (0.035) - this node is a cross-community bridge._
- **What connects `styles`, `styles`, `PROVIDER_NAMES` to the rest of the system?**
  _60 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `Community 2` be split into smaller, more focused modules?**
  _Cohesion score 0.1053763440860215 - nodes in this community are weakly interconnected._
- **Should `Community 3` be split into smaller, more focused modules?**
  _Cohesion score 0.11076923076923077 - nodes in this community are weakly interconnected._
- **Should `Community 1` be split into smaller, more focused modules?**
  _Cohesion score 0.08536585365853659 - nodes in this community are weakly interconnected._