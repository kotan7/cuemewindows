import { createClient, SupabaseClient, User } from '@supabase/supabase-js'
import { TokenStorage, StoredTokens } from './TokenStorage'

export interface AuthState {
  user: User | null
  session: any | null
  isLoading: boolean
}

export class AuthService {
  private supabase: SupabaseClient
  public tokenStorage: TokenStorage // Made public for debug access
  private authState: AuthState = {
    user: null,
    session: null,
    isLoading: true
  }
  private listeners: ((state: AuthState) => void)[] = []
  private refreshTimer: NodeJS.Timeout | null = null

  // Enhanced logging utility
  private log(level: 'info' | 'warn' | 'error', message: string, data?: any) {
    const timestamp = new Date().toISOString()
    const prefix = `[AuthService ${timestamp}]`
    
    if (level === 'error') {
      console.error(prefix, message, data || '')
    } else if (level === 'warn') {
      console.warn(prefix, message, data || '')
    } else {
      console.log(prefix, message, data || '')
    }
  }

  constructor() {
    // Initialize TokenStorage
    this.tokenStorage = new TokenStorage()
    
    // Environment variables in Electron main process
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
    
    if (!supabaseUrl || !supabaseAnonKey) {
      console.error('Missing Supabase configuration. Please set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY environment variables.')
      // Use placeholder values for development
      console.warn('Using placeholder Supabase configuration. Authentication will not work until proper credentials are provided.')
    }
    
    // Configure Supabase client with explicit session management
    this.supabase = createClient(
      supabaseUrl || 'https://placeholder.supabase.co',
      supabaseAnonKey || 'placeholder-key',
      {
        auth: {
          persistSession: false, // We handle persistence manually via TokenStorage
          autoRefreshToken: true, // Keep auto-refresh enabled
          detectSessionInUrl: false, // We handle deep links manually
          storage: undefined // Don't use default storage
        }
      }
    )
    this.initialize()
  }

  private async initialize() {
    this.log('info', 'Initializing authentication service...')
    
    // Set loading state at start
    this.updateAuthState({
      user: null,
      session: null,
      isLoading: true
    })
    
    try {
      // First, try to restore session from stored tokens
      this.log('info', 'Checking for stored refresh tokens...')
      const storedTokens = await this.tokenStorage.getStoredTokens()
      
      if (storedTokens && storedTokens.refreshToken) {
        this.log('info', 'Found stored refresh token, attempting restoration...', {
          userId: storedTokens.userId,
          expiresAt: storedTokens.expiresAt ? new Date(storedTokens.expiresAt).toISOString() : 'no expiry'
        })
        
        const restored = await this.restoreSessionWithRetry(storedTokens.refreshToken)
        
        if (restored) {
          this.setupAuthStateListener()
          this.log('info', '✅ Auth service initialization completed with restored session')
          return
        }
      } else {
        this.log('info', 'No stored tokens found')
      }
      
      // If no stored tokens or restoration failed, get current session normally
      this.log('info', 'Getting current session...')
      const { data: { session }, error } = await this.supabase.auth.getSession()
      
      if (error) {
        this.log('error', 'Error getting session:', error)
      } else {
        this.log('info', 'Session retrieved:', {
          hasSession: !!session,
          userEmail: session?.user?.email || 'null',
          expiresAt: session?.expires_at || 'null'
        })
      }

      this.updateAuthState({
        user: session?.user || null,
        session: session,
        isLoading: false
      })

      this.setupAuthStateListener()
      this.log('info', 'Auth service initialization completed')
    } catch (error) {
      this.log('error', 'Error initializing auth:', {
        message: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : 'No stack trace'
      })
      this.updateAuthState({
        user: null,
        session: null,
        isLoading: false
      })
    } finally {
      // Always ensure loading is false when done
      if (this.authState.isLoading) {
        this.updateAuthState({
          ...this.authState,
          isLoading: false
        })
      }
    }
  }

