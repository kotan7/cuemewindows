# Code Restructure Task

## Goal
Restructure the CueMe Electron app to improve code organization and maintainability without changing any functionality or UI. The project has grown organically and now needs better file organization to help LLMs and developers navigate the codebase more efficiently.

## Current Issues Identified

### 1. **Oversized Files**
Files that are too large and should be broken into smaller, focused modules:

**Frontend (src/):**
- `src/components/Queue/QueueCommands.tsx` (1,230 lines) - Handles too many responsibilities
- `src/_pages/Queue.tsx` (1,169 lines) - Main queue page with mixed concerns
- `src/_pages/Solutions.tsx` (566 lines) - Solutions page with embedded logic
- `src/App.tsx` (506 lines) - Root component with auth, permissions, and routing
- `src/components/AudioSettings.tsx` (429 lines) - Complex audio configuration UI
- `src/_pages/Debug.tsx` (418 lines) - Debug page (may not be needed in production)
- `src/components/ui/permission-dialog.tsx` (395 lines) - Permission setup flow

**Backend (electron/):**
- `electron/main.ts` (1,171 lines) - Main process with AppState class and setup
- `electron/AudioStreamProcessor.ts` (1,004 lines) - Audio processing logic
- `electron/SystemAudioCapture.ts` (826 lines) - System audio capture
- `electron/ipcHandlers.ts` (803 lines) - All IPC handlers in one file
- `electron/LLMHelper.ts` (554 lines) - LLM integration logic

### 2. **Unused/Obsolete Files**
Files that appear to be unused or for testing only:
- `src/test-japanese.tsx` - Not imported anywhere
- `test.p12` - Certificate file in root (should be in assets or removed)
- `image.png` - Unclear purpose in root
- `tasks/` folder - Old task tracking (should use .agent/tasks instead)

### 3. **Poor Folder Organization**
- Mixed concerns in single files
- No clear separation between features
- Helper classes mixed with main logic
- UI components not properly grouped by feature

## Restructuring Plan

### Phase 1: Clean Up Unused Files
**Goal:** Remove files that are not used in the application

**Actions:**
1. Delete `src/test-japanese.tsx` (not imported)
2. Move or delete `test.p12` (if not needed for signing)
3. Move or delete `image.png` from root
4. Archive `tasks/ALWAYS_ON_LISTENING.md` to `.agent/tasks/DONE_ALWAYS_ON_LISTENING.md`

**Verification:** Run build and ensure no errors

---

### Phase 2: Restructure Electron Main Process
**Goal:** Break down large electron files into focused modules

#### 2.1 Split `electron/main.ts` (1,171 lines)
**Current structure:**
- AppState class (manages all app state)
- Deep link handling
- Auth callback server
- Audio stream event setup
- App initialization

**New structure:**
```
electron/
├── main.ts (entry point, ~200 lines)
├── core/
│   ├── AppState.ts (core state management, ~400 lines)
│   ├── DeepLinkHandler.ts (protocol handling, ~150 lines)
│   └── AuthCallbackServer.ts (HTTP server for auth, ~100 lines)
└── [existing files remain]
```

**Benefits:**
- Easier to find specific functionality
- Better testability
- Clearer dependencies

#### 2.2 Split `electron/ipcHandlers.ts` (803 lines)
**Current structure:**
- All IPC handlers in one file (40+ handlers)

**New structure:**
```
electron/
├── ipc/
│   ├── index.ts (exports all handlers, ~50 lines)
│   ├── windowHandlers.ts (window management, ~100 lines)
│   ├── screenshotHandlers.ts (screenshot operations, ~100 lines)
│   ├── audioHandlers.ts (audio stream & processing, ~200 lines)
│   ├── authHandlers.ts (authentication, ~100 lines)
│   ├── qnaHandlers.ts (Q&A collections, ~150 lines)
│   └── permissionHandlers.ts (permission management, ~100 lines)
```

**Benefits:**
- Grouped by feature domain
- Easier to locate specific handlers
- Better code organization

