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

# Detect current architecture
CURRENT_ARCH=$(uname -m)
echo "📋 Current architecture: $CURRENT_ARCH"

# Try to build universal binary first
echo "🔨 Attempting universal binary build..."

# Build for arm64
swiftc -O \
    -target arm64-apple-macos12.3 \
    SystemAudioCapture.swift \
    -o "$BUILD_DIR/SystemAudioCapture_arm64" \
    -framework Foundation \
    -framework ScreenCaptureKit \
    -framework AVFoundation \
    -framework CoreAudio

ARM64_SUCCESS=$?

# Build for x86_64
swiftc -O \
    -target x86_64-apple-macos12.3 \
    SystemAudioCapture.swift \
    -o "$BUILD_DIR/SystemAudioCapture_x86_64" \
    -framework Foundation \
    -framework ScreenCaptureKit \
    -framework AVFoundation \
    -framework CoreAudio

X86_SUCCESS=$?

# Create universal binary if both succeeded
if [[ $ARM64_SUCCESS -eq 0 ]] && [[ $X86_SUCCESS -eq 0 ]]; then
    echo "🔗 Creating universal binary with lipo..."
    lipo -create \
        "$BUILD_DIR/SystemAudioCapture_arm64" \
        "$BUILD_DIR/SystemAudioCapture_x86_64" \
        -output "$BUILD_DIR/SystemAudioCapture"
    
    if [[ $? -eq 0 ]]; then
        echo "✅ Universal binary created successfully"
        # Clean up architecture-specific binaries
        rm -f "$BUILD_DIR/SystemAudioCapture_arm64" "$BUILD_DIR/SystemAudioCapture_x86_64"
    else
        echo "❌ Failed to create universal binary, using current architecture"
        if [[ "$CURRENT_ARCH" == "arm64" ]]; then
            mv "$BUILD_DIR/SystemAudioCapture_arm64" "$BUILD_DIR/SystemAudioCapture"
        else
            mv "$BUILD_DIR/SystemAudioCapture_x86_64" "$BUILD_DIR/SystemAudioCapture"
        fi
        rm -f "$BUILD_DIR/SystemAudioCapture_arm64" "$BUILD_DIR/SystemAudioCapture_x86_64"
    fi
elif [[ $ARM64_SUCCESS -eq 0 ]]; then
    echo "⚠️  x86_64 build failed, using arm64 only"
    mv "$BUILD_DIR/SystemAudioCapture_arm64" "$BUILD_DIR/SystemAudioCapture"
    rm -f "$BUILD_DIR/SystemAudioCapture_x86_64"
elif [[ $X86_SUCCESS -eq 0 ]]; then
    echo "⚠️  arm64 build failed, using x86_64 only"
    mv "$BUILD_DIR/SystemAudioCapture_x86_64" "$BUILD_DIR/SystemAudioCapture"
    rm -f "$BUILD_DIR/SystemAudioCapture_arm64"
else
    echo "❌ Both architecture builds failed, trying current architecture only..."
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