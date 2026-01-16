import * as vscode from 'vscode';

export class CxDamUriHandler implements vscode.UriHandler {
  private pendingAuthPromise: {
    resolve: (code: string) => void;
    reject: (error: Error) => void;
  } | null = null;

  handleUri(uri: vscode.Uri): vscode.ProviderResult<void> {
    console.log('CX DAM URI handler called:', uri.toString());

    // Check if this is an auth callback
    if (uri.path === '/auth/callback') {
      const query = new URLSearchParams(uri.query);
      const code = query.get('code');
      const error = query.get('error');

      if (error) {
        const errorDescription = query.get('error_description') || error;
        console.error('OAuth error:', errorDescription);

        if (this.pendingAuthPromise) {
          this.pendingAuthPromise.reject(new Error(errorDescription));
          this.pendingAuthPromise = null;
        }

        vscode.window.showErrorMessage(`GitHub authentication failed: ${errorDescription}`);
        return;
      }

      if (code) {
        console.log('Authorization code received via URI handler');

        if (this.pendingAuthPromise) {
          this.pendingAuthPromise.resolve(code);
          this.pendingAuthPromise = null;
        } else {
          console.warn('Received auth code but no pending promise');
        }
      } else {
        console.error('No code or error in callback URI');

        if (this.pendingAuthPromise) {
          this.pendingAuthPromise.reject(new Error('No authorization code received'));
          this.pendingAuthPromise = null;
        }
      }
    }
  }

  /**
   * Wait for OAuth callback to be received
   * Returns a promise that resolves with the authorization code
   */
  waitForAuthCallback(): Promise<string> {
    return new Promise((resolve, reject) => {
      // Reject if not received within 5 minutes
      const timeout = setTimeout(() => {
        this.pendingAuthPromise = null;
        reject(new Error('Authentication timed out'));
      }, 5 * 60 * 1000);

      this.pendingAuthPromise = {
        resolve: (code: string) => {
          clearTimeout(timeout);
          resolve(code);
        },
        reject: (error: Error) => {
          clearTimeout(timeout);
          reject(error);
        },
      };
    });
  }

  /**
   * Cancel any pending authentication
   */
  cancelPendingAuth(): void {
    if (this.pendingAuthPromise) {
      this.pendingAuthPromise.reject(new Error('Authentication cancelled'));
      this.pendingAuthPromise = null;
    }
  }
}
