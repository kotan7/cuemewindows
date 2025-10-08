import dotenv from "dotenv";
import path from "path";

/**
 * Environment variable loader with multiple fallback paths
 * Tries various locations to find .env file for better reliability
 */
export class EnvLoader {
  /**
   * Load environment variables from .env file
   * Tries multiple paths in order of preference
   */
  static load(): void {
    const envPaths = [
      path.join(process.cwd(), '.env.local'),
      path.join(process.cwd(), '.env'),
      path.join(process.resourcesPath || process.cwd(), '.env.local'),
      path.join(process.resourcesPath || process.cwd(), '.env'),
      '.env.local',
      '.env'
    ];

    let envLoaded = false;
    for (const envPath of envPaths) {
      try {
        const result = dotenv.config({ path: envPath });
        if (!result.error) {
          console.log(`[ENV] Successfully loaded environment from: ${envPath}`);
          envLoaded = true;
          break;
        }
      } catch (error) {
        // Continue to next path
      }
    }

    if (!envLoaded) {
      console.log('[ENV] No .env file found, using default dotenv.config()');
      dotenv.config(); // Fallback to default
    }
  }

  /**
   * Validate that required environment variables are present
   */
  static validate(): { valid: boolean; missing: string[] } {
    const required = ['GEMINI_API_KEY'];
    const optional = ['OPENAI_API_KEY', 'SUPABASE_URL', 'SUPABASE_ANON_KEY'];
    
    const missing: string[] = [];
    
    for (const key of required) {
      if (!process.env[key]) {
        missing.push(key);
      }
    }

    // Log status of optional keys
    for (const key of optional) {
      const status = process.env[key] ? 'Present' : 'Missing';
      console.log(`[ENV] ${key}: ${status}`);
    }

    if (missing.length > 0) {
      console.error('[ENV] Missing required environment variables:', missing);
    }

    return {
      valid: missing.length === 0,
      missing
    };
  }
}
