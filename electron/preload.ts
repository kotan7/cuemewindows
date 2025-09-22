import { contextBridge, ipcRenderer } from "electron"

// Audio source type
interface AudioSource {
  id: string;
  name: string;
  type: 'microphone' | 'system';
  available: boolean;
}

// Types for the exposed Electron API
interface ElectronAPI {
  updateContentDimensions: (dimensions: {
    width: number
    height: number
  }) => Promise<void>
  getScreenshots: () => Promise<Array<{ path: string; preview: string }>>
  deleteScreenshot: (
    path: string
  ) => Promise<{ success: boolean; error?: string }>
  onScreenshotTaken: (
    callback: (data: { path: string; preview: string }) => void
  ) => () => void
  onSolutionsReady: (callback: (solutions: string) => void) => () => void
  onResetView: (callback: () => void) => () => void
  onSolutionStart: (callback: () => void) => () => void
  onDebugStart: (callback: () => void) => () => void
  onDebugSuccess: (callback: (data: any) => void) => () => void
  onSolutionError: (callback: (error: string) => void) => () => void
  onProcessingNoScreenshots: (callback: () => void) => () => void
  onProblemExtracted: (callback: (data: any) => void) => () => void
  onSolutionSuccess: (callback: (data: any) => void) => () => void

  onUnauthorized: (callback: () => void) => () => void
  onDebugError: (callback: (error: string) => void) => () => void
  takeScreenshot: () => Promise<void>
  moveWindowLeft: () => Promise<void>
  moveWindowRight: () => Promise<void>
  moveWindowUp: () => Promise<void>
  moveWindowDown: () => Promise<void>
  analyzeAudioFromBase64: (data: string, mimeType: string, collectionId?: string) => Promise<{ text: string; timestamp: number }>
  analyzeAudioFile: (path: string, collectionId?: string) => Promise<{ text: string; timestamp: number }>
  analyzeImageFile: (path: string) => Promise<void>
  quitApp: () => Promise<void>
  invoke: (channel: string, ...args: any[]) => Promise<any>
  
  // Audio Stream methods
  audioStreamStart: (audioSourceId?: string) => Promise<{ success: boolean; error?: string }>
  audioStreamStop: () => Promise<{ success: boolean; error?: string }>
  audioStreamProcessChunk: (audioData: Float32Array) => Promise<{ success: boolean; error?: string }>
  audioStreamGetState: () => Promise<{ isListening: boolean; error?: string }>
  audioStreamGetQuestions: () => Promise<Array<{ text: string; timestamp: number }>>
  audioStreamClearQuestions: () => Promise<{ success: boolean; error?: string }>
  audioStreamAnswerQuestion: (questionText: string, collectionId?: string) => Promise<{ response: string; timestamp: number }>
  
  // System Audio methods
  audioGetSources: () => Promise<{ success: boolean; sources: AudioSource[]; error?: string }>
  audioSwitchSource: (sourceId: string) => Promise<{ success: boolean; error?: string }>
  audioRequestPermissions: () => Promise<{ granted: boolean; error?: string }>
  audioCheckSystemSupport: () => Promise<{ supported: boolean }>
  
  // Audio Stream event listeners
  onAudioQuestionDetected: (callback: (question: { text: string; timestamp: number }) => void) => () => void
  onAudioBatchProcessed: (callback: (questions: Array<{ text: string; timestamp: number }>) => void) => () => void
  onAudioStreamStateChanged: (callback: (state: { isListening: boolean; error?: string }) => void) => () => void
  onAudioStreamError: (callback: (error: string) => void) => () => void
  // Auth methods
  authSignIn: (email: string, password: string) => Promise<{ success: boolean; error?: string }>
  authSignUp: (email: string, password: string) => Promise<{ success: boolean; error?: string }>
  authSignOut: () => Promise<{ success: boolean; error?: string }>
  authGetState: () => Promise<{ user: any | null; session: any | null; isLoading: boolean }>
  authResetPassword: (email: string) => Promise<{ success: boolean; error?: string }>
  onAuthStateChange: (callback: (state: { user: any | null; session: any | null; isLoading: boolean }) => void) => () => void
  onChatToggle: (callback: () => void) => () => void
}

export const PROCESSING_EVENTS = {
  //global states
  UNAUTHORIZED: "procesing-unauthorized",
  NO_SCREENSHOTS: "processing-no-screenshots",

  //states for generating the initial solution
  INITIAL_START: "initial-start",
  PROBLEM_EXTRACTED: "problem-extracted",
  SOLUTION_SUCCESS: "solution-success",
  INITIAL_SOLUTION_ERROR: "solution-error",

  //states for processing the debugging
  DEBUG_START: "debug-start",
  DEBUG_SUCCESS: "debug-success",
  DEBUG_ERROR: "debug-error"
} as const

