# ExamForge AI 🧠✨

> **AI-Powered Exam Question Generator for Mobile**

ExamForge AI is a cross-platform mobile application built with **React Native (Expo)** that intelligently generates unique, high-quality multiple-choice questions (MCQs) from your study notes. Powered by OpenRouter & Gemini AI, it helps students, educators, and professionals create practice tests on the go — in **English, Hindi, or Hinglish**.

---

## 📥 Download

### 📱 Android APK (v1.0.0)
[![Download APK](https://img.shields.io/badge/Download-APK-blue?style=for-the-badge&logo=android)](https://github.com/Rajasthanichora/exam-forge-ai/releases/latest/download/EXAM-FORGE-AI.apk)

👉 **[Download Latest APK](https://github.com/Rajasthanichora/exam-forge-ai/releases/latest/download/EXAM-FORGE-AI.apk)**

### 🌐 Web Version
ExamForge AI also has a **web version** built for desktop browsers:
👉 **[exam-forge-web](https://github.com/Rajasthanichora/exam-forge)**

---

## ✨ Features

### 📝 Smart Question Generation
- Paste study notes or upload files (`.txt`, `.pdf`, `.docx`) and let AI generate custom MCQs instantly
- Choose difficulty level: **Easy**, **Medium**, or **Hard**
- Set custom question count with smart fallback
- Three language modes: **English**, **Hindi (हिंदी)**, **Hinglish**
- Custom prompt support for tailored question generation

### 🔬 AI-Powered Uniqueness Engine
- Tracks previously asked questions per section
- Ensures zero repetition across test sessions
- **Similarity Report** — detailed breakdown of new vs. repeated questions
- AI generates a uniqueness message after every test

### 📂 Sections & Groups
- Organize subjects/topics into **Sections**
- Group related sections together with **Groups**
- Each section stores documents, notes, question history, and test results

### 📄 File Upload
- Upload study material: PDF, DOCX, TXT
- View and manage saved documents per section
- Automatic text extraction

### 📊 Test History & Performance
- Full test history with scores, answers, and timing
- Rename, review, or delete past tests
- Retake any previous test with same config
- **Clear History** option for a fresh start

### 🎮 Interactive Quiz Interface
- Clean, modern quiz UI with progress tracking
- One-by-one question navigation
- Auto-submit on completion
- Time tracking per test

### 🛠 Settings & Configuration
- **API Settings**: Choose between OpenRouter & Gemini, set API keys, test models
- Working model detection
- Dark mode throughout (OLED-friendly)
- Persistent local storage — no account required

### 🧩 Additional
- **One-Liner Mode** — compact question sets
- Clipboard support — copy results easily
- EAS Build ready — deploy to stores

---

## 🚀 Tech Stack

| Layer | Technology |
|-------|-----------|
| **Framework** | React Native (Expo SDK 56) |
| **Navigation** | Expo Router (file-based) |
| **Language** | TypeScript |
| **AI Providers** | OpenRouter API & Google Gemini API |
| **Storage** | AsyncStorage (local, no backend) |
| **File Parsing** | Mammoth (DOCX), built-in TXT/PDF |
| **Build** | EAS (Expo Application Services) |
| **UI** | Custom dark theme, Gesture Handler, Safe Area |

---

## 🛠 Getting Started

### Prerequisites
- Node.js >= 18
- Expo CLI or EAS CLI
- Android/iOS emulator or physical device with Expo Go

### Installation

```bash
git clone https://github.com/Rajasthanichora/exam-forge-ai.git
cd exam-forge-mobile
npm install
npx expo start
```

Scan QR code with **Expo Go** or press:
- `a` — Android emulator
- `i` — iOS simulator
- `w` — Web browser

### Configure AI Provider

1. Open app → tap ⚙️ Settings
2. Go to **API Settings**
3. Choose **OpenRouter** or **Gemini**
4. Enter your API key from:
   - [OpenRouter](https://openrouter.ai/keys)
   - [Google AI Studio](https://aistudio.google.com/apikey)
5. Tap **Test Model** to verify
6. Start generating tests! 🎉

---

## 📖 How to Use

### 1. Create a Section
Tap **Manage Sections** → **+ New Section**, give it a name (e.g. "Physics Ch 5")

### 2. Add Study Material
- **Type/Paste Notes**: Paste your study notes directly
- **Upload File**: Upload PDF, DOCX, or TXT files

### 3. Configure & Generate Test
- Select difficulty (Easy / Medium / Hard)
- Choose question count
- Pick language (English / Hindi / Hinglish)
- (Optional) Add custom prompt
- Tap **Generate Test** 🚀

### 4. Take the Quiz
- Answer questions one by one
- Track progress with progress bar
- Submit to see score & explanations

### 5. Review Results
- View score, correct answers, explanations
- Check **Similarity Report** for uniqueness
- Copy to clipboard or save for later

---

## 📂 Project Structure

```
exam-forge-mobile/
├── app/                    # Expo Router pages
│   ├── _layout.tsx         # Root layout
│   ├── index.tsx           # Home screen (quiz flow)
│   ├── api-settings.tsx    # API configuration
│   ├── settings.tsx        # App settings
│   ├── results-history.tsx # Past results
│   └── clear-test-history.tsx
├── assets/                 # Icons, splash, favicon
├── components/             # Reusable UI components
│   ├── FileUpload.tsx
│   ├── Header.tsx
│   ├── ManualTestGen.tsx
│   ├── QuizInterface.tsx
│   ├── SavedDocuments.tsx
│   ├── SectionHistory.tsx
│   ├── SectionSidebar.tsx
│   ├── SimilarityIndicator.tsx
│   ├── TestConfigForm.tsx
│   └── TestResults.tsx
├── lib/                    # Core logic & utilities
│   ├── api.ts              # AI integration
│   ├── file-handler.ts     # File parsing
│   ├── logs.ts             # Debug logging
│   ├── section-store.ts    # Data management
│   ├── storage.ts          # AsyncStorage wrapper
│   ├── supabase.ts         # Stub (local-only)
│   ├── theme.tsx           # Dark theme
│   ├── types.ts            # TypeScript types
│   └── utils.ts            # Utilities
├── build/                  # EAS build artifacts
├── App.tsx
├── app.json
├── eas.json
├── tsconfig.json
├── metro.config.js
└── package.json
```

---

## 🌐 API Providers

### OpenRouter
- Access to 200+ models (Llama, GPT, Claude, Mistral, etc.)
- Default model: `meta-llama/llama-3.3-70b-instruct:free`
- Get key: [openrouter.ai/keys](https://openrouter.ai/keys)

### Google Gemini
- Fast & free tier available
- Default model: `gemini-2.0-flash`
- Get key: [aistudio.google.com/apikey](https://aistudio.google.com/apikey)

---

## 🔧 Build for Production

```bash
npm install -g eas-cli
eas login
eas build --platform android --profile production
eas build --platform ios --profile production
```

---

## 🧪 Development Commands

```bash
npx expo start                # Start dev server
npx expo start --android      # Android
npx expo start --ios          # iOS
npx expo start --web          # Web
npx tsc --noEmit              # Type check
```

---

## 🤝 Contributing

Contributions, issues, and feature requests are welcome!
[Open an issue](https://github.com/Rajasthanichora/exam-forge-ai/issues)

---

## 📄 License

Private & proprietary.

---

## 👨‍💻 Author

**Rajasthanichora** — [@Rajasthanichora](https://github.com/Rajasthanichora)

---

> Built with ❤️ using Expo & React Native
