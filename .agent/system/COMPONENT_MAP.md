# CueMe Component Map

## Purpose
This document provides a detailed map of all components, services, and their relationships to help developers and LLMs quickly locate relevant code.

---

## Frontend Component Hierarchy

### App Root
```
App.tsx (506 lines)
├── State Management
│   ├── authState (user, session, isLoading)
│   ├── permissionState (isFirstTime, isLoading, isCompleted)
│   └── view (queue | solutions | debug)
├── Dialogs
│   ├── PermissionDialog (first-time setup)
│   ├── AuthDialog (login/signup)
│   └── DevAuthDialog (developer auth shortcut)
└── Pages
    ├── Queue (main page)
    ├── Solutions (AI solutions)
    └── Debug (development only)
```

### Queue Page
```
_pages/Queue.tsx (1,169 lines) ⚠️ NEEDS REFACTORING
├── Components
│   ├── ProfileDropdown (inline, ~150 lines)
│   │   ├── User info display
│   │   ├── Mode selector
│   │   ├── Audio settings
│   │   └── Sign out button
│   ├── ChatInterface (inline, ~200 lines)
│   │   ├── Message list
│   │   ├── Input field
│   │   ├── Send button
│   │   └── Mode toggle
│   ├── ScreenshotQueue
│   │   └── Screenshot grid display
│   ├── QueueCommands
│   │   └── Command buttons
│   └── QuestionSidePanel
│       └── Detected questions list
├── State
│   ├── chatMessages
│   ├── chatInput
│   ├── isProcessing
│   ├── selectedMode
│   ├── responseMode
│   ├── detectedQuestions
│   └── audioStreamState
└── Hooks
    ├── useQuery (screenshots)
    ├── useVerticalResize
    └── useEffect (event listeners)
```

### QueueCommands Component
```
components/Queue/QueueCommands.tsx (1,230 lines) ⚠️ NEEDS REFACTORING
├── Features
│   ├── Audio Recording (inline, ~200 lines)
│   │   ├── Record button
│   │   ├── File upload
│   │   └── Result display
│   ├── Response Mode Selector (inline, ~200 lines)
│   │   ├── Dropdown trigger
│   │   ├── Collection list
│   │   └── Mode selection
│   ├── Audio Stream Controls (inline, ~200 lines)
│   │   ├── Start/stop listening
│   │   ├── Audio source selection
│   │   └── Permission handling
│   └── Command Tooltip (inline, ~100 lines)
│       └── Keyboard shortcuts display
├── State
│   ├── isTooltipVisible
│   ├── audioResult
│   ├── isDropdownOpen
│   ├── collections
│   ├── isListening
│   ├── audioStreamState
│   └── audioContext
└── Refs
    ├── tooltipRef
    ├── dropdownRef
    ├── triggerRef
    └── audioContext
```

### Solutions Page
```
_pages/Solutions.tsx (566 lines) ⚠️ NEEDS REFACTORING
├── Components
│   ├── SolutionDisplay (inline, ~150 lines)
│   │   ├── Problem statement
│   │   ├── Solution code
│   │   └── Explanation
│   ├── DebugInterface (inline, ~150 lines)
│   │   ├── Debug input
│   │   ├── Code comparison
│   │   └── Error display
│   └── SolutionCommands
│       └── Action buttons
├── State
│   ├── solution
│   ├── problemStatement
│   ├── debugSolution
│   ├── isProcessing
│   └── error
└── Hooks
    └── useQuery (solution, problem)
```

### Audio Components
```
components/AudioSettings.tsx (429 lines) ⚠️ NEEDS REFACTORING
├── Features
│   ├── AudioSourceList (inline, ~100 lines)
│   │   ├── Source selection
│   │   └── Source info
│   ├── PermissionStatus (inline, ~80 lines)
│   │   ├── Status display
│   │   └── Request buttons
│   └── TroubleshootingPanel (inline, ~100 lines)
│       ├── Common issues
│       └── Solutions
└── State
    ├── audioSources
    ├── selectedSource
    ├── permissionStatus
    └── isLoading

components/AudioSourceSelector.tsx (271 lines)
├── Source list display
├── Selection handling
└── Permission checks

components/AudioLevelIndicator.tsx (123 lines)
├── Audio level visualization
└── Real-time updates

components/AudioTroubleshootingHelp.tsx (173 lines)
├── Help content
└── Troubleshooting steps

components/AudioListener/QuestionSidePanel.tsx (240 lines)
├── Question list
├── Answer generation
└── Collection selection
```

