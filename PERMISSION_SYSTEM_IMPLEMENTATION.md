# Permission Request System Implementation

## Overview

I have implemented a comprehensive permission request system for the CueMe app to handle first-time users who need to grant microphone and screen recording permissions.

## Key Components Implemented

### 1. Permission Storage System
**File**: `/electron/PermissionStorage.ts`

- **Purpose**: Tracks if the user has seen the initial permission setup
- **Features**:
  - Securely stores permission state using AES-256-GCM encryption
  - Checks current system permission status for microphone and screen recording (macOS)
  - Handles permission requests for microphone access
  - Tracks first-time setup completion

### 2. Permission Dialog UI
**File**: `/src/components/ui/permission-dialog.tsx`

- **Design**: Matches the auth dialog styling with cream (#F7F7EE) and green (#013220) colors
- **Features**:
  - **Welcome Screen**: Introduces the app and explains why permissions are needed
  - **Permission Setup Screen**: Shows current permission status with action buttons
  - **Real-time Status**: Displays granted/denied/unknown status for each permission
  - **System Integration**: Opens macOS System Preferences for screen recording setup

### 3. App Flow Integration
**File**: `/src/App.tsx` (Updated)

- **Flow Logic**:
  1. App starts → Checks if first-time setup via `permission-check-first-time` IPC
  2. If first-time AND permissions not completed → Show permission dialog
  3. User completes setup → Show auth dialog
  4. User authenticates → Show main app

### 4. Profile Dropdown Permission Button
**File**: `/src/_pages/Queue.tsx` (Updated)

- **Location**: Added in the profile dropdown menu (accessible via user icon)
- **Features**:
  - Shield icon with "権限を許可" (Grant Permissions) text
  - Checks current permission status
  - Requests microphone permission programmatically
  - Opens System Preferences for screen recording permission
  - Shows toast notifications with status updates

### 5. IPC Handlers
**File**: `/electron/ipcHandlers.ts` (Updated)

Added permission-related IPC handlers:
- `permission-check-first-time`: Checks if this is the first app run
- `permission-check-status`: Gets current system permission status
- `permission-request-microphone`: Requests microphone access (macOS only)
- `permission-open-system-preferences`: Opens macOS System Preferences
- `permission-mark-setup-completed`: Marks initial setup as completed

## How the Permission Detection Works

### First-Time Detection
```typescript
// Checks if permission state file exists
public async isFirstTimeSetup(): Promise<boolean> {
  const state = await this.getPermissionState()
  return state === null || !state.hasShownInitialSetup
}
```

### App Flow Decision Tree
1. **Permissions Loading** → Show loading spinner
2. **First-time Setup** → Show permission dialog
3. **Auth Required** → Show auth dialog  
4. **Authenticated** → Show main app

### Profile Dropdown Flow
1. User clicks permission button
2. Check current system permissions
3. Request microphone if not granted
4. Open System Preferences for screen recording
5. Show appropriate toast notifications

## User Experience

### For First-Time Users (Downloaded App)
1. **Welcome Screen**: Explains permission requirements with friendly UI
2. **Permission Setup**: Interactive buttons to grant permissions
3. **System Integration**: Seamless integration with macOS System Preferences
4. **Completion**: Proceeds to authentication after setup

### For Existing Users (Post-Auth)
1. **Profile Dropdown**: Accessible permission management via shield icon
2. **Status Checking**: Real-time permission status verification  
3. **Quick Fix**: One-click permission requests and system settings access
4. **Toast Feedback**: Clear status messages about permission changes

## Technical Details

### Permission Types Supported
- **Microphone**: Programmatic request via `systemPreferences.askForMediaAccess('microphone')`
- **Screen Recording**: System Preferences redirect (cannot be requested programmatically)

### Storage Security
- Permission state encrypted with AES-256-GCM
- Stored in app's userData directory
- Automatic cleanup on corruption

### Error Handling
- Graceful fallbacks for permission check failures
- User-friendly error messages in Japanese
- Toast notifications for all status changes

## Testing the Implementation

The system has been tested and works correctly:
- ✅ Build successful
- ✅ Permission storage initialization
- ✅ First-time detection working
- ✅ Permission status checking functional
- ✅ Profile dropdown integration complete

When users download the app from GitHub releases (without existing permissions), they will now see the permission request dialog before the auth screen, ensuring proper microphone and screen recording access for the app's functionality.