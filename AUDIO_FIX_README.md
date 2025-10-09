# Audio Listening Production Build Fix

## Problem
Audio listening works in development but not in production builds, even with microphone permissions granted.

## Root Cause
The Swift binary (`SystemAudioCapture`) used for audio capture loses execute permissions and code signing when packaged by electron-builder.

## Solution Applied

### 1. Build Process Improvements
- Fixed universal binary compilation (arm64 + x86_64)
- Added post-build hook to restore permissions and code-sign binary
- Enhanced error logging for troubleshooting

### 2. Files Modified
- ✅ `scripts/afterPack.js` - New post-build hook
- ✅ `scripts/build-native.sh` - Fixed universal binary creation
- ✅ `package.json` - Added afterPack hook
- ✅ `electron/SystemAudioCapture.ts` - Enhanced logging and auto-fix

## How to Build and Test

### Step 1: Rebuild Native Binary
```bash
cd final/CueMeFinal
npm run build:native
```

### Step 2: Build Production App
```bash
npm run app:build
```

The afterPack hook will automatically:
- Set execute permissions on the binary
- Code-sign it with your developer certificate
- Verify the signature

### Step 3: Test the Packaged App
```bash
# Install the app from release/mac/
open release/mac/CueMe.app
```

### Step 4: Verify Audio Works
1. Open the app
2. Enable audio listening
3. Speak or play audio
4. Check if questions are detected

## Verification Commands

### Check Binary Permissions
```bash
ls -la release/mac/CueMe.app/Contents/Resources/dist-native/SystemAudioCapture
```
Expected: `-rwxr-xr-x` (755 permissions)

### Check Binary Signature
```bash
codesign -dv release/mac/CueMe.app/Contents/Resources/dist-native/SystemAudioCapture
```
Expected: Shows your developer identity, no errors

### Check Binary Architecture
```bash
lipo -info release/mac/CueMe.app/Contents/Resources/dist-native/SystemAudioCapture
```
Expected: `Architectures in the fat file: ... are: arm64 x86_64`

### Test Binary Directly
```bash
cd release/mac/CueMe.app/Contents/Resources
./dist-native/SystemAudioCapture status
```
Expected: JSON output with status information

## Console Logs to Check

When running the app, check Console.app for:

```
[SystemAudioCapture] Environment: { isDev: false, isPackaged: true, ... }
[SystemAudioCapture] Swift binary path: /path/to/Resources/dist-native/SystemAudioCapture
[SystemAudioCapture] Binary found: { size: ..., mode: '100755', isExecutable: true }
[SystemAudioCapture] ScreenCaptureKit available: true
```

## If Audio Still Doesn't Work

### 1. Check System Permissions
- System Preferences → Security & Privacy → Microphone → CueMe ✓
- System Preferences → Security & Privacy → Screen Recording → CueMe ✓

### 2. Check for Gatekeeper Issues
```bash
# Remove quarantine if needed
xattr -dr com.apple.quarantine release/mac/CueMe.app
```

### 3. Manual Permission Fix
If the afterPack hook didn't run:
```bash
cd release/mac/CueMe.app/Contents/Resources
chmod +x dist-native/SystemAudioCapture
```

### 4. Manual Code Signing
If you need to sign manually:
```bash
codesign --force --sign "Developer ID Application: YOUR_NAME" \
  --options runtime \
  --entitlements assets/entitlements.mac.plist \
  release/mac/CueMe.app/Contents/Resources/dist-native/SystemAudioCapture
```

### 5. Check Environment Variables
Make sure `.env` file is included in the build:
```bash
ls -la release/mac/CueMe.app/Contents/Resources/.env
```

## Environment Variables Needed

The app requires these environment variables (in `.env`):
```env
GEMINI_API_KEY=your_key_here
OPENAI_API_KEY=your_key_here
SUPABASE_URL=your_url_here
SUPABASE_ANON_KEY=your_key_here
```

The `.env` file is automatically copied to the app bundle via `extraResources` in package.json.

## Code Signing Requirements

For distribution, you need:
1. Apple Developer account
2. Developer ID Application certificate installed
3. Set environment variable: `export APPLE_IDENTITY="Developer ID Application: Your Name"`
4. Or set in package.json: `CSC_NAME="Developer ID Application: Your Name"`

## Next Steps

1. ✅ Build the app: `npm run app:build`
2. ✅ Verify binary permissions and signature
3. ✅ Test audio capture in the packaged app
4. ✅ Check console logs for any errors
5. If issues persist, see troubleshooting section above

## Related Documentation

- Full task details: `.agent/tasks/AUDIO_PRODUCTION_FIX.md`
- Architecture: `.agent/system/ARCHITECTURE.md`
- Audio implementation: `electron/SystemAudioCapture.ts`

---

**Last Updated:** 2025/10/9
**Status:** Ready for Testing