### UI Components
```
components/ui/
├── auth-dialog.tsx (256 lines)
│   ├── Sign in form
│   ├── Sign up form
│   └── Password reset
├── dev-auth-dialog.tsx (264 lines)
│   ├── Developer login
│   └── Quick auth
├── permission-dialog.tsx (395 lines)
│   ├── Permission setup flow
│   ├── Microphone permission
│   └── Screen recording permission
├── mode-select.tsx (197 lines)
│   ├── Mode dropdown
│   └── Mode options
├── dialog.tsx
├── toast.tsx (120 lines)
└── [other Radix UI wrappers]
```

---

## Backend Service Architecture

### Main Process Entry
```
electron/main.ts (1,171 lines) ⚠️ NEEDS REFACTORING
├── Environment Loading (~100 lines)
│   └── .env file loading with fallbacks
├── AppState Class (~600 lines)
│   ├── Constructor
│   │   ├── Initialize all services
│   │   ├── Setup auth callback server
│   │   └── Setup audio stream events
│   ├── Getters/Setters
│   │   ├── Window management
│   │   ├── Screenshot management
│   │   └── State management
│   └── Methods
│       ├── Window operations
│       ├── Screenshot operations
│       └── Tray management
├── Auth Callback Server (~150 lines)
│   ├── HTTP server setup
│   ├── Token extraction
│   └── Success/error pages
├── Deep Link Handling (~200 lines)
│   ├── Protocol registration
│   ├── URL parsing
│   └── Auth token handling
└── App Initialization (~100 lines)
    ├── Window creation
    ├── IPC handler setup
    └── Event listeners
```

### IPC Handlers
```
electron/ipcHandlers.ts (803 lines) ⚠️ NEEDS REFACTORING
├── Window Handlers (~100 lines)
│   ├── update-content-dimensions
│   ├── toggle-window
│   ├── move-window-*
│   └── center-and-show-window
├── Screenshot Handlers (~100 lines)
│   ├── take-screenshot
│   ├── get-screenshots
│   ├── delete-screenshot
│   └── reset-queues
├── Audio Handlers (~200 lines)
│   ├── analyze-audio-base64
│   ├── analyze-audio-file
│   ├── audio-stream-start
│   ├── audio-stream-stop
│   ├── audio-stream-process-chunk
│   ├── audio-stream-get-state
│   ├── audio-stream-get-questions
│   ├── audio-stream-clear-questions
│   ├── audio-stream-answer-question
│   ├── audio-get-sources
│   ├── audio-switch-source
│   ├── audio-request-permissions
│   └── audio-check-system-support
├── Auth Handlers (~100 lines)
│   ├── auth-sign-in
│   ├── auth-sign-up
│   ├── auth-sign-out
│   ├── auth-get-state
│   └── auth-reset-password
├── Q&A Handlers (~150 lines)
│   ├── qna-get-collections
│   ├── qna-get-collection
│   ├── qna-get-collection-items
│   ├── qna-search-items
│   └── qna-find-relevant
├── LLM Handlers (~100 lines)
│   ├── gemini-chat
│   ├── gemini-chat-mode
│   ├── gemini-chat-rag
│   ├── get-available-modes
│   └── analyze-image-file
└── Permission Handlers (~100 lines)
    ├── permission-check-first-time
    ├── permission-check-status
    ├── permission-request-microphone
    └── permission-open-system-preferences
```

### Core Services

#### AudioStreamProcessor
```
electron/AudioStreamProcessor.ts (1,004 lines) ⚠️ NEEDS REFACTORING
├── Audio Capture (~200 lines)
│   ├── Microphone capture
│   ├── System audio capture
│   └── Audio source management
├── Transcription (~200 lines)
│   ├── OpenAI Whisper integration
│   ├── Audio buffer management
│   └── Transcription result handling
├── Question Detection (~200 lines)
│   ├── Text analysis
│   ├── Question extraction
│   └── Question refinement
├── Batch Processing (~200 lines)
│   ├── Batch accumulation
│   ├── Batch timing
│   └── Batch processing
└── Event Management (~150 lines)
    ├── Event emitter
    ├── State broadcasting
    └── Error handling
```

