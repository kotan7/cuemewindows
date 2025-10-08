import http from "http";
import { URL } from "url";
import type { AuthService } from "../AuthService";
import type { BrowserWindow } from "electron";

/**
 * HTTP server to handle OAuth callbacks from web browser
 * Listens on localhost:3001 for auth redirect from Supabase
 */
export class AuthCallbackServer {
  private server: http.Server | null = null;
  private readonly port = 3001;

  constructor(
    private authService: AuthService,
    private getMainWindow: () => BrowserWindow | null,
    private showMainWindow: () => void
  ) {}

  /**
   * Start the auth callback server
   */
  start(): void {
    this.server = http.createServer((req, res) => {
      console.log('[AuthCallback] Received request:', req.url);
      
      if (req.url?.startsWith('/auth/callback')) {
        this.handleAuthCallback(req.url, res);
      } else {
        res.writeHead(404, { 'Content-Type': 'text/plain' });
        res.end('Not Found');
      }
    });
    
    this.server.listen(this.port, 'localhost', () => {
      console.log(`[AuthCallback] Auth callback server listening on http://localhost:${this.port}`);
    });
    
    this.server.on('error', (error) => {
      console.error('[AuthCallback] Server error:', error);
    });
  }

  /**
   * Stop the auth callback server
   */
  stop(): void {
    if (this.server) {
      this.server.close();
      this.server = null;
      console.log('[AuthCallback] Server stopped');
    }
  }

  /**
   * Handle authentication callback from browser
   */
  private handleAuthCallback(url: string, res: http.ServerResponse): void {
    try {
      const parsedUrl = new URL(url, `http://localhost:${this.port}`);
      const accessToken = parsedUrl.searchParams.get('access_token');
      const refreshToken = parsedUrl.searchParams.get('refresh_token');
      const testMode = parsedUrl.searchParams.get('test_mode') === 'true';
      
      console.log('[AuthCallback] Extracted tokens:');
      console.log('[AuthCallback] - Access token:', accessToken ? `${accessToken.substring(0, 20)}...` : 'null');
      console.log('[AuthCallback] - Refresh token:', refreshToken ? `${refreshToken.substring(0, 20)}...` : 'null');
      console.log('[AuthCallback] - Test mode:', testMode);
      
      if (accessToken && refreshToken) {
        // Set session in AuthService
        this.authService.setSessionFromTokens(accessToken, refreshToken)
          .then(() => {
            console.log('[AuthCallback] ✅ Authentication successful');
            
            // Show and focus the window
            const mainWindow = this.getMainWindow();
            if (mainWindow) {
              this.showMainWindow();
              mainWindow.focus();
              mainWindow.setAlwaysOnTop(true, 'floating');
              setTimeout(() => {
                if (mainWindow && !mainWindow.isDestroyed()) {
                  mainWindow.setAlwaysOnTop(false);
                }
              }, 2000);
            }
          })
          .catch((error) => {
            console.error('[AuthCallback] ❌ Authentication failed:', error);
          });
        
        // Send success response
        res.writeHead(200, { 'Content-Type': 'text/html' });
        res.end(this.getSuccessPage());
      } else {
        // Missing tokens
        res.writeHead(400, { 'Content-Type': 'text/html' });
        res.end(this.getErrorPage('Missing authentication tokens. Please try again.'));
      }
    } catch (error) {
      console.error('[AuthCallback] Error processing callback:', error);
      res.writeHead(500, { 'Content-Type': 'text/html' });
      res.end(this.getErrorPage('An error occurred processing the authentication callback.'));
    }
  }

  /**
   * Generate success page HTML
   */
  private getSuccessPage(): string {
    return `
      <html>
        <head>
          <title>CueMe - 認証完了</title>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1">
          <style>
            * { margin: 0; padding: 0; box-sizing: border-box; }
            body { 
              font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
              background: linear-gradient(135deg, #F7F7EE 0%, #e8f5e8 100%);
              min-height: 100vh;
              display: flex;
              align-items: center;
              justify-content: center;
              color: #333;
            }
            .container {
              background: rgba(255, 255, 255, 0.9);
              backdrop-filter: blur(10px);
              border-radius: 20px;
              padding: 40px;
              text-align: center;
              box-shadow: 0 20px 40px rgba(0, 0, 0, 0.1);
              max-width: 500px;
              width: 90%;
            }
            .logo {
              width: 80px;
              height: 80px;
              background: #f0f9f0;
              border-radius: 50%;
              display: flex;
              align-items: center;
              justify-content: center;
              margin: 0 auto 20px;
              font-size: 40px;
            }
            h1 {
              color: #013220;
              font-size: 32px;
              font-weight: bold;
              margin-bottom: 10px;
            }
            h2 {
              color: #065f46;
              font-size: 24px;
              margin-bottom: 20px;
            }
            p {
              color: #666;
              font-size: 16px;
              line-height: 1.6;
              margin-bottom: 30px;
            }
            .features {
              text-align: left;
              background: rgba(1, 50, 32, 0.05);
              border-radius: 15px;
              padding: 25px;
              margin: 20px 0;
            }
            .features h3 {
              color: #013220;
              font-size: 18px;
              margin-bottom: 15px;
              text-align: center;
            }
            .feature-item {
              display: flex;
              align-items: center;
              margin: 12px 0;
              font-size: 14px;
              color: #555;
            }
            .check {
              color: #10b981;
              margin-right: 10px;
              font-weight: bold;
            }
            .close-note {
              background: rgba(16, 185, 129, 0.1);
              border: 1px solid rgba(16, 185, 129, 0.3);
              border-radius: 10px;
              padding: 15px;
              font-size: 14px;
              color: #065f46;
            }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="logo">✅</div>
            <h1>CueMe</h1>
            <h2>認証成功！</h2>
            <p>ログインが完了しました。アプリで質問回答コレクションを使って面接対策を始めましょう。</p>
            
            <div class="features">
              <h3>🚀 利用可能な機能</h3>
              <div class="feature-item">
                <span class="check">✓</span>
                AIによる音声質問分析
              </div>
              <div class="feature-item">
                <span class="check">✓</span>
                スクリーンショット自動解析
              </div>
              <div class="feature-item">
                <span class="check">✓</span>
                質問回答コレクション作成
              </div>
              <div class="feature-item">
                <span class="check">✓</span>
                面接モード対応
              </div>
              <div class="feature-item">
                <span class="check">✓</span>
                リアルタイム回答支援
              </div>
            </div>
            
            <div class="close-note">
              💡 このタブを閉じて、CueMeアプリをお楽しみください！
            </div>
          </div>
          
          <script>
            // Auto-close tab after 5 seconds
            setTimeout(() => {
              try {
                window.close();
              } catch (e) {
                // Fallback if window.close() is blocked
                document.body.innerHTML = '<div class="container"><h2 style="color: #013220;">このタブを閉じてアプリに戻ってください</h2></div>';
              }
            }, 5000);
          </script>
        </body>
      </html>
    `;
  }

  /**
   * Generate error page HTML
   */
  private getErrorPage(message: string): string {
    return `
      <html>
        <head>
          <title>CueMe - Authentication Error</title>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1">
        </head>
        <body style="font-family: Arial, sans-serif; text-align: center; padding: 50px;">
          <h2>❌ Authentication Failed</h2>
          <p>${message}</p>
        </body>
      </html>
    `;
  }
}