#### 2.3 Split `electron/AudioStreamProcessor.ts` (1,004 lines)
**Current structure:**
- Audio capture
- Transcription
- Question detection
- Batch processing
- Event management

**New structure:**
```
electron/
├── audio/
│   ├── AudioStreamProcessor.ts (main coordinator, ~300 lines)
│   ├── AudioTranscriber.ts (OpenAI Whisper integration, ~200 lines)
│   ├── AudioBatchProcessor.ts (batch processing logic, ~200 lines)
│   └── AudioEventEmitter.ts (event management, ~150 lines)
└── [existing files]
```

**Benefits:**
- Single responsibility per file
- Easier to test individual components
- Clearer audio processing pipeline

---

### Phase 3: Restructure React Frontend
**Goal:** Break down large React components into smaller, focused components

#### 3.1 Split `src/_pages/Queue.tsx` (1,169 lines)
**Current structure:**
- Main queue page
- Profile dropdown
- Mode selector
- Chat interface
- Toast notifications
- Screenshot queue
- Audio settings

**New structure:**
```
src/
├── _pages/
│   └── Queue.tsx (main page coordinator, ~300 lines)
├── components/
│   └── Queue/
│       ├── QueueCommands.tsx (existing, may need refactor)
│       ├── ScreenshotQueue.tsx (existing)
│       ├── ProfileDropdown.tsx (user profile menu, ~150 lines)
│       ├── ChatInterface.tsx (chat UI, ~200 lines)
│       ├── ModeSelector.tsx (mode selection, ~100 lines)
│       └── QueueToasts.tsx (toast notifications, ~100 lines)
```

**Benefits:**
- Reusable components
- Easier to maintain
- Better component testing

#### 3.2 Split `src/components/Queue/QueueCommands.tsx` (1,230 lines)
**Current structure:**
- Command buttons
- Audio recording
- Response mode selection
- Collection management
- Audio stream controls

**New structure:**
```
src/components/Queue/
├── QueueCommands.tsx (main coordinator, ~200 lines)
├── commands/
│   ├── AudioRecordButton.tsx (~200 lines)
│   ├── ResponseModeSelector.tsx (~200 lines)
│   ├── CollectionDropdown.tsx (~150 lines)
│   ├── AudioStreamControls.tsx (~200 lines)
│   └── CommandTooltip.tsx (~100 lines)
```

**Benefits:**
- Each button/control is self-contained
- Easier to add new commands
- Better code reuse

#### 3.3 Split `src/_pages/Solutions.tsx` (566 lines)
**Current structure:**
- Solutions display
- Debug interface
- Code comparison
- Solution commands

**New structure:**
```
src/
├── _pages/
│   └── Solutions.tsx (main coordinator, ~200 lines)
├── components/
│   └── Solutions/
│       ├── SolutionCommands.tsx (existing)
│       ├── SolutionDisplay.tsx (~150 lines)
│       ├── DebugInterface.tsx (~150 lines)
│       └── CodeComparison.tsx (~100 lines)
```

**Benefits:**
- Clearer separation of concerns
- Reusable solution components
- Easier to test

#### 3.4 Refactor `src/App.tsx` (506 lines)
**Current structure:**
- Root component
- Auth state management
- Permission state management
- View routing
- Multiple useEffects

**New structure:**
```
src/
├── App.tsx (main coordinator, ~200 lines)
├── hooks/
│   ├── useAuth.ts (auth state management, ~100 lines)
│   ├── usePermissions.ts (permission state, ~80 lines)
│   └── useVerticalResize.ts (existing)
├── components/
│   └── AppRouter.tsx (view routing logic, ~100 lines)
```

**Benefits:**
- Custom hooks for state management
- Cleaner App component
- Better testability

#### 3.5 Split `src/components/AudioSettings.tsx` (429 lines)
**Current structure:**
- Audio source selection
- Permission management
- Settings UI
- Troubleshooting

**New structure:**
```
src/components/AudioSettings/
├── index.tsx (main component, ~150 lines)
├── AudioSourceList.tsx (~100 lines)
├── PermissionStatus.tsx (~80 lines)
└── TroubleshootingPanel.tsx (~100 lines)
```

