<!-- e3e892ab-58b1-46f3-b020-c271c40232e3 e4bfdfdf-9b68-4129-a233-fc5de1a4e579 -->
# System Audio Capture Permission Fix

## Problem Analysis

CueMe fails to capture system audio when playing videos with headphones, while Glass (a similar project) successfully captures system audio. After scrutinizing both codebases, I've identified **three critical differences** in how they handle system audio permissions:

### Root Causes Identified

#### 1. **App Sandbox Entitlement (CRITICAL)**

**Glass**: Explicitly disables app sandbox

```xml
<!-- glass/entitlements.plist -->
<key>com.apple.security.app-sandbox</key>
<false/>
```

**CueMe**: Does NOT disable app sandbox (defaults to enabled with hardenedRuntime)

```xml
<!-- CueMe/assets/entitlements.mac.plist -->
<!-- No app-sandbox key = defaults to TRUE when hardenedRuntime is true -->
```

**Impact**: When app-sandbox is enabled, macOS severely restricts the app's ability to access system resources, including system audio capture. Even with ScreenCaptureKit and proper entitlements, the sandbox prevents low-level audio routing from being captured.

#### 2. **Permission Registration Flow**

**Glass**: Proactively triggers `desktopCapturer.getSources()` to register the app with macOS

```javascript
// glass/src/features/common/services/permissionService.js:76-86
if (section === 'screen-recording') {
  try {
    console.log('[Permissions] Triggering screen capture request to register app...');
    await desktopCapturer.getSources({
      types: ['screen'],
      thumbnailSize: { width: 1, height: 1 }
    });
    console.log('[Permissions] App registered for screen recording');
  } catch (captureError) {
    console.log('[Permissions] Screen capture request triggered (expected to fail):', captureError.message);
  }
}
```

**CueMe**: Only calls `desktopCapturer.getSources()` when actually starting capture, not during permission setup

```typescript
// CueMe/electron/SystemAudioCapture.ts:816-819
const sources = await desktopCapturer.getSources({
  types: ['screen'],
  fetchWindowIcons: false
});
```

**Impact**: macOS needs the app to make at least one capture attempt to properly register it in System Preferences → Privacy & Security → Screen Recording. Glass does this proactively during setup; CueMe doesn't.

#### 3. **Permission Status Checking**

**Glass**: Uses `systemPreferences.getMediaAccessStatus('screen')` to check screen recording permission

```javascript
// glass/src/features/common/services/permissionService.js:19-20
permissions.microphone = systemPreferences.getMediaAccessStatus('microphone');
permissions.screen = systemPreferences.getMediaAccessStatus('screen');
```

**CueMe**: Only uses `systemPreferences.getMediaAccessStatus('microphone')` for microphone, not for screen

```typescript
// CueMe/electron/PermissionStorage.ts:154-155
microphoneStatus = systemPreferences.getMediaAccessStatus('microphone')
screenCaptureStatus = systemPreferences.getMediaAccessStatus('screen')
```

Wait, CueMe DOES have this. Let me check the actual permission flow...

Actually, reviewing more carefully:

- CueMe's `PermissionStorage` has the check but it's not integrated into the UI permission setup flow like Glass
- Glass has a dedicated `PermissionHeader` component that actively guides users through the permission setup
- CueMe requests microphone permission on startup but doesn't have an equivalent screen recording setup flow

## Implementation Plan

### Phase 1: Update Entitlements (CRITICAL)

**File**: `CueMe/assets/entitlements.mac.plist`

Add the app-sandbox disable entitlement:

```xml
<key>com.apple.security.app-sandbox</key>
<false/>
```

This is the **most critical change**. Without this, system audio capture will remain broken regardless of other fixes.

### Phase 2: Enhance Permission Handling

**File**: `CueMe/electron/PermissionStorage.ts`

Add method to proactively register the app for screen recording:

```typescript
public async registerForScreenRecording(): Promise<boolean> {
  try {
    console.log('[PermissionStorage] Registering app for screen recording...');
    // Trigger desktop capturer to register the app with macOS
    await desktopCapturer.getSources({
      types: ['screen'],
      thumbnailSize: { width: 1, height: 1 }
    });
    console.log('[PermissionStorage] App registered for screen recording');
    return true;
  } catch (error) {
    console.log('[PermissionStorage] Screen capture registration triggered:', error);
    // This is expected to fail if permission not granted yet
    return false;
  }
}
```

### Phase 3: Update Main Initialization

**File**: `CueMe/electron/main.ts`

Add screen recording permission request on startup (similar to microphone):

```typescript
async function requestScreenRecordingAccess(appState: AppState): Promise<void> {
  if (process.platform !== 'darwin') {
    return;
  }
  
  try {
    console.log('[Permission] Registering for screen recording...');
    await appState.permissionStorage.registerForScreenRecording();
    
    const status = await appState.permissionStorage.getCurrentPermissionStatus();
    console.log('[Permission] Screen recording status:', status.screenCapture);
    
    if (status.screenCapture !== 'granted') {
      console.log('[Permission] ⚠️  Screen recording permission required for system audio capture');
      console.log('[Permission] Please grant permission in System Preferences → Privacy & Security → Screen Recording');
    }
  } catch (error) {
    console.error('[Permission] Error checking screen recording permission:', error);
  }
}
```

