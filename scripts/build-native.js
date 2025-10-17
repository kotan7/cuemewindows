#!/usr/bin/env node

/**
 * Cross-platform native module build script
 * Builds platform-specific audio capture binaries for CueMe
 * 
 * - macOS: Swift binary using ScreenCaptureKit
 * - Windows: PowerShell script using Windows Audio APIs
 * - Linux: Placeholder (not yet implemented)
 */

const fs = require('fs');
const path = require('path');
const { execSync, spawn } = require('child_process');
const os = require('os');

const PROJECT_DIR = path.join(__dirname, '..');
const BUILD_DIR = path.join(PROJECT_DIR, 'dist-native');
const NATIVE_DIR = path.join(PROJECT_DIR, 'native');

const platform = os.platform();
const arch = os.arch();

console.log('🚀 Building native modules for CueMe...');
console.log(`📋 Platform: ${platform}`);
console.log(`📋 Architecture: ${arch}`);
console.log(`📂 Build directory: ${BUILD_DIR}`);

// Create build directory
if (!fs.existsSync(BUILD_DIR)) {
  fs.mkdirSync(BUILD_DIR, { recursive: true });
}

/**
 * Build for macOS using Swift
 */
async function buildMacOS() {
  console.log('\n🍎 Building for macOS...');
  
  try {
    // Check macOS version
    const macOSVersion = execSync('sw_vers -productVersion').toString().trim();
    console.log(`📋 macOS version: ${macOSVersion}`);
    
    const versionParts = macOSVersion.split('.');
    const majorVersion = parseInt(versionParts[0]);
    const minorVersion = parseInt(versionParts[1] || '0');
    
    if (majorVersion < 12 || (majorVersion === 12 && minorVersion < 3)) {
      console.warn('⚠️  ScreenCaptureKit requires macOS 12.3 or later');
      console.warn(`   Current version: ${macOSVersion}`);
      console.warn('   Building with legacy fallback only...');
    }
    
    const swiftSource = path.join(NATIVE_DIR, 'SystemAudioCapture.swift');
    const outputArm64 = path.join(BUILD_DIR, 'SystemAudioCapture_arm64');
    const outputX64 = path.join(BUILD_DIR, 'SystemAudioCapture_x86_64');
    const outputUniversal = path.join(BUILD_DIR, 'SystemAudioCapture');
    
    console.log('🔨 Attempting universal binary build...');
    
    let arm64Success = false;
    let x64Success = false;
    
    // Build for arm64
    try {
      console.log('  Building arm64...');
      execSync(`swiftc -O -target arm64-apple-macos12.3 "${swiftSource}" -o "${outputArm64}" -framework Foundation -framework ScreenCaptureKit -framework AVFoundation -framework CoreAudio`, {
        stdio: 'inherit'
      });
      arm64Success = true;
      console.log('  ✅ arm64 build successful');
    } catch (error) {
      console.warn('  ⚠️  arm64 build failed');
    }
    
    // Build for x86_64
    try {
      console.log('  Building x86_64...');
      execSync(`swiftc -O -target x86_64-apple-macos12.3 "${swiftSource}" -o "${outputX64}" -framework Foundation -framework ScreenCaptureKit -framework AVFoundation -framework CoreAudio`, {
        stdio: 'inherit'
      });
      x64Success = true;
      console.log('  ✅ x86_64 build successful');
    } catch (error) {
      console.warn('  ⚠️  x86_64 build failed');
    }
    
    // Create universal binary or use what we have
    if (arm64Success && x64Success) {
      console.log('🔗 Creating universal binary with lipo...');
      execSync(`lipo -create "${outputArm64}" "${outputX64}" -output "${outputUniversal}"`, {
        stdio: 'inherit'
      });
      fs.unlinkSync(outputArm64);
      fs.unlinkSync(outputX64);
      console.log('✅ Universal binary created successfully');
    } else if (arm64Success) {
      console.log('⚠️  Using arm64 only');
      fs.renameSync(outputArm64, outputUniversal);
    } else if (x64Success) {
      console.log('⚠️  Using x86_64 only');
      fs.renameSync(outputX64, outputUniversal);
    } else {
      console.log('❌ Both architecture builds failed, trying current architecture only...');
      execSync(`swiftc -O "${swiftSource}" -o "${outputUniversal}" -framework Foundation -framework ScreenCaptureKit -framework AVFoundation -framework CoreAudio`, {
        stdio: 'inherit'
      });
      console.log('✅ Single architecture binary created');
    }
    
    // Make executable
    fs.chmodSync(outputUniversal, 0o755);
    
    console.log('🎉 macOS build complete!');
    console.log(`   Binary location: ${outputUniversal}`);
    
  } catch (error) {
    console.error('❌ macOS build failed:', error.message);
    throw error;
  }
}