**Benefits:**
- Modular audio settings
- Easier to maintain
- Better UX iteration

---

### Phase 4: Organize Shared Utilities
**Goal:** Better organization of shared code

#### 4.1 Create Electron Utilities Folder
```
electron/
├── utils/
│   ├── env.ts (environment loading logic)
│   ├── logger.ts (logging utilities)
│   └── validation.ts (input validation)
```

#### 4.2 Create React Utilities Folder
```
src/
├── utils/
│   ├── formatting.ts (text/date formatting)
│   ├── validation.ts (form validation)
│   └── constants.ts (app constants)
```

---

### Phase 5: Update Documentation
**Goal:** Reflect new structure in .agent docs

#### 5.1 Create System Architecture Doc
Create `.agent/system/ARCHITECTURE.md`:
- Project structure overview
- Key modules and their responsibilities
- Data flow diagrams
- Integration points

#### 5.2 Create Component Map
Create `.agent/system/COMPONENT_MAP.md`:
- Frontend component hierarchy
- Backend service dependencies
- IPC communication patterns

#### 5.3 Update README
Update `.agent/README.md`:
- Project overview
- Tech stack
- Key features
- Development setup

---

## Implementation Order

### Sprint 1: Cleanup & Backend (Days 1-2)
1. ✅ Create this plan document
2. Delete unused files
3. Split `electron/main.ts`
4. Split `electron/ipcHandlers.ts`
5. Test build and functionality

### Sprint 2: Audio & Services (Days 3-4)
6. Split `electron/AudioStreamProcessor.ts`
7. Organize electron utilities
8. Test audio functionality
9. Verify all IPC handlers work

### Sprint 3: Frontend Pages (Days 5-6)
10. Split `src/App.tsx` and create hooks
11. Split `src/_pages/Queue.tsx`
12. Split `src/_pages/Solutions.tsx`
13. Test all page navigation

### Sprint 4: Frontend Components (Days 7-8)
14. Split `src/components/Queue/QueueCommands.tsx`
15. Split `src/components/AudioSettings.tsx`
16. Organize React utilities
17. Test all UI interactions

### Sprint 5: Documentation & Verification (Day 9)
18. Create architecture documentation
19. Create component map
20. Update README
21. Final testing
22. Mark task as DONE

---

## Success Criteria

### Functional Requirements
- ✅ All existing features work exactly as before
- ✅ No UI changes visible to users
- ✅ All shortcuts and hotkeys work
- ✅ Audio streaming works
- ✅ Authentication works
- ✅ Screenshot capture works
- ✅ Q&A collections work

### Code Quality Requirements
- ✅ No file over 400 lines
- ✅ Clear separation of concerns
- ✅ Logical folder structure
- ✅ No duplicate code
- ✅ All imports resolve correctly
- ✅ TypeScript compiles without errors
- ✅ Build succeeds

### Documentation Requirements
- ✅ Architecture doc created
- ✅ Component map created
- ✅ README updated
- ✅ This task marked as DONE

---

## Risk Mitigation

### Risks
1. **Breaking existing functionality** - Mitigate by testing after each phase
2. **Import path issues** - Use TypeScript compiler to catch errors
3. **State management bugs** - Test all user flows after refactoring
4. **Build failures** - Verify build after each major change

### Testing Strategy
- Run `npm run build` after each phase
- Manual testing of key features:
  - Take screenshot (Cmd+H)
  - Toggle window (Cmd+Shift+Space)
  - Audio recording
  - Authentication
  - Q&A collections
  - Mode switching

---

## Notes
- This is a pure refactoring task - NO functional changes
- All existing tests should continue to pass
- Focus on making the codebase more maintainable
- Prioritize clarity over cleverness
- Keep related code together

---

## Status: PLANNING
**Created:** 2025/10/8
**Last Updated:** 2025/10/8
**Assigned To:** Kiro AI
**Priority:** High
**Estimated Time:** 9 days