  // Session restoration with retry logic and exponential backoff
  private async restoreSessionWithRetry(
    refreshToken: string, 
    maxRetries: number = 3
  ): Promise<boolean> {
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      this.log('info', `Session restoration attempt ${attempt}/${maxRetries}`)
      
      try {
        // First, set the refresh token in the client
        // This is required before calling refreshSession()
        const { data: sessionData, error: setError } = await this.supabase.auth.setSession({
          access_token: refreshToken, // Use refresh token as access token temporarily
          refresh_token: refreshToken
        })
        
        if (setError) {
          this.log('warn', `setSession failed, trying refreshSession directly:`, {
            message: setError.message,
            status: setError.status
          })
          
          // If setSession fails, try refreshSession directly
          // This works when we have a valid refresh token stored
          const { data: refreshData, error: refreshError } = await this.supabase.auth.refreshSession({
            refresh_token: refreshToken
          })
          
          if (refreshError) {
            this.log('error', `Attempt ${attempt} failed:`, {
              message: refreshError.message,
              status: refreshError.status,
              name: refreshError.name
            })
            
            if (attempt < maxRetries) {
              // Exponential backoff: 1s, 2s, 4s
              const delay = Math.pow(2, attempt - 1) * 1000
              this.log('info', `Retrying in ${delay}ms...`)
              await new Promise(resolve => setTimeout(resolve, delay))
              continue
            }
            
            // All retries failed
            this.log('error', 'All restoration attempts failed, clearing tokens')
            this.tokenStorage.clearStoredTokens()
            return false
          }
          
          // refreshSession succeeded
          if (refreshData.session) {
            this.log('info', '✅ Session restored successfully via refreshSession', {
              email: refreshData.session.user?.email,
              userId: refreshData.session.user?.id,
              expiresAt: refreshData.session.expires_at
            })
            
            this.updateAuthState({
              user: refreshData.session.user,
              session: refreshData.session,
              isLoading: false
            })
            
            // Store updated tokens
            if (refreshData.session.refresh_token) {
              await this.storeRefreshToken(
                refreshData.session.refresh_token, 
                refreshData.session.user?.id
              )
            }
            
            this.setupTokenRefresh(refreshData.session)
            return true
          }
        } else if (sessionData.session) {
          // setSession succeeded
          this.log('info', '✅ Session restored successfully via setSession', {
            email: sessionData.session.user?.email,
            userId: sessionData.session.user?.id,
            expiresAt: sessionData.session.expires_at
          })
          
          this.updateAuthState({
            user: sessionData.session.user,
            session: sessionData.session,
            isLoading: false
          })
          
          // Store updated tokens
          if (sessionData.session.refresh_token) {
            await this.storeRefreshToken(
              sessionData.session.refresh_token, 
              sessionData.session.user?.id
            )
          }
          
          this.setupTokenRefresh(sessionData.session)
          return true
        }
      } catch (error) {
        this.log('error', `Exception in attempt ${attempt}:`, {
          message: error instanceof Error ? error.message : 'Unknown error',
          stack: error instanceof Error ? error.stack : 'No stack trace'
        })
        
        if (attempt === maxRetries) {
          this.tokenStorage.clearStoredTokens()
          return false
        }
        
        // Wait before retry
        const delay = Math.pow(2, attempt - 1) * 1000
        await new Promise(resolve => setTimeout(resolve, delay))
      }
    }
    
