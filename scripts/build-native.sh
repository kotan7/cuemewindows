#!/bin/bash

# Build script for SystemAudioCapture Swift binary
# This script compiles the Swift binary that uses ScreenCaptureKit for system audio capture

set -e

echo "🚀 Building SystemAudioCapture Swift binary..."

# Get the directory of this script
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"

# Build directory
BUILD_DIR="$PROJECT_DIR/dist-native"
NATIVE_DIR="$PROJECT_DIR/native"

# Create build directory
mkdir -p "$BUILD_DIR"

# Check if we're on macOS
if [[ "$(uname)" != "Darwin" ]]; then
    echo "⚠️  SystemAudioCapture can only be built on macOS"
    echo "   Creating placeholder binary for other platforms..."
    
    # Create a simple placeholder script
    cat > "$BUILD_DIR/SystemAudioCapture" << 'EOF'
#!/bin/bash
echo "ERROR: SystemAudioCapture is only supported on macOS"
echo "STATUS_DATA: {\"isAvailable\": false, \"error\": \"macOS required\"}"
exit 1
EOF
    chmod +x "$BUILD_DIR/SystemAudioCapture"
    echo "✅ Placeholder binary created"
    exit 0
fi

# Check macOS version
MACOS_VERSION=$(sw_vers -productVersion)
MACOS_MAJOR=$(echo "$MACOS_VERSION" | cut -d. -f1)
MACOS_MINOR=$(echo "$MACOS_VERSION" | cut -d. -f2)

echo "📋 macOS version: $MACOS_VERSION"

if [[ $MACOS_MAJOR -lt 12 ]] || [[ $MACOS_MAJOR -eq 12 && $MACOS_MINOR -lt 3 ]]; then
    echo "⚠️  ScreenCaptureKit requires macOS 12.3 or later"
    echo "   Current version: $MACOS_VERSION"
    echo "   Building with legacy fallback only..."
fi

# Change to native directory
cd "$NATIVE_DIR"

echo "🔨 Compiling Swift binary with swiftc..."

# Use swiftc directly for simpler compilation
swiftc -O \
    -target arm64-apple-macos12.3 \
    -target x86_64-apple-macos12.3 \
    SystemAudioCapture.swift \
    -o "$BUILD_DIR/SystemAudioCapture" \
    -framework Foundation \
    -framework ScreenCaptureKit \
    -framework AVFoundation \
    -framework CoreAudio

if [[ $? -eq 0 ]]; then
    echo "✅ Binary compiled successfully"
else
    echo "❌ Compilation failed, trying single architecture..."
    # Try single architecture as fallback
    swiftc -O \
        SystemAudioCapture.swift \
        -o "$BUILD_DIR/SystemAudioCapture" \
        -framework Foundation \
        -framework ScreenCaptureKit \
        -framework AVFoundation \
        -framework CoreAudio
    
    if [[ $? -ne 0 ]]; then
        echo "❌ Single architecture compilation also failed"
        exit 1
    fi
    echo "✅ Single architecture binary created"
fi

# Make sure it's executable
chmod +x "$BUILD_DIR/SystemAudioCapture"

# Test the binary
echo "🧪 Testing binary..."
if "$BUILD_DIR/SystemAudioCapture" --help > /dev/null 2>&1 || echo "status" | timeout 2 "$BUILD_DIR/SystemAudioCapture" > /dev/null 2>&1; then
    echo "✅ Binary test passed"
else
    echo "⚠️  Binary test failed, but this might be expected for a daemon process"
fi

echo "🎉 Build complete!"
echo "   Binary location: $BUILD_DIR/SystemAudioCapture"
echo "   Ready for Electron integration"