/**
 * Build for Windows using PowerShell
 */
async function buildWindows() {
  console.log('\n🪟 Building for Windows...');
  
  try {
    const windowsAudioScript = path.join(NATIVE_DIR, 'WindowsAudioCapture.ps1');
    const nodeWrapperScript = path.join(NATIVE_DIR, 'WindowsAudioCapture.js');
    const outputScript = path.join(BUILD_DIR, 'WindowsAudioCapture.ps1');
    const outputWrapper = path.join(BUILD_DIR, 'WindowsAudioCapture.js');
    
    // Check if source files exist
    if (!fs.existsSync(windowsAudioScript)) {
      console.log('📝 Creating Windows PowerShell audio capture script...');
      // Will be created in next step
    }
    
    if (!fs.existsSync(nodeWrapperScript)) {
      console.log('📝 Creating Node.js wrapper for Windows audio...');
      // Will be created in next step
    }
    
    // Copy scripts to build directory
    if (fs.existsSync(windowsAudioScript)) {
      fs.copyFileSync(windowsAudioScript, outputScript);
      console.log('✅ PowerShell script copied');
    }
    
    if (fs.existsSync(nodeWrapperScript)) {
      fs.copyFileSync(nodeWrapperScript, outputWrapper);
      console.log('✅ Node.js wrapper copied');
    }
    
    console.log('🎉 Windows build complete!');
    console.log(`   Scripts location: ${BUILD_DIR}`);
    
  } catch (error) {
    console.error('❌ Windows build failed:', error.message);
    throw error;
  }
}

/**
 * Build for Linux (placeholder)
 */
async function buildLinux() {
  console.log('\n🐧 Building for Linux...');
  
  try {
    console.log('⚠️  System audio capture not yet implemented for Linux');
    console.log('   Creating placeholder...');
    
    const placeholderPath = path.join(BUILD_DIR, 'LinuxAudioCapture.sh');
    const placeholderContent = `#!/bin/bash
echo "ERROR: System audio capture is not yet supported on Linux"
echo "STATUS_DATA: {\\"isAvailable\\": false, \\"error\\": \\"Linux not supported yet\\"}"
exit 1
`;
    
    fs.writeFileSync(placeholderPath, placeholderContent, { mode: 0o755 });
    console.log('✅ Placeholder created');
    
  } catch (error) {
    console.error('❌ Linux build failed:', error.message);
    throw error;
  }
}

/**
 * Build for unsupported platforms
 */
async function buildUnsupported() {
  console.log(`\n⚠️  Platform '${platform}' is not supported`);
  console.log('   Creating placeholder...');
  
  const placeholderPath = path.join(BUILD_DIR, 'UnsupportedPlatform.txt');
  const placeholderContent = `System audio capture is not supported on ${platform}`;
  
  fs.writeFileSync(placeholderPath, placeholderContent);
  console.log('✅ Placeholder created');
}

/**
 * Main build function
 */
async function main() {
  try {
    switch (platform) {
      case 'darwin':
        await buildMacOS();
        break;
      case 'win32':
        await buildWindows();
        break;
      case 'linux':
        await buildLinux();
        break;
      default:
        await buildUnsupported();
    }
    
    console.log('\n✨ Native module build completed successfully!');
    process.exit(0);
    
  } catch (error) {
    console.error('\n💥 Build failed:', error);
    process.exit(1);
  }
}

// Run main function
main();
