# CueMe - AI-Powered Interview Assistant

## Project Overview

CueMe is an Electron-based desktop application that provides real-time AI assistance during coding interviews and meetings. It combines screenshot capture, audio transcription, and AI-powered answer generation to help users respond effectively to questions.

### Key Features

1. **Screenshot Capture** - Capture interview questions with a keyboard shortcut (Cmd+H)
2. **Audio Transcription** - Real-time audio capture and transcription using OpenAI Whisper
3. **Question Detection** - Automatic detection and extraction of questions from audio
4. **AI Answer Generation** - Generate answers using Google Gemini with RAG (Retrieval Augmented Generation)
5. **Q&A Collections** - Build and manage knowledge bases for specific topics
6. **Multiple Modes** - Interview, meeting, sales, support, and more conversation modes
7. **Always-On Listening** - Continuous audio monitoring with batch question processing
8. **Usage Tracking** - Monitor API usage and enforce rate limits

---

## Tech Stack

### Frontend
- **React 18** - UI framework
- **TypeScript** - Type safety
- **Vite** - Build tool and dev server
- **Tailwind CSS** - Styling
- **Radix UI** - Accessible component primitives
- **React Query** - Server state management
- **Lucide React** - Icon library

### Backend (Electron Main Process)
- **Electron 33** - Desktop app framework
- **Node.js** - Runtime
- **TypeScript** - Type safety
- **Supabase** - Database and authentication
  - PostgreSQL with pgvector for vector search
  - Row Level Security (RLS) for data protection
- **Google Gemini** - Text generation and vision analysis
- **OpenAI Whisper** - Audio transcription
- **Sharp** - Image processing
- **Tesseract.js** - OCR (Optical Character Recognition)

### Native Modules
- **System Audio Capture** - Native C++ module for macOS audio capture
- **screenshot-desktop** - Cross-platform screenshot capture

---

## Project Structure

