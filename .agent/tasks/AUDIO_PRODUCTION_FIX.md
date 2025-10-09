# Audio Listening Production Build Fix

## Issue Description
Audio listening (live question detection) works in development but fails in production builds. The app has microphone permissions (`com.apple.security.device.audio-input`), but the Swift binary for system audio capture is not functioning.

## Root Cause Analysis

### 1. Execute Permissions Lost
When electron-builder packages the app, the Swift binary (`SystemAudioCapture`) loses its execute permissions. The binary is copied to `Contents/Resources/dist-native/SystemAudioCapture` but is not marked as executable.

### 2. Code Signing Issues
The Swift binary is not being code-signed as part of the build process. macOS Gatekeeper blocks unsigned binaries in hardened runtime applications.

### 3. Universal Binary Compilation
The build script uses incorrect flags for creating universal binaries:
```bash
swiftc -target arm64-apple-macos12.3 -target x86_64-apple-macos12.3
```
This should use `-arch` flags or `lipo` to create a proper universal binary.

## Solution Implementation

### Step 1: Create afterPack Hook Script
Create a script to restore execute permissions and code-sign the binary after packaging.

### Step 2: Update Build Script
Fix the Swift compilation to properly create universal binaries.

### Step 3: Update package.json
Add the afterPack hook to electron-builder configuration.

### Step 4: Verify Binary Path
Ensure the binary path resolution is correct for both dev and production.

## Files to Modify
1. `scripts/build-native.sh` - Fix universal binary compilation
2. `scripts/afterPack.js` - New file for post-build processing
3. `package.json` - Add afterPack hook configuration
4. `electron/SystemAudioCapture.ts` - Add fallback error handling

## Implementation Status
- [x] Create afterPack.js script
- [x] Update build-native.sh for proper universal binary
- [x] Update package.json with afterPack hook
- [x] Add better error logging in SystemAudioCapture.ts
- [ ] Test in production build
- [ ] Document troubleshooting steps

## Changes Made

### 1. Created `scripts/afterPack.js`
Post-build hook that:
- Sets execute permissions (755) on the Swift binary
- Code-signs the binary with the app's identity and entitlements
- Verifies the signature
- Tests binary executability
- Provides detailed status logging

### 2. Updated `scripts/build-native.sh`
Fixed universal binary compilation:
- Builds separate arm64 and x86_64 binaries
- Uses `lipo` to create proper universal binary
- Falls back to single architecture if needed
- Better error handling and logging

### 3. Updated `package.json`
Added afterPack hook to electron-builder configuration:
```json
"afterPack": "./scripts/afterPack.js"
```

### 4. Enhanced `electron/SystemAudioCapture.ts`
Added comprehensive logging:
- Environment details (dev/prod, paths, platform, arch)
- Binary existence and permissions check
- Automatic permission fix attempt if binary is not executable
- Detailed error messages for troubleshooting

## Testing Checklist
- [ ] Build production app: `npm run app:build`
- [ ] Install and run the packaged app
- [ ] Check binary permissions: `ls -la Contents/Resources/dist-native/`
- [ ] Check binary signature: `codesign -dv Contents/Resources/dist-native/SystemAudioCapture`
- [ ] Test microphone audio capture
- [ ] Test system audio capture
- [ ] Check console logs for errors

## Troubleshooting Guide

### If audio still doesn't work after building:

1. **Check Binary Exists**
   ```bash
   cd release/mac/CueMe.app/Contents/Resources
   ls -la dist-native/SystemAudioCapture
   ```
   Should show: `-rwxr-xr-x` (executable)

2. **Check Binary Signature**
   ```bash
   codesign -dv dist-native/SystemAudioCapture
   ```
   Should show signing identity and no errors

3. **Test Binary Manually**
   ```bash
   ./dist-native/SystemAudioCapture status
   ```
   Should output JSON status data

4. **Check Console Logs**
   Open Console.app and filter for "CueMe" or "SystemAudioCapture"
   Look for:
   - Binary path being used
   - Permission errors
   - Code signing errors
   - ScreenCaptureKit availability

5. **Verify Entitlements**
   ```bash
   codesign -d --entitlements - CueMe.app
   ```
   Should include:
   - `com.apple.security.device.audio-input`
   - `com.apple.security.device.microphone`
   - `com.apple.security.device.screen-capture`

6. **Check System Permissions**
   - System Preferences → Security & Privacy → Microphone → CueMe ✓
   - System Preferences → Security & Privacy → Screen Recording → CueMe ✓

### Common Issues and Solutions

**Issue: Binary not executable**
```bash
# Fix manually:
chmod +x release/mac/CueMe.app/Contents/Resources/dist-native/SystemAudioCapture
```

**Issue: Binary not signed**
```bash
# Sign manually:
codesign --force --sign "Developer ID Application: YOUR_NAME" \
  --options runtime \
  --entitlements assets/entitlements.mac.plist \
  release/mac/CueMe.app/Contents/Resources/dist-native/SystemAudioCapture
```

**Issue: Gatekeeper blocking binary**
```bash
# Remove quarantine attribute:
xattr -dr com.apple.quarantine release/mac/CueMe.app
```

**Issue: Wrong architecture**
```bash
# Check binary architecture:
lipo -info dist-native/SystemAudioCapture
# Should show: arm64 x86_64 (universal)
```

## Related Files
- `electron/SystemAudioCapture.ts` - Audio capture implementation
- `electron/AudioStreamProcessor.ts` - Audio processing pipeline
- `native/SystemAudioCapture.swift` - Swift binary source
- `assets/entitlements.mac.plist` - App entitlements

## Additional Issues Fixed

### Vite Build Error with `diff` Package
**Error:** `Failed to resolve import "./index.js" from "node_modules/@types/diff/index.d.mts"`

**Root Cause:** In `src/_pages/Debug.tsx`, the `diffLines` function was incorrectly imported from `"../../node_modules/@types/diff"` instead of `"diff"`. This caused Vite to try to resolve the TypeScript type definitions as a module, which failed because the `.d.mts` file structure doesn't match the actual package.

**Solution:** Fixed the import statement to use the correct package name:
```typescript
// Before (incorrect):
import { diffLines } from "../../node_modules/@types/diff"

// After (correct):
import { diffLines } from "diff"
```

**File Modified:** `src/_pages/Debug.tsx`

---
**Created:** 2025/10/9
**Status:** In Progress
