import React, { useEffect } from 'react';
import { QueryClient } from 'react-query';
import Queue from '../_pages/Queue';
import Solutions from '../_pages/Solutions';

interface AppRouterProps {
  view: 'queue' | 'solutions' | 'debug';
  setView: React.Dispatch<React.SetStateAction<'queue' | 'solutions' | 'debug'>>;
  onSignOut: () => Promise<{ success: boolean; error?: string }>;
  queryClient: QueryClient;
}

/**
 * Handles view routing and global event listeners for the app
 */
export const AppRouter: React.FC<AppRouterProps> = ({
  view,
  setView,
  onSignOut,
  queryClient,
}) => {
  // Setup global event listeners
  useEffect(() => {
    const cleanupFunctions = [
      window.electronAPI.onSolutionStart(() => {
        setView('solutions');
        console.log('starting processing');
      }),

      window.electronAPI.onUnauthorized(() => {
        queryClient.removeQueries(['screenshots']);
        queryClient.removeQueries(['solution']);
        queryClient.removeQueries(['problem_statement']);
        setView('queue');
        console.log('Unauthorized');
      }),

      window.electronAPI.onResetView(() => {
        console.log('Received reset-view message from main process');
        queryClient.removeQueries(['screenshots']);
        queryClient.removeQueries(['solution']);
        queryClient.removeQueries(['problem_statement']);
        setView('queue');
        console.log('View reset to queue via Command+R shortcut');
      }),

      window.electronAPI.onProblemExtracted((data: any) => {
        if (view === 'queue') {
          console.log('Problem extracted successfully');
          queryClient.invalidateQueries(['problem_statement']);
          queryClient.setQueryData(['problem_statement'], data);
        }
      }),
    ];

    return () => cleanupFunctions.forEach((cleanup) => cleanup());
  }, [view, setView, queryClient]);

  // Render current view
  if (view === 'queue') {
    return <Queue setView={setView} onSignOut={onSignOut} />;
  }

  if (view === 'solutions') {
    return <Solutions setView={setView} />;
  }

  return null;
};
