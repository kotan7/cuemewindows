import { createClient, SupabaseClient, User } from '@supabase/supabase-js'

export interface AuthState {
  user: User | null
  session: any | null
  isLoading: boolean
}

export class AuthService {
  private supabase: SupabaseClient
  private authState: AuthState = {
    user: null,
    session: null,
    isLoading: true
  }
  private listeners: ((state: AuthState) => void)[] = []

  constructor() {
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
      // Get the current session
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

      // Listen for auth changes
      this.supabase.auth.onAuthStateChange((event, session) => {
        console.log('[AuthService] ============================')
        console.log('[AuthService] Auth state changed!')
        console.log('[AuthService] - Event:', event)
        console.log('[AuthService] - User email:', session?.user?.email || 'null')
        console.log('[AuthService] - User ID:', session?.user?.id || 'null')
        console.log('[AuthService] - Session expires:', session?.expires_at || 'null')
        console.log('[AuthService] ============================')
        
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