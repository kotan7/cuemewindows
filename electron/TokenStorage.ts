import { safeStorage } from 'electron'
import * as fs from 'fs'
import * as path from 'path'
import { app } from 'electron'

export interface StoredTokens {
  refreshToken: string
  expiresAt?: number
  userId?: string
}

export class TokenStorage {
  private readonly tokenFilePath: string
  private readonly encryptionKey = 'cueme-auth-tokens'

  constructor() {
    // Store tokens in app's user data directory
    const userDataPath = app.getPath('userData')
    this.tokenFilePath = path.join(userDataPath, 'auth-tokens.dat')
  }

  /**
   * Securely store refresh token using Electron's safeStorage
   */
  public async storeTokens(tokens: StoredTokens): Promise<boolean> {
    try {
      console.log('[TokenStorage] Storing tokens securely...')
      
      if (!safeStorage.isEncryptionAvailable()) {
        console.error('[TokenStorage] Encryption not available on this system')
        return false
      }

      const tokenData = JSON.stringify(tokens)
      const encryptedData = safeStorage.encryptString(tokenData)
      
      // Ensure directory exists
      const dir = path.dirname(this.tokenFilePath)
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true })
      }

      fs.writeFileSync(this.tokenFilePath, encryptedData)
      console.log('[TokenStorage] ✅ Tokens stored successfully')
      return true
    } catch (error) {
      console.error('[TokenStorage] ❌ Error storing tokens:', error)
      return false
    }
  }

  /**
   * Retrieve and decrypt stored refresh token
   */
  public async getStoredTokens(): Promise<StoredTokens | null> {
    try {
      console.log('[TokenStorage] Retrieving stored tokens...')
      
      if (!fs.existsSync(this.tokenFilePath)) {
        console.log('[TokenStorage] No stored tokens found')
        return null
      }

      if (!safeStorage.isEncryptionAvailable()) {
        console.error('[TokenStorage] Encryption not available for decryption')
        return null
      }

      const encryptedData = fs.readFileSync(this.tokenFilePath)
      const decryptedData = safeStorage.decryptString(encryptedData)
      const tokens: StoredTokens = JSON.parse(decryptedData)
      
      console.log('[TokenStorage] ✅ Tokens retrieved successfully')
      console.log('[TokenStorage] - User ID:', tokens.userId || 'unknown')
      console.log('[TokenStorage] - Expires at:', tokens.expiresAt || 'no expiry')
      
      return tokens
    } catch (error) {
      console.error('[TokenStorage] ❌ Error retrieving tokens:', error)
      // If we can't decrypt, remove the corrupted file
      this.clearStoredTokens()
      return null
    }
  }

  /**
   * Clear stored tokens (on logout or corruption)
   */
  public clearStoredTokens(): void {
    try {
      console.log('[TokenStorage] Clearing stored tokens...')
      
      if (fs.existsSync(this.tokenFilePath)) {
        fs.unlinkSync(this.tokenFilePath)
        console.log('[TokenStorage] ✅ Tokens cleared successfully')
      } else {
        console.log('[TokenStorage] No tokens to clear')
      }
    } catch (error) {
      console.error('[TokenStorage] ❌ Error clearing tokens:', error)
    }
  }

  /**
   * Check if tokens are stored and valid
   */
  public async hasValidTokens(): Promise<boolean> {
    const tokens = await this.getStoredTokens()
    if (!tokens) return false

    // Check if tokens have expired (if expiry is set)
    if (tokens.expiresAt && Date.now() > tokens.expiresAt) {
      console.log('[TokenStorage] Stored tokens have expired')
      this.clearStoredTokens()
      return false
    }

    return true
  }
}