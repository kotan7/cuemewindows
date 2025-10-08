# CueMe Architecture Overview

## Project Summary
CueMe is an AI-powered interview assistant Electron application that helps users during coding interviews by:
- Capturing screenshots of interview questions
- Transcribing audio questions in real-time
- Providing AI-generated answers using RAG (Retrieval Augmented Generation)
- Managing Q&A collections for knowledge base
- Supporting multiple conversation modes (interview, meeting, sales, etc.)

## Tech Stack

### Frontend
- **Framework:** React 18 with TypeScript
- **Build Tool:** Vite
- **UI Library:** Radix UI components
- **Styling:** Tailwind CSS
- **State Management:** React Query for server state
- **Icons:** Lucide React

### Backend (Electron Main Process)
- **Runtime:** Node.js with Electron 33
- **Language:** TypeScript
- **AI Services:**
  - Google Gemini (text generation, vision)
  - OpenAI Whisper (audio transcription)
- **Database:** Supabase (PostgreSQL with vector search)
- **Authentication:** Supabase Auth

### Native Modules
- **Audio Capture:** Native C++ module for system audio (macOS)
- **Screenshot:** screenshot-desktop library
- **Image Processing:** Sharp, Tesseract.js for OCR

---

## High-Level Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                     Electron App                             │
│                                                              │
│  ┌────────────────┐              ┌─────────────────────┐   │
│  │  Renderer      │   IPC        │   Main Process      │   │
│  │  (React UI)    │◄────────────►│   (Node.js)         │   │
│  │                │              │                     │   │
│  │  - Queue Page  │              │  - AppState         │   │
│  │  - Solutions   │              │  - IPC Handlers     │   │
│  │  - Auth UI     │              │  - Services         │   │
│  └────────────────┘              └─────────────────────┘   │
│                                            │                 │
└────────────────────────────────────────────┼─────────────────┘
                                             │
                    ┌────────────────────────┼────────────────────────┐
                    │                        │                        │
              ┌─────▼──────┐         ┌──────▼──────┐        ┌────────▼────────┐
              │  Supabase  │         │   OpenAI    │        │  Google Gemini  │
              │            │         │             │        │                 │
              │  - Auth    │         │  - Whisper  │        │  - Text Gen     │
              │  - DB      │         │  - STT      │        │  - Vision       │
              │  - Vector  │         │             │        │  - Embeddings   │
              └────────────┘         └─────────────┘        └─────────────────┘