```
CueMeFinal/
├── .agent/                    # Agent documentation and tasks
│   ├── README.md             # This file
│   ├── rule.MD               # Agent system rules
│   ├── SOP/                  # Standard Operating Procedures
│   ├── system/               # Technical architecture docs
│   │   ├── ARCHITECTURE.md   # System architecture overview
│   │   └── COMPONENT_MAP.md  # Component and service map
│   └── tasks/                # Feature implementation tracking
│       └── CODE_RESTRUCTURE.md
│
├── electron/                  # Main process (Node.js)
│   ├── main.ts               # Entry point and AppState
│   ├── preload.ts            # Preload script for IPC
│   ├── ipcHandlers.ts        # IPC handler registration
│   ├── shortcuts.ts          # Global keyboard shortcuts
│   │
│   ├── [Core Services]
│   ├── AuthService.ts        # Supabase authentication
│   ├── QnAService.ts         # Q&A collection management
│   ├── DocumentService.ts    # Document upload and processing
│   ├── UsageTracker.ts       # API usage tracking
│   │
│   ├── [AI/LLM Services]
│   ├── LLMHelper.ts          # Gemini integration
│   ├── ModeManager.ts        # Conversation mode management
│   ├── ProcessingHelper.ts   # AI processing coordination
│   │
│   ├── [Audio Services]
│   ├── AudioStreamProcessor.ts    # Real-time audio processing
│   ├── SystemAudioCapture.ts      # Native audio capture
│   ├── QuestionDetector.ts        # Question extraction
│   │
│   ├── [Helper Services]
│   ├── WindowHelper.ts       # Window management
│   ├── ScreenshotHelper.ts   # Screenshot capture
│   ├── PermissionStorage.ts  # Permission state management
│   ├── TokenStorage.ts       # Secure token storage
│   │
│   └── config/               # Configuration files
│
├── src/                      # Renderer process (React)
│   ├── App.tsx              # Root component
│   ├── main.tsx             # React entry point
│   ├── index.css            # Global styles
│   │
│   ├── _pages/              # Page components
│   │   ├── Queue.tsx        # Main queue page
│   │   ├── Solutions.tsx    # AI solutions display
│   │   └── Debug.tsx        # Debug page
│   │
│   ├── components/          # Reusable components
│   │   ├── Queue/           # Queue page components
│   │   │   ├── QueueCommands.tsx
│   │   │   └── ScreenshotQueue.tsx
│   │   ├── Solutions/       # Solutions page components
│   │   │   └── SolutionCommands.tsx
│   │   ├── AudioListener/   # Audio components
│   │   │   └── QuestionSidePanel.tsx
│   │   ├── ui/              # UI primitives
│   │   │   ├── auth-dialog.tsx
│   │   │   ├── permission-dialog.tsx
│   │   │   ├── mode-select.tsx
│   │   │   └── [Radix UI wrappers]
│   │   ├── AudioSettings.tsx
│   │   ├── AudioSourceSelector.tsx
│   │   ├── AudioLevelIndicator.tsx
│   │   └── AudioTroubleshootingHelp.tsx
│   │
│   ├── hooks/               # Custom React hooks
│   │   └── useVerticalResize.ts
│   │
│   ├── types/               # TypeScript type definitions
│   │   ├── electron.d.ts    # Electron API types
│   │   ├── audio-stream.ts  # Audio types
│   │   ├── audio.ts         # Audio types
│   │   ├── modes.ts         # Mode types
│   │   ├── solutions.ts     # Solution types
│   │   └── index.tsx        # Shared types
│   │
│   └── lib/                 # Utility functions
│       └── utils.ts         # Helper utilities
│
├── assets/                   # Static assets
│   ├── logo.icns            # macOS app icon
│   ├── logo.iconset/        # Icon source files
│   └── entitlements.mac.plist  # macOS entitlements
│
├── dist/                     # Built React app (gitignored)
├── dist-electron/            # Built Electron code (gitignored)
├── dist-native/              # Built native modules (gitignored)
├── release/                  # Distributable packages (gitignored)
│
├── scripts/                  # Build scripts
│   └── build-native.sh      # Native module build script
│
├── .env                      # Environment variables (gitignored)
├── package.json             # Dependencies and scripts
├── tsconfig.json            # TypeScript config (React)
├── tsconfig.node.json       # TypeScript config (Node)
├── vite.config.ts           # Vite configuration
├── tailwind.config.js       # Tailwind CSS config
└── electron-builder.yml     # Electron Builder config (in package.json)
```

---

## Development Setup

### Prerequisites
- Node.js 18+ and npm
- macOS (for full audio capture features)
- Xcode Command Line Tools (for native modules)

### Environment Variables
Create a `.env` file in the project root:

```env
# Required
GEMINI_API_KEY=your_gemini_api_key
OPENAI_API_KEY=your_openai_api_key

# Supabase (required for auth and Q&A)
SUPABASE_URL=your_supabase_url
SUPABASE_ANON_KEY=your_supabase_anon_key

# Optional
NODE_ENV=development
```

### Installation

```bash
# Install dependencies
npm install

# Build native modules
npm run build:native

# Start development
npm start
# This runs both Vite dev server and Electron
```

### Development Commands

```bash
# Development
npm run dev              # Start Vite dev server only
npm run electron:dev     # Start Electron only
npm start                # Start both (recommended)

# Building
npm run build            # Build React + Electron
npm run build:native     # Build native modules only

# Packaging
npm run app:build        # Build for current platform
npm run app:build:mac    # Build for macOS
npm run app:build:win    # Build for Windows
npm run app:build:linux  # Build for Linux

# Release
npm run release          # Build and publish to GitHub
npm run release:draft    # Build draft release

# Utilities
npm run clean            # Clean build directories
npm run watch            # Watch TypeScript changes
```

---

## Key Workflows