#### LLMHelper
```
electron/LLMHelper.ts (554 lines)
├── Gemini Integration (~200 lines)
│   ├── API client setup
│   ├── Chat completion
│   └── Vision analysis
├── Mode Management (~100 lines)
│   ├── Mode loading
│   ├── Mode switching
│   └── System prompt building
├── RAG Implementation (~150 lines)
│   ├── Context retrieval
│   ├── Context formatting
│   └── Response generation
└── Utilities (~100 lines)
    ├── Token counting
    ├── Error handling
    └── Response formatting
```

#### AuthService
```
electron/AuthService.ts (398 lines)
├── Supabase Client (~50 lines)
│   └── Client initialization
├── Authentication (~150 lines)
│   ├── Sign in
│   ├── Sign up
│   ├── Sign out
│   └── Password reset
├── Session Management (~100 lines)
│   ├── Token storage
│   ├── Session refresh
│   └── Session validation
└── State Management (~100 lines)
    ├── Auth state tracking
    ├── State broadcasting
    └── Event callbacks
```

#### QnAService
```
electron/QnAService.ts (335 lines)
├── Collection Management (~100 lines)
│   ├── Create collection
│   ├── Get collections
│   ├── Update collection
│   └── Delete collection
├── Q&A Items (~100 lines)
│   ├── Add Q&A
│   ├── Get Q&As
│   ├── Update Q&A
│   └── Delete Q&A
└── Vector Search (~135 lines)
    ├── Embedding generation
    ├── Similarity search
    └── Relevant answer retrieval
```

#### Other Services
```
electron/WindowHelper.ts (361 lines)
├── Window creation
├── Window positioning
├── Window visibility
└── Window dimensions

electron/ScreenshotHelper.ts (150 lines)
├── Screenshot capture
├── Queue management
├── Preview generation
└── File cleanup

electron/ProcessingHelper.ts (234 lines)
├── Solution generation
├── Problem extraction
├── Debug processing
└── Event emission

electron/UsageTracker.ts (329 lines)
├── Usage tracking
├── Rate limiting
├── Cache management
└── Statistics

electron/DocumentService.ts (213 lines)
├── Document upload
├── Text extraction
├── Chunking
└── Embedding

electron/ModeManager.ts (310 lines)
├── Mode loading
├── Mode validation
└── Mode options

electron/PermissionStorage.ts (242 lines)
├── Permission state
├── First-time setup
└── Permission requests

electron/TokenStorage.ts (148 lines)
├── Secure token storage
├── Token encryption
└── Token retrieval

electron/QuestionDetector.ts (174 lines)
├── Question pattern matching
├── Question extraction
└── Question refinement

electron/SystemAudioCapture.ts (826 lines)
├── Native audio capture
├── Audio source enumeration
└── Permission handling
```

---

## IPC Communication Patterns

### Renderer → Main (Invoke)
```typescript
// Pattern: window.electronAPI.methodName(args)
// Returns: Promise<result>

// Example: Take screenshot
const result = await window.electronAPI.takeScreenshot()
// Returns: { path: string, preview: string }

// Example: Sign in
const result = await window.electronAPI.authSignIn(email, password)
// Returns: { success: boolean, error?: string }
```

### Main → Renderer (Send)
```typescript
// Pattern: mainWindow.webContents.send(channel, data)
// Renderer listens with: window.electronAPI.onEventName(callback)

// Example: Auth state change
mainWindow.webContents.send('auth-state-changed', authState)
// Renderer: window.electronAPI.onAuthStateChange((state) => {...})

// Example: Screenshot taken
mainWindow.webContents.send('screenshot-taken', { path, preview })
// Renderer: window.electronAPI.onScreenshotTaken((data) => {...})
```

### Event Flow Examples

**Screenshot Capture:**
```
1. User presses Cmd+H
2. shortcuts.ts → appState.takeScreenshot()
3. ScreenshotHelper.takeScreenshot()
4. screenshot-desktop captures
5. Sharp generates preview
6. Returns { path, preview }
7. main.ts sends 'screenshot-taken' event
8. Queue.tsx receives event
9. React Query invalidates
10. UI updates with new screenshot
```

**Audio Question Detection:**
```
1. User enables listening
2. QueueCommands → audioStreamStart()
3. ipcHandlers → AudioStreamProcessor.startListening()
4. Audio chunks captured
5. Whisper transcribes
6. QuestionDetector analyzes
7. AudioStreamProcessor emits 'question-detected'
8. main.ts forwards to renderer
9. QuestionSidePanel receives event
10. UI displays question
```

