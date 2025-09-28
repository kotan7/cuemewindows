import { createClient, SupabaseClient, User } from '@supabase/supabase-js'
import { TokenStorage, StoredTokens } from './TokenStorage'

export interface AuthState {
  user: User | null
  session: any | null
  isLoading: boolean
}

export class AuthService {
  private supabase: SupabaseClient
  private tokenStorage: TokenStorage
  private authState: AuthState = {
    user: null,
    session: null,
    isLoading: true
  }
  private listeners: ((state: AuthState) => void)[] = []
  private refreshTimer: NodeJS.Timeout | null = null

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
    
    this.supabase = createClient(
      supabaseUrl || 'https://placeholder.supabase.co',
      supabaseAnonKey || 'placeholder-key'
    )
    this.initialize()
  }

  private async initialize() {
    console.log('[AuthService] Initializing authentication service...')
    try {
      // First, try to restore session from stored tokens
      console.log('[AuthService] Checking for stored refresh tokens...')
      const storedTokens = await this.tokenStorage.getStoredTokens()
      
      if (storedTokens && storedTokens.refreshToken) {
        console.log('[AuthService] Found stored refresh token, attempting to restore session...')
        try {
          const { data, error } = await this.supabase.auth.setSession({
            access_token: '', // Will be refreshed automatically
            refresh_token: storedTokens.refreshToken
          })
          
          if (error) {
            console.error('[AuthService] Error restoring session from stored tokens:', error)
            // Clear invalid tokens
            this.tokenStorage.clearStoredTokens()
          } else if (data.session) {
            console.log('[AuthService] ✅ Session restored from stored tokens')
            console.log('[AuthService] - User email:', data.session.user?.email)
            console.log('[AuthService] - Expires at:', data.session.expires_at)
            
            this.updateAuthState({
              user: data.session.user,
              session: data.session,
              isLoading: false
            })
            
            // Update stored tokens with new refresh token if provided
             if (data.session.refresh_token) {
               await this.storeRefreshToken(data.session.refresh_token, data.session.user?.id)
             }
             
             // Set up automatic token refresh for restored session
             this.setupTokenRefresh(data.session)
             
             this.setupAuthStateListener()
             console.log('[AuthService] Auth service initialization completed with restored session')
             return
          }
        } catch (restoreError) {
          console.error('[AuthService] Failed to restore session:', restoreError)
          this.tokenStorage.clearStoredTokens()
        }
      }
      
      // If no stored tokens or restoration failed, get current session normally
      console.log('[AuthService] Getting current session...')
      const { data: { session }, error } = await this.supabase.auth.getSession()
      
      if (error) {
        console.error('[AuthService] Error getting session:', error)
      } else {
        console.log('[AuthService] Session retrieved:')
        console.log('[AuthService] - Has session:', !!session)
        console.log('[AuthService] - User email:', session?.user?.email || 'null')
        console.log('[AuthService] - Expires at:', session?.expires_at || 'null')
      }

      this.updateAuthState({
        user: session?.user || null,
        session: session,
        isLoading: false
      })

      this.setupAuthStateListener()
      console.log('[AuthService] Auth service initialization completed')
    } catch (error) {
      console.error('[AuthService] Error initializing auth:', error)
      console.error('[AuthService] Error details:', {
        message: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : 'No stack trace'
      })
      this.updateAuthState({
        user: null,
        session: null,
        isLoading: false
      })
    }
  }

  private setupAuthStateListener() {
    // Listen for auth changes
    this.supabase.auth.onAuthStateChange(async (event, session) => {
      console.log('[AuthService] ============================')
      console.log('[AuthService] Auth state changed!')
      console.log('[AuthService] - Event:', event)
      console.log('[AuthService] - User email:', session?.user?.email || 'null')
      console.log('[AuthService] - User ID:', session?.user?.id || 'null')
      console.log('[AuthService] - Session expires:', session?.expires_at || 'null')
      console.log('[AuthService] ============================')
      
      // Store refresh token on successful sign in or token refresh
      if ((event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') && session?.refresh_token) {
        console.log('[AuthService] Storing refresh token for persistent authentication...')
        await this.storeRefreshToken(session.refresh_token, session.user?.id)
        
        // Set up automatic token refresh
        this.setupTokenRefresh(session)
      }
      
      // Clear stored tokens on sign out
      if (event === 'SIGNED_OUT') {
        console.log('[AuthService] Clearing stored tokens on sign out...')
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
        console.log('[AuthService] User signed in, managing window visibility...')
        const { BrowserWindow } = require('electron')
        const mainWindow = BrowserWindow.getAllWindows()[0]
        
        if (mainWindow) {
          console.log('[AuthService] Main window found, bringing to front...')
          setTimeout(() => {
            console.log('[AuthService] Executing window visibility actions...')
            mainWindow.setAlwaysOnTop(true, 'floating')
            mainWindow.moveTop()
            console.log('[AuthService] Window visibility actions completed')
          }, 1000) // Give time for the UI to update
        } else {
          console.error('[AuthService] No main window found for visibility management')
        }
      }
    })
  }

  private setupTokenRefresh(session: any): void {
    // Clear any existing refresh timer
    this.clearTokenRefresh()
    
    if (!session?.expires_at) {
      console.log('[AuthService] No expiration time found, skipping token refresh setup')
      return
    }
    
    // Calculate when to refresh (5 minutes before expiration)
    const expiresAt = session.expires_at * 1000 // Convert to milliseconds
    const refreshAt = expiresAt - (5 * 60 * 1000) // 5 minutes before expiration
    const now = Date.now()
    const timeUntilRefresh = refreshAt - now
    
    console.log('[AuthService] Setting up automatic token refresh:')
    console.log('[AuthService] - Expires at:', new Date(expiresAt).toISOString())
    console.log('[AuthService] - Will refresh at:', new Date(refreshAt).toISOString())
    console.log('[AuthService] - Time until refresh:', Math.round(timeUntilRefresh / 1000 / 60), 'minutes')
    
    if (timeUntilRefresh > 0) {
      this.refreshTimer = setTimeout(async () => {
        console.log('[AuthService] Attempting automatic token refresh...')
        try {
          const { data, error } = await this.supabase.auth.refreshSession()
          
          if (error) {
            console.error('[AuthService] Automatic token refresh failed:', error)
            // Try to restore from stored tokens as fallback
            const storedTokens = await this.tokenStorage.getStoredTokens()
            if (storedTokens?.refreshToken) {
              console.log('[AuthService] Attempting fallback refresh with stored token...')
              await this.supabase.auth.setSession({
                access_token: '',
                refresh_token: storedTokens.refreshToken
              })
            }
          } else {
            console.log('[AuthService] ✅ Automatic token refresh successful')
          }
        } catch (refreshError) {
          console.error('[AuthService] Error during automatic token refresh:', refreshError)
        }
      }, timeUntilRefresh)
    } else {
      console.log('[AuthService] Token already expired or expires soon, refreshing immediately...')
      // Refresh immediately if token is already expired or expires very soon
      setTimeout(async () => {
        try {
          await this.supabase.auth.refreshSession()
        } catch (error) {
          console.error('[AuthService] Immediate token refresh failed:', error)
        }
      }, 1000)
    }
  }

  private clearTokenRefresh(): void {
    if (this.refreshTimer) {
      console.log('[AuthService] Clearing automatic token refresh timer')
      clearTimeout(this.refreshTimer)
      this.refreshTimer = null
    }
  }

  private async storeRefreshToken(refreshToken: string, userId?: string): Promise<void> {
    try {
      const tokens: StoredTokens = {
        refreshToken,
        userId,
        expiresAt: Date.now() + (30 * 24 * 60 * 60 * 1000) // 30 days from now
      }
      
      const success = await this.tokenStorage.storeTokens(tokens)
      if (success) {
        console.log('[AuthService] ✅ Refresh token stored successfully')
      } else {
        console.error('[AuthService] ❌ Failed to store refresh token')
      }
    } catch (error) {
      console.error('[AuthService] Error storing refresh token:', error)
    }
  }

  private updateAuthState(newState: AuthState) {
    console.log('[AuthService] Updating auth state:')
    console.log('[AuthService] - Previous user:', this.authState.user?.email || 'null')
    console.log('[AuthService] - New user:', newState.user?.email || 'null')
    console.log('[AuthService] - Previous loading:', this.authState.isLoading)
    console.log('[AuthService] - New loading:', newState.isLoading)
    
    this.authState = { ...newState }
    
    console.log('[AuthService] Notifying', this.listeners.length, 'listeners...')
    this.listeners.forEach((listener, index) => {
      try {
        listener(this.authState)
        console.log('[AuthService] Listener', index, 'notified successfully')
      } catch (error) {
        console.error('[AuthService] Error notifying listener', index, ':', error)
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
      console.log('[AuthService] Setting session from tokens...')
      const { data, error } = await this.supabase.auth.setSession({
        access_token: accessToken,
        refresh_token: refreshToken
      })

      if (error) {
        console.error('[AuthService] Error setting session:', error)
        throw error
      }

      console.log('[AuthService] ✅ Session set successfully')
      console.log('[AuthService] - User:', data.session?.user?.email)
      console.log('[AuthService] - Expires at:', data.session?.expires_at)
      
      return { success: true, session: data.session }
    } catch (error) {
      console.error('[AuthService] setSessionFromTokens error:', error)
      return { success: false, error: error.message }
    }
  }
}