```

---

## Core Components

### 1. Main Process (electron/)

#### AppState (main.ts)
**Responsibility:** Central state management and service coordination
- Manages all service instances
- Coordinates between services
- Handles app lifecycle
- Manages window state
- Broadcasts events to renderer

**Key Services:**
- `WindowHelper` - Window management
- `ScreenshotHelper` - Screenshot capture
- `ProcessingHelper` - AI processing coordination
- `AuthService` - User authentication
- `QnAService` - Q&A collection management
- `DocumentService` - Document management
- `UsageTracker` - API usage tracking
- `AudioStreamProcessor` - Real-time audio processing
- `PermissionStorage` - Permission state management

#### IPC Handlers (ipcHandlers.ts)
**Responsibility:** Bridge between renderer and main process
- Exposes main process functionality to renderer
- Handles async operations
- Validates inputs
- Manages errors

**Handler Categories:**
- Window management (toggle, move, resize)
- Screenshot operations (take, delete, get)
- Audio processing (record, transcribe, stream)
- Authentication (sign in/up/out, session)
- Q&A collections (CRUD operations)
- Permissions (check, request)
- LLM chat (Gemini, RAG, modes)

#### Services

**AuthService**
- Supabase authentication integration
- Session management
- Token storage
- Auth state broadcasting

**QnAService**
- Q&A collection CRUD
- Vector similarity search
- Embedding generation
- Relevant answer retrieval

**DocumentService**
- Document upload and storage
- Text extraction
- Chunking and embedding
- Vector search integration

**UsageTracker**
- API usage monitoring
- Rate limiting
- Usage statistics
- Cache management

**AudioStreamProcessor**
- Real-time audio capture
- Continuous transcription
- Question detection
- Batch processing
- Event emission

**LLMHelper**
- Gemini API integration
- Mode management
- RAG implementation
- Context building
- Response generation

---

### 2. Renderer Process (src/)

#### Pages (_pages/)

**Queue.tsx**
- Main landing page
- Screenshot queue display
- Chat interface
- Mode selection
- Profile management
- Audio settings

**Solutions.tsx**
- AI-generated solution display
- Code comparison
- Debug interface
- Solution refinement

**Debug.tsx**
- Development debugging tools
- State inspection
- Log viewing

#### Components (components/)

**Queue/**
- `QueueCommands.tsx` - Command buttons and controls
- `ScreenshotQueue.tsx` - Screenshot grid display

**Solutions/**
- `SolutionCommands.tsx` - Solution action buttons

**AudioListener/**
- `QuestionSidePanel.tsx` - Detected questions panel

**UI (ui/)**
- Radix UI component wrappers
- Custom dialogs (auth, permissions)
- Toast notifications
- Mode selector

#### Hooks (hooks/)
- `useVerticalResize.ts` - Window resize handling

#### Types (types/)
- TypeScript type definitions
- Electron API types
- Audio types
- Mode types
- Solution types

---

## Data Flow

### Screenshot Processing Flow
```
1. User presses Cmd+H
2. Shortcut triggers takeScreenshot()
3. Window hides temporarily
4. screenshot-desktop captures screen
5. Image saved to temp directory
6. Window shows again
7. Preview generated (Sharp)
8. Path + preview sent to renderer
9. Displayed in screenshot queue
```

### Audio Question Flow
```
1. User enables audio listening
2. AudioStreamProcessor starts capture
3. Audio chunks sent to OpenAI Whisper
4. Transcription returned
5. QuestionDetector analyzes text
6. Questions extracted and refined
7. Questions displayed in side panel
8. User clicks question
9. LLMHelper generates answer with RAG
10. Answer displayed in chat
```

### Solution Generation Flow
```
1. User clicks "Generate Solution"
2. Screenshots sent to ProcessingHelper
3. LLMHelper extracts problem from images (Gemini Vision)
4. Problem structure parsed
5. LLMHelper generates solution (Gemini)
6. Solution formatted and returned
7. Displayed in Solutions page
8. User can debug or refine
```

### RAG (Retrieval Augmented Generation) Flow
```
1. User asks question
2. Question embedded (Gemini)
3. Vector similarity search (Supabase)
4. Top K relevant Q&As retrieved
5. Context built with relevant answers
6. Gemini generates response with context
7. Response returned to user
```

---

## Key Design Patterns

### 1. Service Layer Pattern
All business logic encapsulated in service classes:
- `AuthService`, `QnAService`, `DocumentService`, etc.
- Services injected into AppState
- Services communicate through AppState

### 2. Event-Driven Architecture
- Main process emits events to renderer
- Renderer listens and updates UI
- Decouples main and renderer processes

### 3. IPC Communication
- Renderer invokes main process via `window.electronAPI`
- Main process handles via `ipcMain.handle()`
- Async/await for all IPC calls

### 4. State Management
- React Query for server state (collections, auth)
- React useState for local UI state
- AppState for main process state

### 5. Mode System
- Pluggable conversation modes
- Each mode has system prompt
- Modes can be switched dynamically
- Modes affect LLM behavior

---

## Security Considerations

### 1. API Keys
- Stored in .env file
- Never exposed to renderer
- Loaded in main process only

### 2. Authentication
- Supabase handles auth
- Tokens stored securely (TokenStorage)
- Session validated on each request

### 3. Permissions
- Microphone permission required
- Screen recording permission required
- Permission state persisted
- First-time setup flow

### 4. IPC Security
- Input validation on all handlers
- Error handling and sanitization
- No direct file system access from renderer

---

## Performance Optimizations

### 1. Audio Processing
- Batch processing of questions
- Debouncing of transcription
- Efficient audio buffer management

### 2. Image Processing
- Sharp for fast image resizing
- Preview generation for thumbnails
- Lazy loading of full images

### 3. Vector Search
- Embedding caching
- Similarity threshold filtering
- Limited result count

### 4. React Query
- Infinite cache for static data
- Optimistic updates
- Background refetching disabled

---

## Development Workflow

### Build Process
```bash
# Development
npm run dev          # Start Vite dev server
npm run electron:dev # Start Electron in dev mode
npm start            # Run both concurrently

# Production
npm run build        # Build React + Electron
npm run app:build    # Create distributable
```

### File Structure
```
CueMeFinal/
├── electron/          # Main process code
│   ├── main.ts       # Entry point
│   ├── preload.ts    # Preload script
│   ├── ipcHandlers.ts
│   └── [services]
├── src/              # Renderer process code
│   ├── _pages/       # Page components
│   ├── components/   # Reusable components
│   ├── hooks/        # Custom hooks
│   ├── types/        # TypeScript types
│   └── App.tsx       # Root component
├── assets/           # Static assets
├── dist/             # Built React app
├── dist-electron/    # Built Electron code
└── release/          # Distributable packages
```

---

## Future Improvements

### Planned Refactoring
1. Split large files (main.ts, ipcHandlers.ts, QueueCommands.tsx)
2. Extract custom hooks from components
3. Create utility modules for shared code
4. Improve error handling consistency
5. Add comprehensive logging

### Feature Enhancements
1. Multi-language support
2. Custom mode creation
3. Export Q&A collections
4. Offline mode
5. Plugin system

---

## Troubleshooting

### Common Issues

**Audio not working:**
- Check microphone permissions
- Verify OpenAI API key
- Check audio source selection

**Screenshots not capturing:**
- Check screen recording permission
- Verify screenshot-desktop installation
- Check temp directory permissions

**Authentication failing:**
- Verify Supabase credentials
- Check network connection
- Clear token storage

**Build failing:**
- Clear node_modules and reinstall
- Check TypeScript errors
- Verify native module compilation

---

## References

### Documentation
- [Electron Docs](https://www.electronjs.org/docs)
- [React Query](https://tanstack.com/query/latest)
- [Supabase](https://supabase.com/docs)
- [Gemini API](https://ai.google.dev/docs)
- [OpenAI API](https://platform.openai.com/docs)

### Key Files
- `package.json` - Dependencies and scripts
- `electron/main.ts` - Main process entry
- `src/App.tsx` - Renderer entry
- `vite.config.ts` - Build configuration
- `.env` - Environment variables

---

**Last Updated:** 2025/10/8
**Version:** 1.0
**Status:** Current Architecture (Pre-Refactor)