### Screenshot Capture Flow
1. User presses `Cmd+H` (global shortcut)
2. Window hides temporarily
3. Screenshot captured using screenshot-desktop
4. Image saved to temp directory
5. Preview generated using Sharp
6. Window shows again
7. Screenshot added to queue
8. User can view, delete, or process screenshots

### Audio Question Detection Flow
1. User enables "Always-On Listening"
2. AudioStreamProcessor starts capturing audio (optimized 800ms chunks)
3. Audio volume detection filters out background noise/silence
4. Streaming question detector monitors for question patterns in real-time
5. Audio chunks sent to OpenAI Whisper for transcription (~500ms)
6. QuestionDetector analyzes transcription with expanded pattern matching
7. Questions extracted and refined algorithmically (<50ms)
8. Questions displayed in side panel (~1.1-1.2s total from speech)
9. User clicks question to generate answer
10. LLMHelper generates answer using RAG
11. Answer displayed in chat interface

### AI Answer Generation Flow
1. User sends question via chat or clicks detected question
2. If collection selected, QnAService searches for relevant Q&As
3. Top K relevant answers retrieved using vector similarity
4. LLMHelper builds context with relevant answers
5. Gemini generates response with context
6. Response formatted and returned
7. Displayed in chat interface
8. Usage tracked and limits enforced

### Solution Generation Flow
1. User captures screenshots of coding problem
2. User clicks "Generate Solution"
3. ProcessingHelper coordinates processing
4. LLMHelper extracts problem using Gemini Vision
5. Problem structure parsed (statement, input, output, constraints)
6. LLMHelper generates solution code
7. Solution formatted and displayed
8. User can debug or refine solution

---

## Architecture Highlights

### IPC Communication
- **Renderer → Main:** `window.electronAPI.methodName(args)` returns Promise
- **Main → Renderer:** `mainWindow.webContents.send(channel, data)` with event listeners
- All IPC handlers in `electron/ipcHandlers.ts`
- Type-safe API defined in `src/types/electron.d.ts`

### State Management
- **Main Process:** AppState class manages all services and state
- **Renderer:** React Query for server state, useState for local UI state
- **Auth State:** Managed by AuthService, broadcasted to renderer
- **Audio State:** Managed by AudioStreamProcessor, events forwarded to renderer

### Service Layer
- All business logic in service classes
- Services injected into AppState
- Services communicate through AppState
- Clear separation of concerns

### Security
- API keys stored in .env, never exposed to renderer
- Supabase handles authentication with persistent sessions (60-day token storage)
- Tokens stored securely using TokenStorage with AES-256-GCM encryption
- Row Level Security (RLS) in database
- Input validation on all IPC handlers
- Automatic session restoration on app restart

---

## Current Issues & Planned Improvements

### Recent Improvements
1. **Audio Question Detection Speed** - Optimized from 3-6s to ~1.1-1.2s (75-80% faster)
   - Reduced chunking delays (2-4s → 0.8-1.5s)
   - Added audio volume detection to filter background noise
   - Expanded question patterns (8 → 35+ patterns)
   - Reduced streaming check interval (500ms → 200ms)
   - Removed all non-error logging for performance
   - See: `.agent/tasks/QUESTION_DETECTION_SPEED_OPTIMIZATION.md`

### Known Issues
1. **Large Files** - Several files exceed 500 lines and need refactoring
2. **Mixed Concerns** - Some components handle too many responsibilities
3. **Unused Files** - Some test/debug files not cleaned up
4. **Documentation** - Some services lack inline documentation

### Planned Refactoring (See CODE_RESTRUCTURE.md)
1. Split `electron/main.ts` into AppState, DeepLinkHandler, AuthCallbackServer
2. Split `electron/ipcHandlers.ts` by feature domain
3. Split `electron/AudioStreamProcessor.ts` into smaller modules
4. Split `src/_pages/Queue.tsx` into smaller components
5. Split `src/components/Queue/QueueCommands.tsx` into feature components
6. Extract custom hooks from large components
7. Create utility modules for shared code

