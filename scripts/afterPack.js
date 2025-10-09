#!/usr/bin/env node

/**
 * afterPack hook for electron-builder
 * Ensures native binaries have correct permissions and are code-signed
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

module.exports = async function(context) {
  console.log('\n🔧 Running afterPack hook...');
  
  const { appOutDir, packager, electronPlatformName } = context;
  
  // Only process macOS builds
  if (electronPlatformName !== 'darwin') {
    console.log('⏭️  Skipping afterPack for non-macOS platform');
    return;
  }

  const appName = packager.appInfo.productFilename;
  const appPath = path.join(appOutDir, `${appName}.app`);
  const resourcesPath = path.join(appPath, 'Contents', 'Resources');
  const binaryPath = path.join(resourcesPath, 'dist-native', 'SystemAudioCapture');

  console.log(`📦 App path: ${appPath}`);
  console.log(`📂 Resources path: ${resourcesPath}`);
  console.log(`🔨 Binary path: ${binaryPath}`);

  // Check if binary exists
  if (!fs.existsSync(binaryPath)) {
    console.warn(`⚠️  Binary not found at: ${binaryPath}`);
    console.warn('   Audio capture may not work in production!');
    return;
  }

  try {
    // Step 1: Set execute permissions
    console.log('🔐 Setting execute permissions...');
    fs.chmodSync(binaryPath, 0o755);
    console.log('✅ Execute permissions set (755)');

    // Step 2: Code sign the binary
    const identity = process.env.APPLE_IDENTITY || process.env.CSC_NAME;
    
    if (identity) {
      console.log(`🔏 Code signing binary with identity: ${identity}`);
      
      try {
        // Sign with hardened runtime and entitlements
        const entitlementsPath = path.join(process.cwd(), 'assets', 'entitlements.mac.plist');
        
        const signCommand = `codesign --force --sign "${identity}" --options runtime --entitlements "${entitlementsPath}" "${binaryPath}"`;
        
        execSync(signCommand, { stdio: 'inherit' });
        console.log('✅ Binary code-signed successfully');
        
        // Verify signature
        const verifyCommand = `codesign --verify --verbose "${binaryPath}"`;
        execSync(verifyCommand, { stdio: 'inherit' });
        console.log('✅ Signature verified');
        
      } catch (signError) {
        console.error('❌ Code signing failed:', signError.message);
        console.warn('⚠️  Binary will not be signed. This may cause issues on other machines.');
      }
    } else {
      console.warn('⚠️  No code signing identity found (APPLE_IDENTITY or CSC_NAME)');
      console.warn('   Binary will not be signed. This may cause issues on other machines.');
    }

    // Step 3: Verify binary is executable
    console.log('🧪 Testing binary...');
    try {
      const testCommand = `"${binaryPath}" --help`;
      execSync(testCommand, { timeout: 2000, stdio: 'pipe' });
      console.log('✅ Binary is executable');
    } catch (testError) {
      // Binary might not respond to --help, which is okay
      console.log('⚠️  Binary test inconclusive (this may be normal for daemon processes)');
    }

    // Step 4: Display final status
    console.log('\n📊 Final binary status:');
    const stats = fs.statSync(binaryPath);
    const permissions = (stats.mode & parseInt('777', 8)).toString(8);
    console.log(`   Permissions: ${permissions}`);
    console.log(`   Size: ${(stats.size / 1024).toFixed(2)} KB`);
    
    try {
      const signInfo = execSync(`codesign -dv "${binaryPath}" 2>&1`, { encoding: 'utf8' });
      console.log('   Signature: ✅ Signed');
      console.log(signInfo.split('\n').slice(0, 3).join('\n'));
    } catch {
      console.log('   Signature: ⚠️  Not signed');
    }

    console.log('\n✅ afterPack hook completed successfully\n');

  } catch (error) {
    console.error('\n❌ afterPack hook failed:', error);
    console.error('   Audio capture may not work in production!\n');
    // Don't throw - allow build to continue
  }
};
