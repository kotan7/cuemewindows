import { ToastProvider } from "./components/ui/toast";
import { ToastViewport } from "@radix-ui/react-toast";
import { useEffect, useRef, useState } from "react";
import { QueryClient, QueryClientProvider } from "react-query";
import { AuthDialog } from "./components/ui/auth-dialog";
import { DevAuthDialog } from "./components/ui/dev-auth-dialog";
import { PermissionDialog } from "./components/ui/permission-dialog";
import { AppRouter } from "./components/AppRouter";
import { useAuth } from "./hooks/useAuth";
import { usePermissions } from "./hooks/usePermissions";

declare global {
  interface Window {
    electronAPI: {
      //RANDOM GETTER/SETTERS
      updateContentDimensions: (dimensions: {
        width: number;
        height: number;
      }) => Promise<void>;
      getScreenshots: () => Promise<Array<{ path: string; preview: string }>>;

      //GLOBAL EVENTS
      //TODO: CHECK THAT PROCESSING NO SCREENSHOTS AND TAKE SCREENSHOTS ARE BOTH CONDITIONAL
      onUnauthorized: (callback: () => void) => () => void;
      onScreenshotTaken: (
        callback: (data: { path: string; preview: string }) => void
      ) => () => void;
      onProcessingNoScreenshots: (callback: () => void) => () => void;
      onResetView: (callback: () => void) => () => void;
      takeScreenshot: () => Promise<void>;

      //INITIAL SOLUTION EVENTS
      deleteScreenshot: (
        path: string
      ) => Promise<{ success: boolean; error?: string }>;
      onSolutionStart: (callback: () => void) => () => void;
      onSolutionError: (callback: (error: string) => void) => () => void;
      onSolutionSuccess: (callback: (data: any) => void) => () => void;
      onProblemExtracted: (callback: (data: any) => void) => () => void;

      onDebugSuccess: (callback: (data: any) => void) => () => void;

      onDebugStart: (callback: () => void) => () => void;
      onDebugError: (callback: (error: string) => void) => () => void;

      // Audio Processing
      analyzeAudioFromBase64: (
        data: string,
        mimeType: string,
        collectionId?: string
      ) => Promise<{ text: string; timestamp: number }>;
      analyzeAudioFile: (
        path: string,
        collectionId?: string
      ) => Promise<{ text: string; timestamp: number }>;

      // Audio Stream methods
      audioStreamStart: (
        sourceId?: string
      ) => Promise<{ success: boolean; error?: string }>;
      audioStreamStop: () => Promise<{ success: boolean; error?: string }>;
      audioStreamProcessChunk: (
        audioData: Float32Array
      ) => Promise<{ success: boolean; error?: string }>;
      audioStreamGetState: () => Promise<{
        isListening: boolean;
        error?: string;
      }>;
      audioStreamGetQuestions: () => Promise<
        Array<{ text: string; timestamp: number }>
      >;
      audioStreamClearQuestions: () => Promise<{
        success: boolean;
        error?: string;
      }>;
      audioStreamAnswerQuestion: (
        questionText: string,
        collectionId?: string
      ) => Promise<{ response: string; timestamp: number }>;

      // System Audio methods
      audioGetSources: () => Promise<{
        success: boolean;
        sources: any[];
        error?: string;
      }>;
      audioSwitchSource: (
        sourceId: string
      ) => Promise<{ success: boolean; error?: string }>;
      audioRequestPermissions: () => Promise<{
        granted: boolean;
        error?: string;
      }>;
      audioCheckSystemSupport: () => Promise<{ supported: boolean }>;

      moveWindowLeft: () => Promise<void>;
      moveWindowRight: () => Promise<void>;
      moveWindowUp: () => Promise<void>;
      moveWindowDown: () => Promise<void>;
      quitApp: () => Promise<void>;
      invoke: (channel: string, ...args: any[]) => Promise<any>;
      onChatToggle: (callback: () => void) => () => void;

      // Audio Stream event listeners
      onAudioQuestionDetected: (
        callback: (question: any) => void
      ) => () => void;
      onAudioBatchProcessed: (
        callback: (questions: any[]) => void
      ) => () => void;
      onAudioStreamStateChanged: (callback: (state: any) => void) => () => void;
      onAudioStreamError: (callback: (error: string) => void) => () => void;

      // Auth methods
      authSignIn: (
        email: string,
        password: string
      ) => Promise<{ success: boolean; error?: string }>;
      authSignUp: (
        email: string,
        password: string
      ) => Promise<{ success: boolean; error?: string }>;
      authSignOut: () => Promise<{ success: boolean; error?: string }>;
      authGetState: () => Promise<{
        user: any | null;
        session: any | null;
        isLoading: boolean;
      }>;
      authResetPassword: (
        email: string
      ) => Promise<{ success: boolean; error?: string }>;
      onAuthStateChange: (
        callback: (state: {
          user: any | null;
          session: any | null;
          isLoading: boolean;
        }) => void
      ) => () => void;
      onDevAuthOpen: (callback: () => void) => () => void;
    };
  }
}

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: Infinity,
      cacheTime: Infinity,
    },
  },
});

