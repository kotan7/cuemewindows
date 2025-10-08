import { useState, useEffect } from 'react';

export interface PermissionState {
  isFirstTime: boolean;
  isLoading: boolean;
  isCompleted: boolean;
}

/**
 * Custom hook for managing permission state during first-time setup
 */
export function usePermissions(): [PermissionState, () => void] {
  const [permissionState, setPermissionState] = useState<PermissionState>({
    isFirstTime: true,
    isLoading: true,
    isCompleted: false,
  });

  useEffect(() => {
    const initPermissions = async () => {
      try {
        const result = await window.electronAPI.invoke('permission-check-first-time');
        setPermissionState({
          isFirstTime: result.isFirstTime,
          isLoading: false,
          isCompleted: !result.isFirstTime,
        });
      } catch (error) {
        console.error('Error checking first time setup:', error);
        setPermissionState({
          isFirstTime: true,
          isLoading: false,
          isCompleted: false,
        });
      }
    };

    initPermissions();
  }, []);

  const handlePermissionsCompleted = () => {
    setPermissionState(prev => ({
      ...prev,
      isCompleted: true,
    }));
  };

  return [permissionState, handlePermissionsCompleted];
}
