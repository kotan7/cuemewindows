/**
 * Audio System Debugger
 * Comprehensive debugging utility to diagnose audio issues in production
 */

export class AudioDebugger {
  static async diagnoseAudioSystem(): Promise<void> {
    console.log('🔍 ===== AUDIO SYSTEM DIAGNOSTICS =====');
    
    // 1. Check Environment Variables
    console.log('📋 Environment Variables:');
    console.log('  NODE_ENV:', process.env.NODE_ENV);
    console.log('  OPENAI_API_KEY:', process.env.OPENAI_API_KEY ? 'Present' : 'Missing');
    console.log('  GEMINI_API_KEY:', process.env.GEMINI_API_KEY ? 'Present' : 'Missing');
    console.log('  SUPABASE_URL:', process.env.SUPABASE_URL ? 'Present' : 'Missing');
    
    // 2. Check Process Information
    console.log('📋 Process Information:');
    console.log('  Platform:', process.platform);
    console.log('  Architecture:', process.arch);
    console.log('  CWD:', process.cwd());
    console.log('  Resources Path:', process.resourcesPath || 'Not Available');
    console.log('  App Packaged:', process.resourcesPath ? 'Yes' : 'No');
    
    // 3. Check Native Binary
    await this.checkNativeBinary();
    
    // 4. Check Permissions
    await this.checkPermissions();
    
    // 5. Test Audio Subsystems
    await this.testAudioSubsystems();
    
    console.log('🔍 ===== DIAGNOSTICS COMPLETE =====');
  }
  
  private static async checkNativeBinary(): Promise<void> {
    console.log('📋 Native Binary Check:');
    
    const { app } = await import('electron');
    const path = await import('path');
    const fs = await import('fs');
    
    const isDev = !app.isPackaged;
    const binaryPath = isDev 
      ? path.join(process.cwd(), 'dist-native', 'SystemAudioCapture')
      : path.join(process.resourcesPath, 'dist-native', 'SystemAudioCapture');
    
    console.log('  Expected Binary Path:', binaryPath);
    console.log('  Binary Exists:', fs.existsSync(binaryPath));
    
    if (fs.existsSync(binaryPath)) {
      const stats = fs.statSync(binaryPath);
      console.log('  Binary Size:', stats.size, 'bytes');
      console.log('  Binary Executable:', (stats.mode & fs.constants.S_IXUSR) !== 0);
      console.log('  Binary Modified:', stats.mtime.toISOString());
    }
  }
  
  private static async checkPermissions(): Promise<void> {
    console.log('📋 macOS Permissions:');
    
    try {
      // Test microphone permission via getUserMedia
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      console.log('  Microphone Permission: Granted');
      stream.getTracks().forEach(track => track.stop());
    } catch (error) {
      console.log('  Microphone Permission: Denied or Error:', (error as Error).message);
    }
    
    try {
      // Test screen capture permission via desktopCapturer
      const { desktopCapturer } = await import('electron');
      const sources = await desktopCapturer.getSources({ types: ['screen'] });
      console.log('  Screen Recording Permission:', sources.length > 0 ? 'Granted' : 'Denied');
    } catch (error) {
      console.log('  Screen Recording Permission: Error:', (error as Error).message);
    }
  }
  
  private static async testAudioSubsystems(): Promise<void> {
    console.log('📋 Audio Subsystem Tests:');
    
    // Test SystemAudioCapture
    try {
      const { SystemAudioCapture } = await import('./SystemAudioCapture');
      const capture = new SystemAudioCapture();
      const sources = await capture.getAvailableSources();
      console.log('  SystemAudioCapture Sources:', sources.length);
      sources.forEach(source => {
        console.log(`    - ${source.name} (${source.type}): ${source.available ? 'Available' : 'Unavailable'}`);
      });
      capture.destroy();
    } catch (error) {
      console.log('  SystemAudioCapture Error:', (error as Error).message);
    }
    
    // Test AudioTranscriber
    try {
      const openaiKey = process.env.OPENAI_API_KEY;
      if (openaiKey) {
        const { AudioTranscriber } = await import('./audio/AudioTranscriber');
        const transcriber = new AudioTranscriber(openaiKey);
        console.log('  AudioTranscriber: Initialized successfully');
      } else {
        console.log('  AudioTranscriber: Cannot initialize - Missing OpenAI API key');
      }
    } catch (error) {
      console.log('  AudioTranscriber Error:', (error as Error).message);
    }
  }
}