const App: React.FC = () => {
  const [view, setView] = useState<"queue" | "solutions" | "debug">("queue");
  const containerRef = useRef<HTMLDivElement>(null);
  const [isDevAuthOpen, setIsDevAuthOpen] = useState(false);

  // Use custom hooks for auth and permissions
  const [permissionState, handlePermissionsCompleted] = usePermissions();
  const [authState, authHandlers] = useAuth(queryClient);

  // Listen for developer auth shortcut
  useEffect(() => {
    const devAuthCleanup = window.electronAPI.onDevAuthOpen(() => {
      console.log("Developer auth dialog requested via Command+Z");
      setIsDevAuthOpen(true);
    });

    // Close dev auth dialog when user signs in
    if (authState.user && !authState.isLoading) {
      setIsDevAuthOpen(false);
    }

    return devAuthCleanup;
  }, [authState.user, authState.isLoading]);

  // Effect for height monitoring and reset view
  useEffect(() => {
    const cleanup = window.electronAPI.onResetView(() => {
      console.log("Received 'reset-view' message from main process.");
      queryClient.invalidateQueries(["screenshots"]);
      queryClient.invalidateQueries(["problem_statement"]);
      queryClient.invalidateQueries(["solution"]);
      queryClient.invalidateQueries(["new_solution"]);
      setView("queue");
    });

    return cleanup;
  }, []);

  // Effect for content dimensions monitoring
  useEffect(() => {
    if (!containerRef.current) return;

    const updateHeight = () => {
      if (!containerRef.current) return;
      const height = containerRef.current.scrollHeight;
      const width = containerRef.current.scrollWidth;
      window.electronAPI?.updateContentDimensions({ width, height });
    };

    const resizeObserver = new ResizeObserver(updateHeight);
    const mutationObserver = new MutationObserver(updateHeight);

    // Initial height update
    updateHeight();

    // Observe for changes
    resizeObserver.observe(containerRef.current);
    mutationObserver.observe(containerRef.current, {
      childList: true,
      subtree: true,
      attributes: true,
      characterData: true,
    });

    return () => {
      resizeObserver.disconnect();
      mutationObserver.disconnect();
    };
  }, [view]);

  // If permissions are loading, show loading
  if (permissionState.isLoading) {
    return (
      <div
        ref={containerRef}
        className="w-full flex items-center justify-center"
        style={{ width: "500px", height: "600px" }}
      >
        <QueryClientProvider client={queryClient}>
          <ToastProvider>
            <div className="text-center" style={{ color: "#013220" }}>
              <div
                className="animate-spin rounded-full h-8 w-8 border-b-2 mx-auto mb-2"
                style={{ borderColor: "#013220" }}
              ></div>
              <p>アプリを初期化中...</p>
            </div>
            <ToastViewport />
          </ToastProvider>
        </QueryClientProvider>
      </div>
    );
  }

  // If first time setup and permissions not completed, show permission dialog
  if (permissionState.isFirstTime && !permissionState.isCompleted) {
    return (
      <div
        ref={containerRef}
        className="w-full flex items-center justify-center"
        style={{ width: "500px", height: "600px" }}
      >
        <QueryClientProvider client={queryClient}>
          <ToastProvider>
            <PermissionDialog
              isOpen={true}
              onOpenChange={() => {}} // Prevent closing until completed
              onPermissionsCompleted={handlePermissionsCompleted}
            />
            <ToastViewport />
          </ToastProvider>
        </QueryClientProvider>
      </div>
    );
  }

  // If user is not authenticated, show auth dialog
  if (!authState.user && !authState.isLoading) {
    return (
      <div
        ref={containerRef}
        className="w-full flex items-center justify-center"
        style={{ width: "500px", height: "600px" }}
      >
        <QueryClientProvider client={queryClient}>
          <ToastProvider>
            <AuthDialog
              isOpen={!isDevAuthOpen}
              onOpenChange={() => {}} // Prevent closing until authenticated
              authState={authState}
              onSignIn={authHandlers.handleSignIn}
              onSignUp={authHandlers.handleSignUp}
              onSignOut={authHandlers.handleSignOut}
              onResetPassword={authHandlers.handleResetPassword}
            />
            <DevAuthDialog
              isOpen={isDevAuthOpen}
              onOpenChange={setIsDevAuthOpen}
              onSignIn={authHandlers.handleSignIn}
              onSignUp={authHandlers.handleSignUp}
            />
            <ToastViewport />
          </ToastProvider>
        </QueryClientProvider>
      </div>
    );
  }

  // If auth is loading, show loading
  if (authState.isLoading) {
    return (
      <div
        ref={containerRef}
        className="w-full flex items-center justify-center"
        style={{ width: "500px", height: "600px" }}
      >
        <QueryClientProvider client={queryClient}>
          <ToastProvider>
            <div className="text-center" style={{ color: "#013220" }}>
              <div
                className="animate-spin rounded-full h-8 w-8 border-b-2 mx-auto mb-2"
                style={{ borderColor: "#013220" }}
              ></div>
              <p>認証状態を確認中...</p>
            </div>
            <ToastViewport />
          </ToastProvider>
        </QueryClientProvider>
      </div>
    );
  }

  // User is authenticated, show main app
  return (
    <div ref={containerRef} className="min-h-0">
      <QueryClientProvider client={queryClient}>
        <ToastProvider>
          <AppRouter
            view={view}
            setView={setView}
            onSignOut={authHandlers.handleSignOut}
            queryClient={queryClient}
          />
          <DevAuthDialog
            isOpen={isDevAuthOpen}
            onOpenChange={setIsDevAuthOpen}
            onSignIn={authHandlers.handleSignIn}
            onSignUp={authHandlers.handleSignUp}
          />
          <ToastViewport />
        </ToastProvider>
      </QueryClientProvider>
    </div>
  );
};

export default App;