**AI Answer Generation:**
```
1. User sends chat message
2. Queue.tsx → gemini-chat-rag(message, collectionId)
3. ipcHandlers → LLMHelper.chatWithRAG()
4. QnAService.findRelevantAnswers()
5. Supabase vector search
6. LLMHelper builds context
7. Gemini generates response
8. Returns response
9. Queue.tsx displays in chat
```

---

## File Size Analysis

### Files Over 500 Lines (Need Refactoring)
1. `src/components/Queue/QueueCommands.tsx` - 1,230 lines ⚠️
2. `src/_pages/Queue.tsx` - 1,169 lines ⚠️
3. `electron/main.ts` - 1,171 lines ⚠️
4. `electron/AudioStreamProcessor.ts` - 1,004 lines ⚠️
5. `electron/SystemAudioCapture.ts` - 826 lines ⚠️
6. `electron/ipcHandlers.ts` - 803 lines ⚠️
7. `src/_pages/Solutions.tsx` - 566 lines ⚠️
8. `electron/LLMHelper.ts` - 554 lines ⚠️
9. `src/App.tsx` - 506 lines ⚠️

### Files 300-500 Lines (Consider Refactoring)
10. `src/components/AudioSettings.tsx` - 429 lines
11. `src/_pages/Debug.tsx` - 418 lines
12. `src/components/ui/permission-dialog.tsx` - 395 lines
13. `electron/AuthService.ts` - 398 lines
14. `electron/WindowHelper.ts` - 361 lines
15. `electron/QnAService.ts` - 335 lines
16. `electron/UsageTracker.ts` - 329 lines
17. `electron/ModeManager.ts` - 310 lines

### Files Under 300 Lines (Good Size)
- Most other files are well-sized
- Easy to understand and maintain
- Single responsibility principle

---

## Dependency Graph

### Service Dependencies
```
AppState
├── WindowHelper
├── ScreenshotHelper
├── ShortcutsHelper
│   └── AppState (circular, managed)
├── ProcessingHelper
│   └── LLMHelper
│       ├── QnAService
│       ├── DocumentService
│       └── ModeManager
├── AuthService
│   └── Supabase Client
├── QnAService
│   └── Supabase Client
├── DocumentService
│   └── Supabase Client
├── UsageTracker
│   └── Supabase Client
├── AudioStreamProcessor
│   ├── SystemAudioCapture
│   ├── QuestionDetector
│   └── OpenAI Client
└── PermissionStorage
```

### Component Dependencies
```
App
├── QueryClientProvider
├── ToastProvider
├── PermissionDialog
├── AuthDialog
├── DevAuthDialog
└── Pages
    ├── Queue
    │   ├── ScreenshotQueue
    │   ├── QueueCommands
    │   ├── QuestionSidePanel
    │   └── ModeSelect
    └── Solutions
        └── SolutionCommands
```

---

## Quick Reference

### Find Code By Feature

**Authentication:**
- Backend: `electron/AuthService.ts`
- IPC: `electron/ipcHandlers.ts` (auth-* handlers)
- UI: `src/components/ui/auth-dialog.tsx`
- State: `src/App.tsx` (authState)

**Audio Processing:**
- Backend: `electron/AudioStreamProcessor.ts`
- Native: `electron/SystemAudioCapture.ts`
- IPC: `electron/ipcHandlers.ts` (audio-* handlers)
- UI: `src/components/AudioSettings.tsx`
- Controls: `src/components/Queue/QueueCommands.tsx`

**Screenshots:**
- Backend: `electron/ScreenshotHelper.ts`
- IPC: `electron/ipcHandlers.ts` (screenshot handlers)
- UI: `src/components/Queue/ScreenshotQueue.tsx`
- Shortcuts: `electron/shortcuts.ts`

**AI/LLM:**
- Backend: `electron/LLMHelper.ts`
- Processing: `electron/ProcessingHelper.ts`
- IPC: `electron/ipcHandlers.ts` (gemini-* handlers)
- Modes: `electron/ModeManager.ts`

**Q&A Collections:**
- Backend: `electron/QnAService.ts`
- IPC: `electron/ipcHandlers.ts` (qna-* handlers)
- UI: `src/components/Queue/QueueCommands.tsx` (dropdown)

**Window Management:**
- Backend: `electron/WindowHelper.ts`
- IPC: `electron/ipcHandlers.ts` (window handlers)
- Shortcuts: `electron/shortcuts.ts`

---

**Last Updated:** 2025/10/8
**Version:** 1.0
**Status:** Current Structure (Pre-Refactor)