### Future Features
1. Multi-language support (currently Japanese/English)
2. Custom mode creation by users
3. Export/import Q&A collections
4. Offline mode with local LLM
5. Plugin system for extensibility
6. Windows and Linux audio capture support

---

## Testing

### Manual Testing Checklist
- [ ] Screenshot capture (Cmd+H)
- [ ] Window toggle (Cmd+Shift+Space)
- [ ] Audio recording and transcription
- [ ] Always-on listening
- [ ] Question detection
- [ ] AI answer generation
- [ ] Q&A collection management
- [ ] Mode switching
- [ ] Authentication (sign in/up/out)
- [ ] Permission setup flow
- [ ] Usage tracking and limits

### Build Testing
```bash
# Test development build
npm start

# Test production build
npm run build
npm run electron:dev

# Test packaged app
npm run app:build
# Open app in release/ directory
```

---

## Troubleshooting

### Common Issues

**Build Fails:**
- Clear `node_modules` and reinstall: `rm -rf node_modules && npm install`
- Clear build directories: `npm run clean`
- Rebuild native modules: `npm run build:native`

**Audio Not Working:**
- Check microphone permission in System Preferences
- Verify OpenAI API key in .env
- Check audio source selection in settings
- Review console logs for errors

**Screenshots Not Capturing:**
- Check screen recording permission in System Preferences
- Verify screenshot-desktop is installed
- Check temp directory permissions

**Authentication Failing:**
- Verify Supabase credentials in .env
- Check network connection
- Clear token storage: Delete `~/Library/Application Support/CueMe/auth-tokens.json`
- Check logs for session restoration errors
- Use `auth-debug-info` IPC handler to check auth state

**App Won't Start:**
- Check for port conflicts (5173, 3001)
- Review console logs
- Try `npm run clean && npm install`

---

## Contributing

### Code Style
- Use TypeScript for all new code
- Follow existing naming conventions
- Add JSDoc comments for public APIs
- Use Prettier for formatting (if configured)
- Keep files under 400 lines

### Commit Messages
- Use conventional commits format
- Examples:
  - `feat: add custom mode creation`
  - `fix: resolve audio permission issue`
  - `refactor: split QueueCommands component`
  - `docs: update architecture documentation`

### Pull Request Process
1. Create feature branch from main
2. Implement changes with tests
3. Update documentation
4. Test thoroughly
5. Submit PR with description

---

## Resources

### Documentation
- [Electron Documentation](https://www.electronjs.org/docs)
- [React Documentation](https://react.dev)
- [Supabase Documentation](https://supabase.com/docs)
- [Google Gemini API](https://ai.google.dev/docs)
- [OpenAI API](https://platform.openai.com/docs)

### Internal Documentation
- [Architecture Overview](.agent/system/ARCHITECTURE.md)
- [Component Map](.agent/system/COMPONENT_MAP.md)
- [Code Restructure Plan](.agent/tasks/CODE_RESTRUCTURE.md)
- [Persistent Authentication](.agent/tasks/PERSISTENT_AUTH.md) - ✅ Completed
- [Question Detection Speed Optimization](.agent/tasks/QUESTION_DETECTION_SPEED_OPTIMIZATION.md) - ✅ Phase 1 & 2A Completed
- [Agent Rules](.agent/rule.MD)

---

## License

See LICENSE file for details.

---

## Contact & Support

For issues, questions, or contributions, please refer to the project repository.

---

**Last Updated:** 2025/10/11
**Version:** 1.0.52
**Status:** Active Development

**Recent Updates:**
- ✅ Audio question detection optimized (75-80% faster)
- ✅ Background noise filtering implemented
- ✅ Expanded question pattern matching (35+ patterns)
- ✅ Streaming detection interval reduced to 200ms