// Expose the Electron API to the renderer process
contextBridge.exposeInMainWorld("electronAPI", {
  updateContentDimensions: (dimensions: { width: number; height: number }) =>
    ipcRenderer.invoke("update-content-dimensions", dimensions),
  takeScreenshot: () => ipcRenderer.invoke("take-screenshot"),
  getScreenshots: () => ipcRenderer.invoke("get-screenshots"),
  deleteScreenshot: (path: string) =>
    ipcRenderer.invoke("delete-screenshot", path),

  // Event listeners
  onScreenshotTaken: (
    callback: (data: { path: string; preview: string }) => void
  ) => {
    const subscription = (_: any, data: { path: string; preview: string }) =>
      callback(data)
    ipcRenderer.on("screenshot-taken", subscription)
    return () => {
      ipcRenderer.removeListener("screenshot-taken", subscription)
    }
  },
  onSolutionsReady: (callback: (solutions: string) => void) => {
    const subscription = (_: any, solutions: string) => callback(solutions)
    ipcRenderer.on("solutions-ready", subscription)
    return () => {
      ipcRenderer.removeListener("solutions-ready", subscription)
    }
  },
  onResetView: (callback: () => void) => {
    const subscription = () => callback()
    ipcRenderer.on("reset-view", subscription)
    return () => {
      ipcRenderer.removeListener("reset-view", subscription)
    }
  },
  onSolutionStart: (callback: () => void) => {
    const subscription = () => callback()
    ipcRenderer.on(PROCESSING_EVENTS.INITIAL_START, subscription)
    return () => {
      ipcRenderer.removeListener(PROCESSING_EVENTS.INITIAL_START, subscription)
    }
  },
  onDebugStart: (callback: () => void) => {
    const subscription = () => callback()
    ipcRenderer.on(PROCESSING_EVENTS.DEBUG_START, subscription)
    return () => {
      ipcRenderer.removeListener(PROCESSING_EVENTS.DEBUG_START, subscription)
    }
  },

  onDebugSuccess: (callback: (data: any) => void) => {
    ipcRenderer.on("debug-success", (_event, data) => callback(data))
    return () => {
      ipcRenderer.removeListener("debug-success", (_event, data) =>
        callback(data)
      )
    }
  },
  onDebugError: (callback: (error: string) => void) => {
    const subscription = (_: any, error: string) => callback(error)
    ipcRenderer.on(PROCESSING_EVENTS.DEBUG_ERROR, subscription)
    return () => {
      ipcRenderer.removeListener(PROCESSING_EVENTS.DEBUG_ERROR, subscription)
    }
  },
  onSolutionError: (callback: (error: string) => void) => {
    const subscription = (_: any, error: string) => callback(error)
    ipcRenderer.on(PROCESSING_EVENTS.INITIAL_SOLUTION_ERROR, subscription)
    return () => {
      ipcRenderer.removeListener(
        PROCESSING_EVENTS.INITIAL_SOLUTION_ERROR,
        subscription
      )
    }
  },
  onProcessingNoScreenshots: (callback: () => void) => {
    const subscription = () => callback()
    ipcRenderer.on(PROCESSING_EVENTS.NO_SCREENSHOTS, subscription)
    return () => {
      ipcRenderer.removeListener(PROCESSING_EVENTS.NO_SCREENSHOTS, subscription)
    }
  },

  onProblemExtracted: (callback: (data: any) => void) => {
    const subscription = (_: any, data: any) => callback(data)
    ipcRenderer.on(PROCESSING_EVENTS.PROBLEM_EXTRACTED, subscription)
    return () => {
      ipcRenderer.removeListener(
        PROCESSING_EVENTS.PROBLEM_EXTRACTED,
        subscription
      )
    }
  },
  onSolutionSuccess: (callback: (data: any) => void) => {
    const subscription = (_: any, data: any) => callback(data)
    ipcRenderer.on(PROCESSING_EVENTS.SOLUTION_SUCCESS, subscription)
    return () => {
      ipcRenderer.removeListener(
        PROCESSING_EVENTS.SOLUTION_SUCCESS,
        subscription
      )
    }
  },
  onUnauthorized: (callback: () => void) => {
    const subscription = () => callback()
    ipcRenderer.on(PROCESSING_EVENTS.UNAUTHORIZED, subscription)
    return () => {
      ipcRenderer.removeListener(PROCESSING_EVENTS.UNAUTHORIZED, subscription)
    }
  },
  moveWindowLeft: () => ipcRenderer.invoke("move-window-left"),
  moveWindowRight: () => ipcRenderer.invoke("move-window-right"),
  moveWindowUp: () => ipcRenderer.invoke("move-window-up"),
  moveWindowDown: () => ipcRenderer.invoke("move-window-down"),
  analyzeAudioFromBase64: (data: string, mimeType: string, collectionId?: string) => ipcRenderer.invoke("analyze-audio-base64", data, mimeType, collectionId),
  analyzeAudioFile: (path: string, collectionId?: string) => ipcRenderer.invoke("analyze-audio-file", path, collectionId),
  analyzeImageFile: (path: string) => ipcRenderer.invoke("analyze-image-file", path),
  openExternalUrl: (url: string) => ipcRenderer.invoke("open-external-url", url),
  quitApp: () => ipcRenderer.invoke("quit-app"),
  invoke: (channel: string, ...args: any[]) => ipcRenderer.invoke(channel, ...args),
  
  // Audio Stream methods
  audioStreamStart: (audioSourceId?: string) => ipcRenderer.invoke("audio-stream-start", audioSourceId),
  audioStreamStop: () => ipcRenderer.invoke("audio-stream-stop"),
  audioStreamProcessChunk: (audioData: Float32Array) => ipcRenderer.invoke("audio-stream-process-chunk", audioData),
  audioStreamGetState: () => ipcRenderer.invoke("audio-stream-get-state") as Promise<{ isListening: boolean; error?: string }>,
  audioStreamGetQuestions: () => ipcRenderer.invoke("audio-stream-get-questions") as Promise<Array<{ text: string; timestamp: number }>>,
  audioStreamClearQuestions: () => ipcRenderer.invoke("audio-stream-clear-questions"),
  audioStreamAnswerQuestion: (questionText: string, collectionId?: string) => ipcRenderer.invoke("audio-stream-answer-question", questionText, collectionId),
  
  // System Audio methods
  audioGetSources: () => ipcRenderer.invoke("audio-get-sources") as Promise<{ success: boolean; sources: AudioSource[]; error?: string }>,
  audioSwitchSource: (sourceId: string) => ipcRenderer.invoke("audio-switch-source", sourceId) as Promise<{ success: boolean; error?: string }>,
  audioRequestPermissions: () => ipcRenderer.invoke("audio-request-permissions") as Promise<{ granted: boolean; error?: string }>,
  audioCheckSystemSupport: () => ipcRenderer.invoke("audio-check-system-support") as Promise<{ supported: boolean }>,
  
  // Audio Stream event listeners
  onAudioQuestionDetected: (callback: (question: any) => void) => {
    const subscription = (_: any, question: any) => callback(question)
    ipcRenderer.on("audio-question-detected", subscription)
    return () => {
      ipcRenderer.removeListener("audio-question-detected", subscription)
    }
  },
  onAudioBatchProcessed: (callback: (questions: any[]) => void) => {
    const subscription = (_: any, questions: any[]) => callback(questions)
    ipcRenderer.on("audio-batch-processed", subscription)
    return () => {
      ipcRenderer.removeListener("audio-batch-processed", subscription)
    }
  },
  onAudioStreamStateChanged: (callback: (state: any) => void) => {
    const subscription = (_: any, state: any) => callback(state)
    ipcRenderer.on("audio-stream-state-changed", subscription)
    return () => {
      ipcRenderer.removeListener("audio-stream-state-changed", subscription)
    }
  },
  onAudioStreamError: (callback: (error: string) => void) => {
    const subscription = (_: any, error: string) => callback(error)
    ipcRenderer.on("audio-stream-error", subscription)
    return () => {
      ipcRenderer.removeListener("audio-stream-error", subscription)
    }
  },
  
  // Auth methods
  authSignIn: (email: string, password: string) => ipcRenderer.invoke("auth-sign-in", email, password),
  authSignUp: (email: string, password: string) => ipcRenderer.invoke("auth-sign-up", email, password),
  authSignOut: () => ipcRenderer.invoke("auth-sign-out"),
  authGetState: () => ipcRenderer.invoke("auth-get-state"),
  authResetPassword: (email: string) => ipcRenderer.invoke("auth-reset-password", email),
  onAuthStateChange: (callback: (state: { user: any | null; session: any | null; isLoading: boolean }) => void) => {
    const subscription = (_: any, state: { user: any | null; session: any | null; isLoading: boolean }) => callback(state)
    ipcRenderer.on("auth-state-changed", subscription)
    return () => {
      ipcRenderer.removeListener("auth-state-changed", subscription)
    }
  },
  onChatToggle: (callback: () => void) => {
    const subscription = () => callback()
    ipcRenderer.on("toggle-chat", subscription)
    return () => {
      ipcRenderer.removeListener("toggle-chat", subscription)
    }
  }
} as ElectronAPI)