Call this function in `initializeApp()` after microphone permission request.

### Phase 4: Enhance SystemAudioCapture Error Messages

**File**: `CueMe/electron/SystemAudioCapture.ts`

Update error messages to be more specific about the sandbox and permission requirements:

```typescript
// Around line 478-507 in startSystemAudioCapture()
if (errorMsg.includes('permission') || errorMsg.includes('denied')) {
  throw new Error('Screen recording permission denied. Please grant permission in System Preferences → Privacy & Security → Screen Recording, then restart CueMe.');
}
```

### Phase 5: Update Documentation

**File**: Create `CueMe/.agent/tasks/SYSTEM_AUDIO_CAPTURE_FIX.md`

Document:

- The root causes identified
- Changes made
- Why app-sandbox must be disabled
- Testing procedures for system audio capture
- Known limitations

## Technical Deep Dive

### Why App Sandbox Blocks System Audio

macOS app sandbox is a security feature that isolates apps from system resources. When enabled with `hardenedRuntime: true`, the app runs in a restricted environment where:

1. **Audio routing is restricted**: The app can only access audio that directly targets it
2. **System audio (loopback) is inaccessible**: Even with ScreenCaptureKit, the sandbox prevents accessing the audio routing that would capture system-wide sound
3. **Screen recording ≠ System audio access**: The `screen` media access permission grants permission to capture video/screen content, but the sandbox blocks the audio routing needed to capture system audio

Glass works because it **explicitly disables the sandbox** (`app-sandbox: false`), allowing it to access system-level audio routing through ScreenCaptureKit.

### Why This Affects Headphone Audio Specifically

When audio plays through headphones:

- The audio is routed directly to the headphone output device
- To capture this, the app needs to tap into the system audio routing (Core Audio's loopback)
- With app-sandbox enabled, this routing tap is blocked
- Without headphones (using speakers), some audio might be picked up by the microphone (if enabled), creating the illusion it's working

### Security Implications

Disabling app-sandbox reduces isolation but is necessary for system audio capture:

- **Trade-off**: Security isolation vs. functionality
- **Mitigation**: Keep all other hardened runtime entitlements enabled
- **Note**: Many legitimate apps that do screen/audio recording (OBS, Discord, Zoom) disable app-sandbox for this reason

## Testing Checklist

After implementing changes:

1. ✅ Rebuild the app with new entitlements
2. ✅ Verify entitlements are applied: `codesign -d --entitlements :- path/to/CueMe.app`
3. ✅ Test system audio capture with headphones plugged in
4. ✅ Test with video playing (YouTube, Zoom, etc.)
5. ✅ Verify permission prompts appear correctly on first run
6. ✅ Check that app appears in System Preferences → Privacy & Security → Screen Recording
7. ✅ Verify audio data is being captured (check console logs for AUDIO_DATA messages)

## Files to Modify

1. `CueMe/assets/entitlements.mac.plist` - Add app-sandbox disable
2. `CueMe/electron/PermissionStorage.ts` - Add registerForScreenRecording method
3. `CueMe/electron/main.ts` - Add screen recording registration on startup
4. `CueMe/electron/SystemAudioCapture.ts` - Enhance error messages (optional but recommended)
5. Create `CueMe/.agent/tasks/SYSTEM_AUDIO_CAPTURE_FIX.md` - Document the fix

## Risk Assessment

**Low Risk Changes**:

- Adding registration method (Phase 2)
- Updating error messages (Phase 4)
- Documentation (Phase 5)

**Medium Risk Changes**:

- Calling registration on startup (Phase 3)
  - Could show unexpected permission prompts
  - Mitigation: Clear logging and user messaging

**High Impact Changes**:

- Disabling app-sandbox (Phase 1)
  - **REQUIRED for fix to work**
  - Changes security posture
  - Mitigation: All other hardened runtime protections remain active
  - Note: This is industry-standard for screen/audio recording apps

## Expected Outcome

After implementing all phases:

1. CueMe will be able to capture system audio with headphones
2. Permission setup will be more robust and user-friendly
3. Error messages will guide users to correct permission issues
4. The app will properly register itself in macOS privacy settings
5. System audio capture will work reliably across different audio configurations

### To-dos

- [x] Add app-sandbox:false to entitlements.mac.plist
- [x] Add registerForScreenRecording() method to PermissionStorage
- [x] Add screen recording registration call in main.ts initialization
- [x] Update SystemAudioCapture error messages with clearer guidance
- [x] Create SYSTEM_AUDIO_CAPTURE_FIX.md task documentation
- [ ] Rebuild and test system audio capture with headphones