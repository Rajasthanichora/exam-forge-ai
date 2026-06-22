# 📚 ExamForge AI — v1.2.0

![ExamForge AI](assets/exam-forge-transparant.png)

> **AI-Powered Exam Preparation Platform** — Generate custom tests, quizzes, and study materials from your notes, documents, and study materials using cutting-edge AI models.

---

## ✨ Features

### 🧠 AI-Powered Test Generation
- Generate custom tests from your study notes, textbooks, or documents
- Supports **multiple AI providers**: OpenRouter, Google Gemini, Mistral AI
- Choose from **50+ AI models** including GPT-4, Claude, Gemini, Mistral, and more
- Adjustable **difficulty levels**: Easy, Medium, Hard
- **Multi-language support**: English, Hindi, Hinglish

### 📄 Document Upload & Processing
- Upload **PDF, DOCX, TXT** files for automatic question generation
- Built-in document parser extracts text seamlessly
- **File similarity detection** to avoid duplicate questions

### 📊 Test & Quiz Interface
- Interactive **quiz interface** with real-time scoring
- Multiple choice questions with instant feedback
- **Detailed score reports** with topic-wise breakdown
- Test history with **performance analytics**

### 💬 AI Chat Assistant
- Built-in **AI chat** for subject clarification
- Context-aware conversations linked to your tests
- Multi-provider AI chat support

### 📁 Section & Group Management
- Organize study materials into **sections and groups**
- Save and manage **past tests and results**
- Track **question history** to prevent repeats
- **Data management** tools with backup/restore

### ⚙️ Customization
- **Dark theme** optimized for extended study sessions
- **Full-screen mode** for distraction-free testing
- **One-liner mode** for quick question formats
- **Custom instructions** for personalized AI responses
- **Custom prompts** for test generation
- **API key management** for all AI providers

---

## 📸 Screenshots

| Home Screen | Test Configuration | Quiz Interface |
|:---:|:---:|:---:|
| ![Home](assets/splash-icon.png) | ![Settings](assets/android-icon-foreground.png) | ![Quiz](assets/icon.png) |

---

## 🚀 Getting Started

### Prerequisites
- **Node.js** v18+ 
- **Expo CLI** or **EAS CLI**
- An API key from one of the supported AI providers

### Installation

\\\ash
# Clone the repository
git clone https://github.com/Rajasthanichora/exam-forge-ai.git
cd exam-forge-ai

# Install dependencies
npm install

# Start the development server
npx expo start
\\\

### Configuration
1. Open the app and navigate to **⚙️ Settings**
2. Enter your AI provider API key (OpenRouter / Gemini / Mistral)
3. Select your preferred AI model
4. Start generating tests!

---

## 🏗️ Tech Stack

| Technology | Purpose |
|------------|---------|
| **React Native** (0.85.3) | Cross-platform mobile framework |
| **Expo** (SDK 56) | Build toolchain & development |
| **TypeScript** | Type-safe development |
| **Expo Router** | File-based navigation |
| **AsyncStorage** | Local data persistence |
| **Supabase** *(stub)* | Reserved for future cloud sync |

### AI Providers
- **OpenRouter** — Access to 50+ LLMs (GPT-4, Claude, Llama, etc.)
- **Google Gemini** — Google's Gemini models
- **Mistral AI** — Mistral's open-source models

---

## 📁 Project Structure

\\\
exam-forge-ai/
├── app/                    # Expo Router pages
│   ├── _layout.tsx         # Root layout & navigation
│   ├── index.tsx           # Home screen
│   ├── settings.tsx        # App settings
│   ├── api-settings.tsx    # AI provider configuration
│   ├── ai-chat.tsx         # AI chat assistant
│   ├── data-management.tsx # Data backup/restore
│   ├── results-history.tsx # Test results history
│   └── clear-test-history.tsx
├── components/             # Reusable UI components
│   ├── Header.tsx
│   ├── FileUpload.tsx
│   ├── ManualTestGen.tsx
│   ├── QuizInterface.tsx
│   ├── TestConfigForm.tsx
│   ├── TestResults.tsx
│   ├── SavedDocuments.tsx
│   ├── SectionHistory.tsx
│   ├── SectionSidebar.tsx
│   └── SimilarityIndicator.tsx
├── lib/                    # Core libraries & utilities
│   ├── api.ts              # AI provider API handlers
│   ├── storage.ts          # AsyncStorage wrapper
│   ├── theme.tsx           # Dark/Light theme system
│   ├── types.ts            # TypeScript interfaces
│   ├── utils.ts            # Utility functions
│   ├── backup.ts           # Backup/restore engine
│   ├── file-handler.ts     # File upload parser
│   ├── logs.ts             # Logging system
│   ├── score-report.ts     # Score report generator
│   ├── section-store.ts    # Section management
│   ├── supabase.ts         # Supabase stub
│   └── _warnPatch.ts       # Warning suppression
├── assets/                 # Images & icons
└── package.json            # Dependencies & scripts
\\\

---

## 🔧 Available Scripts

| Script | Description |
|--------|-------------|
| \
pm start\ | Start Expo development server |
| \
pm run android\ | Start with Android emulator |
| \
pm run ios\ | Start with iOS simulator (macOS) |
| \
pm run web\ | Start web version |

---

## 📦 Building APK

\\\ash
# Using EAS Build (recommended)
eas build --platform android --profile production

# The APK will be available on EAS servers
# Download from: https://expo.dev/accounts/veerrr.rj/projects/exam-forge-mobile
\\\

---

## 📝 Changelog

### v1.2.0
- ✨ **New AI Chat Assistant** — Built-in conversational AI for study help
- ✨ **Multiple AI Providers** — OpenRouter, Gemini & Mistral support
- ✨ **50+ AI Models** — Choose from a vast library of LLMs
- ✨ **File Upload** — PDF, DOCX, TXT support
- ✨ **One-Liner Mode** — Quick question format
- ✨ **Full-Screen Mode** — Distraction-free testing
- ✨ **Multi-Language Support** — English, Hindi, Hinglish
- ✨ **Custom Instructions** — Personalized AI responses
- ✨ **Custom Prompts** — Tailor test generation
- ✨ **Advanced Data Management** — Backup/restore functionality
- ✨ **Similarity Detection** — Prevents duplicate questions
- ✨ **Score Reports** — Detailed performance analysis
- 🔧 **Improved dark theme** optimized for extended use
- 🔧 **Performance optimizations** & bug fixes

### v1.0.0
- Initial release with core test generation functionality
- Basic quiz interface
- Single AI provider support

---

## 🔒 Privacy & Data

- **All data stays on your device** — No cloud storage required
- API keys are stored **locally** and never transmitted except to your chosen AI provider
- Test history and documents are **private** to your device

---

## 🤝 Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

1. Fork the repository
2. Create your feature branch (\git checkout -b feature/amazing-feature\)
3. Commit your changes (\git commit -m 'Add amazing feature'\)
4. Push to the branch (\git push origin feature/amazing-feature\)
5. Open a Pull Request

---

## 📄 License

This project is licensed under the MIT License — see the [LICENSE](LICENSE) file for details.

---

## 📬 Contact

- **Developer**: Veer Raj
- **Email**: veerrr.rj@expo.dev
- **GitHub**: [@Rajasthanichora](https://github.com/Rajasthanichora)

---

> **Built with ❤️ using React Native & Expo**
> *Powered by OpenRouter, Gemini & Mistral AI*