    return false
  }

  private setupAuthStateListener() {
    // Listen for auth changes
    this.supabase.auth.onAuthStateChange(async (event, session) => {
      this.log('info', '============================ Auth state changed! ============================')
      this.log('info', 'Auth event details:', {
        event,
        userEmail: session?.user?.email || 'null',
        userId: session?.user?.id || 'null',
        sessionExpires: session?.expires_at || 'null'
      })
      
      // Store refresh token on successful sign in or token refresh
      if ((event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') && session?.refresh_token) {
        this.log('info', 'Storing refresh token for persistent authentication...')
        await this.storeRefreshToken(session.refresh_token, session.user?.id)
        
        // Set up automatic token refresh
        this.setupTokenRefresh(session)
      }
      
      // Clear stored tokens on sign out
      if (event === 'SIGNED_OUT') {
        this.log('info', 'Clearing stored tokens on sign out...')
        this.tokenStorage.clearStoredTokens()
        this.clearTokenRefresh()
      }
      
      // Update auth state
      this.updateAuthState({
        user: session?.user || null,
        session: session,
        isLoading: false
      })

      // Handle window visibility after successful sign in
      if (event === 'SIGNED_IN' && session?.user) {
        this.log('info', 'User signed in, managing window visibility...')
        const { BrowserWindow } = require('electron')
        const mainWindow = BrowserWindow.getAllWindows()[0]
        
        if (mainWindow) {
          this.log('info', 'Main window found, bringing to front...')
          setTimeout(() => {
            this.log('info', 'Executing window visibility actions...')
            mainWindow.setAlwaysOnTop(true, 'floating')
            mainWindow.moveTop()
            this.log('info', 'Window visibility actions completed')
          }, 1000) // Give time for the UI to update
        } else {
          this.log('error', 'No main window found for visibility management')
        }
      }
    })
  }

  private setupTokenRefresh(session: any): void {
    // Clear any existing refresh timer
    this.clearTokenRefresh()
    
    if (!session?.expires_at) {
      this.log('info', 'No expiration time found, skipping token refresh setup')
      return
    }
    
    // Calculate when to refresh (5 minutes before expiration)
    const expiresAt = session.expires_at * 1000 // Convert to milliseconds
    const refreshAt = expiresAt - (5 * 60 * 1000) // 5 minutes before expiration
    const now = Date.now()
    const timeUntilRefresh = refreshAt - now
    
    this.log('info', 'Setting up automatic token refresh:', {
      expiresAt: new Date(expiresAt).toISOString(),
      refreshAt: new Date(refreshAt).toISOString(),
      minutesUntilRefresh: Math.round(timeUntilRefresh / 1000 / 60)
    })
    
    if (timeUntilRefresh > 0) {
      this.refreshTimer = setTimeout(async () => {
        this.log('info', 'Attempting automatic token refresh...')
        try {
          const { data, error } = await this.supabase.auth.refreshSession()
          
          if (error) {
            this.log('error', 'Automatic token refresh failed:', error)
            // Try to restore from stored tokens as fallback
            const storedTokens = await this.tokenStorage.getStoredTokens()
            if (storedTokens?.refreshToken) {
              this.log('info', 'Attempting fallback refresh with stored token...')
              await this.supabase.auth.setSession({
                access_token: '',
                refresh_token: storedTokens.refreshToken
              })
            }
          } else {
            this.log('info', '✅ Automatic token refresh successful')
          }
        } catch (refreshError) {
          this.log('error', 'Error during automatic token refresh:', refreshError)
        }
      }, timeUntilRefresh)
    } else {
      this.log('info', 'Token already expired or expires soon, refreshing immediately...')
      // Refresh immediately if token is already expired or expires very soon
      setTimeout(async () => {
        try {
          await this.supabase.auth.refreshSession()
        } catch (error) {
          this.log('error', 'Immediate token refresh failed:', error)
        }
      }, 1000)
    }
  }

  private clearTokenRefresh(): void {
    if (this.refreshTimer) {
      this.log('info', 'Clearing automatic token refresh timer')
      clearTimeout(this.refreshTimer)
      this.refreshTimer = null
    }
  }

  // Made public so DeepLinkHandler can call it explicitly
  public async storeRefreshToken(refreshToken: string, userId?: string): Promise<void> {
    try {
      const tokens: StoredTokens = {
        refreshToken,
        userId,
        // Extend to 60 days (Supabase refresh tokens last 60 days by default)
        expiresAt: Date.now() + (60 * 24 * 60 * 60 * 1000)
      }
      
      const success = await this.tokenStorage.storeTokens(tokens)
      if (success) {
        this.log('info', '✅ Refresh token stored', {
          userId,
          expiresAt: new Date(tokens.expiresAt!).toISOString()
        })
      } else {
        this.log('error', '❌ Failed to store refresh token')
      }
    } catch (error) {
      this.log('error', 'Error storing refresh token:', error)
    }
  }

  private updateAuthState(newState: AuthState) {
    this.log('info', 'Updating auth state:', {
      previousUser: this.authState.user?.email || 'null',
      newUser: newState.user?.email || 'null',
      previousLoading: this.authState.isLoading,
      newLoading: newState.isLoading
    })
    
    this.authState = { ...newState }
    
    this.log('info', `Notifying ${this.listeners.length} listeners...`)
    this.listeners.forEach((listener, index) => {
      try {
        listener(this.authState)
      } catch (error) {
        this.log('error', `Error notifying listener ${index}:`, error)
      }
    })
  }

  public onAuthStateChange(callback: (state: AuthState) => void) {
    this.listeners.push(callback)
    // Call immediately with current state
    callback(this.authState)
    
    // Return unsubscribe function
    return () => {
      const index = this.listeners.indexOf(callback)
      if (index > -1) {
        this.listeners.splice(index, 1)
      }
    }
  }

  public getAuthState(): AuthState {
    return { ...this.authState }
  }

  public async signInWithEmail(email: string, password: string) {
    try {
      const { data, error } = await this.supabase.auth.signInWithPassword({
        email,
        password
      })

      if (error) throw error

      return { success: true, user: data.user }
    } catch (error) {
      console.error('Sign in error:', error)
      return { success: false, error: error.message }
    }
  }

  public async signUpWithEmail(email: string, password: string) {
    try {
      const { data, error } = await this.supabase.auth.signUp({
        email,
        password
      })

      if (error) throw error

      return { success: true, user: data.user }
    } catch (error) {
      console.error('Sign up error:', error)
      return { success: false, error: error.message }
    }
  }

  public async signOut() {
    try {
      const { error } = await this.supabase.auth.signOut()
      
      if (error) throw error

      return { success: true }
    } catch (error) {
      console.error('Sign out error:', error)
      return { success: false, error: error.message }
    }
  }

  public async resetPassword(email: string) {
    try {
      const { error } = await this.supabase.auth.resetPasswordForEmail(email)
      
      if (error) throw error

      return { success: true }
    } catch (error) {
      console.error('Reset password error:', error)
      return { success: false, error: error.message }
    }
  }

  public getSupabaseClient(): SupabaseClient {
    return this.supabase
  }

  public isAuthenticated(): boolean {
    return !!this.authState.user && !!this.authState.session
  }

  public getCurrentUser(): User | null {
    return this.authState.user
  }

  public getAccessToken(): string | null {
    return this.authState.session?.access_token || null
  }

  public async setSessionFromTokens(accessToken: string, refreshToken: string) {
    try {
      this.log('info', 'Setting session from tokens...')
      const { data, error } = await this.supabase.auth.setSession({
        access_token: accessToken,
        refresh_token: refreshToken
      })

      if (error) {
        this.log('error', 'Error setting session:', error)
        throw error
      }

      this.log('info', '✅ Session set successfully', {
        user: data.session?.user?.email,
        expiresAt: data.session?.expires_at
      })
      
      return { success: true, session: data.session }
    } catch (error) {
      this.log('error', 'setSessionFromTokens error:', error)
      return { success: false, error: error.message }
    }
  }
}