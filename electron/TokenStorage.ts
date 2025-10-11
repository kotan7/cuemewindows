import * as fs from 'fs'
import * as path from 'path'
import { app } from 'electron'
import * as crypto from 'crypto'

export interface StoredTokens {
  refreshToken: string
  expiresAt?: number
  userId?: string
}

export class TokenStorage {
  private readonly tokenFilePath: string
  private readonly encryptionKey = 'cueme-auth-tokens-key-v2'

  constructor() {
    // Store tokens in app's user data directory
    const userDataPath = app.getPath('userData')
    this.tokenFilePath = path.join(userDataPath, 'auth-tokens.json')
  }

  /**
   * Store refresh token using simple file encryption
   */
  public async storeTokens(tokens: StoredTokens): Promise<boolean> {
    try {
      console.log('[TokenStorage] Storing tokens securely...')
      console.log('[TokenStorage] Target file path:', this.tokenFilePath)
      
      const tokenData = JSON.stringify(tokens)
      const encryptedData = this.encrypt(tokenData)
      
      // Ensure directory exists
      const dir = path.dirname(this.tokenFilePath)
      console.log('[TokenStorage] Directory path:', dir)
      console.log('[TokenStorage] Directory exists:', fs.existsSync(dir))
      
      if (!fs.existsSync(dir)) {
        console.log('[TokenStorage] Creating directory...')
        fs.mkdirSync(dir, { recursive: true })
      }

      console.log('[TokenStorage] Writing file...')
      fs.writeFileSync(this.tokenFilePath, encryptedData, { encoding: 'utf8', mode: 0o600 })
      
      // Verify file was written
      const fileExists = fs.existsSync(this.tokenFilePath)
      console.log('[TokenStorage] File exists after write:', fileExists)
      
      if (fileExists) {
        const stats = fs.statSync(this.tokenFilePath)
        console.log('[TokenStorage] File size:', stats.size, 'bytes')
      }
      
      console.log('[TokenStorage] ✅ Tokens stored successfully')
      return true
    } catch (error) {
      console.error('[TokenStorage] ❌ Error storing tokens:', error)
      console.error('[TokenStorage] Error details:', {
        message: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : 'No stack trace'
      })
      return false
    }
  }

  /**
   * Retrieve and decrypt stored refresh token
   */
  public async getStoredTokens(): Promise<StoredTokens | null> {
    try {
      console.log('[TokenStorage] Retrieving stored tokens...')
      console.log('[TokenStorage] Looking for file:', this.tokenFilePath)
      console.log('[TokenStorage] File exists:', fs.existsSync(this.tokenFilePath))
      
      if (!fs.existsSync(this.tokenFilePath)) {
        console.log('[TokenStorage] No stored tokens found at expected path')
        
        // Check if old .dat file exists
        const oldPath = this.tokenFilePath.replace('.json', '.dat')
        if (fs.existsSync(oldPath)) {
          console.log('[TokenStorage] Found old .dat file, but using new .json format')
        }
        
        return null
      }

      const encryptedData = fs.readFileSync(this.tokenFilePath, 'utf8')
      console.log('[TokenStorage] Read encrypted data, length:', encryptedData.length)
      
      const decryptedData = this.decrypt(encryptedData)
      const tokens: StoredTokens = JSON.parse(decryptedData)
      
      console.log('[TokenStorage] ✅ Tokens retrieved successfully')
      console.log('[TokenStorage] - User ID:', tokens.userId || 'unknown')
      console.log('[TokenStorage] - Expires at:', tokens.expiresAt || 'no expiry')
      
      return tokens
    } catch (error) {
      console.error('[TokenStorage] ❌ Error retrieving tokens:', error)
      console.error('[TokenStorage] Error details:', {
        message: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : 'No stack trace'
      })
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

  /**
   * Simple encryption using AES-256-GCM
   */
  private encrypt(text: string): string {
    const algorithm = 'aes-256-gcm'
    const key = crypto.scryptSync(this.encryptionKey, 'salt', 32)
    const iv = crypto.randomBytes(16)
    const cipher = crypto.createCipheriv(algorithm, key, iv)
    
    let encrypted = cipher.update(text, 'utf8', 'hex')
    encrypted += cipher.final('hex')
    
    const authTag = cipher.getAuthTag()
    
    return JSON.stringify({
      encrypted,
      iv: iv.toString('hex'),
      authTag: authTag.toString('hex')
    })
  }

  /**
   * Simple decryption using AES-256-GCM
   */
  private decrypt(encryptedData: string): string {
    const algorithm = 'aes-256-gcm'
    const key = crypto.scryptSync(this.encryptionKey, 'salt', 32)
    
    const { encrypted, iv, authTag } = JSON.parse(encryptedData)
    
    const decipher = crypto.createDecipheriv(algorithm, key, Buffer.from(iv, 'hex'))
    decipher.setAuthTag(Buffer.from(authTag, 'hex'))
    
    let decrypted = decipher.update(encrypted, 'hex', 'utf8')
    decrypted += decipher.final('utf8')
    
    return decrypted
  }
}