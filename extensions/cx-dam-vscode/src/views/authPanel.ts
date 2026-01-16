import * as vscode from 'vscode';
import { CxDamClient } from '../api/cxDamClient';
import { AuthManager } from '../utils/authManager';
import { CxDamUriHandler } from '../utils/uriHandler';

export class AuthPanel {
  public static currentPanel: AuthPanel | undefined;
  private readonly panel: vscode.WebviewPanel;
  private disposables: vscode.Disposable[] = [];

  private constructor(
    panel: vscode.WebviewPanel,
    private client: CxDamClient,
    private authManager: AuthManager,
    private uriHandler: CxDamUriHandler,
    private onAuthSuccess: () => void
  ) {
    this.panel = panel;

    this.panel.webview.html = this.getWebviewContent();

    this.panel.onDidDispose(() => this.dispose(), null, this.disposables);

    this.panel.webview.onDidReceiveMessage(
      async (message) => {
        switch (message.command) {
          case 'authenticate':
            await this.handleAuthentication();
            break;
          case 'cancel':
            this.panel.dispose();
            break;
        }
      },
      null,
      this.disposables
    );
  }

  public static createOrShow(
    extensionUri: vscode.Uri,
    client: CxDamClient,
    authManager: AuthManager,
    uriHandler: CxDamUriHandler,
    onAuthSuccess: () => void
  ) {
    const column = vscode.window.activeTextEditor
      ? vscode.window.activeTextEditor.viewColumn
      : undefined;

    if (AuthPanel.currentPanel) {
      AuthPanel.currentPanel.panel.reveal(column);
      return;
    }

    const panel = vscode.window.createWebviewPanel(
      'cxDamAuth',
      'CX DAM Authentication',
      column || vscode.ViewColumn.One,
      {
        enableScripts: true,
        localResourceRoots: [vscode.Uri.joinPath(extensionUri, 'resources')],
      }
    );

    AuthPanel.currentPanel = new AuthPanel(panel, client, authManager, uriHandler, onAuthSuccess);
  }

  private safePostMessage(message: any): boolean {
    try {
      if (!this.panel || this.panel.webview === undefined) {
        return false;
      }
      this.panel.webview.postMessage(message);
      return true;
    } catch (error) {
      // Panel is disposed, ignore
      return false;
    }
  }

  private async handleAuthentication() {
    try {
      // Get the vscode:// callback URL for this extension
      const callbackUri = await vscode.env.asExternalUri(
        vscode.Uri.parse(`${vscode.env.uriScheme}://cx-dam/auth/callback`)
      );
      const redirectUri = callbackUri.toString();

      console.log('Redirect URI:', redirectUri);

      // Get GitHub auth URL
      const authUrl = await this.client.getGitHubAuthUrl();

      // Add state parameter to indicate VS Code flow
      // GitHub will preserve this and pass it back to the callback
      const url = new URL(authUrl);
      url.searchParams.set('state', 'vscode');
      const finalAuthUrl = url.toString();

      console.log('Final auth URL with state:', finalAuthUrl);

      // Show status in webview
      this.safePostMessage({ command: 'waiting' });

      // Open in external browser
      const success = await vscode.env.openExternal(vscode.Uri.parse(finalAuthUrl));

      if (!success) {
        vscode.window.showErrorMessage('Failed to open authentication URL');
        this.safePostMessage({ command: 'ready' });
        return;
      }

      vscode.window.showInformationMessage(
        'Complete authentication in your browser. The code will be captured automatically.'
      );

      // Wait for URI handler to receive the code
      const code = await this.uriHandler.waitForAuthCallback();

      console.log('Received authorization code via URI handler');

      this.safePostMessage({ command: 'authenticating' });

      // Exchange code for token
      const authResponse = await this.client.exchangeCodeForToken(code);

      if (authResponse.success && authResponse.data.token) {
        // Save token and user
        await this.authManager.saveToken(authResponse.data.token);
        await this.authManager.saveUser(authResponse.data.user);

        vscode.window.showInformationMessage(
          `Successfully authenticated as ${authResponse.data.user.githubUsername}`
        );

        this.onAuthSuccess();

        // Safely dispose panel
        if (this.panel) {
          this.panel.dispose();
        }
      } else {
        throw new Error('Authentication failed');
      }
    } catch (error) {
      const errorMsg = this.client.handleError(error);
      vscode.window.showErrorMessage(`Authentication failed: ${errorMsg}`);
      this.safePostMessage({ command: 'error', error: errorMsg });
    }
  }

  private getWebviewContent(): string {
    return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>CX DAM Authentication</title>
    <style>
        body {
            font-family: var(--vscode-font-family);
            padding: 40px;
            color: var(--vscode-foreground);
            background-color: var(--vscode-editor-background);
        }
        .container {
            max-width: 600px;
            margin: 0 auto;
            text-align: center;
        }
        h1 {
            color: var(--vscode-foreground);
            margin-bottom: 20px;
        }
        .logo {
            font-size: 72px;
            margin-bottom: 30px;
        }
        .description {
            margin-bottom: 30px;
            line-height: 1.6;
            color: var(--vscode-descriptionForeground);
        }
        button {
            background-color: var(--vscode-button-background);
            color: var(--vscode-button-foreground);
            border: none;
            padding: 12px 24px;
            font-size: 14px;
            cursor: pointer;
            border-radius: 2px;
            margin: 5px;
        }
        button:hover {
            background-color: var(--vscode-button-hoverBackground);
        }
        button:disabled {
            opacity: 0.5;
            cursor: not-allowed;
        }
        .secondary-button {
            background-color: var(--vscode-button-secondaryBackground);
            color: var(--vscode-button-secondaryForeground);
        }
        .secondary-button:hover {
            background-color: var(--vscode-button-secondaryHoverBackground);
        }
        .status {
            margin-top: 20px;
            padding: 12px;
            border-radius: 4px;
            display: none;
        }
        .status.info {
            background-color: var(--vscode-inputValidation-infoBorder);
            color: var(--vscode-inputValidation-infoForeground);
        }
        .status.error {
            background-color: var(--vscode-inputValidation-errorBorder);
            color: var(--vscode-inputValidation-errorForeground);
        }
        .spinner {
            display: inline-block;
            width: 20px;
            height: 20px;
            border: 3px solid var(--vscode-button-foreground);
            border-top-color: transparent;
            border-radius: 50%;
            animation: spin 1s linear infinite;
        }
        @keyframes spin {
            to { transform: rotate(360deg); }
        }
        .features {
            margin-top: 40px;
            text-align: left;
        }
        .feature {
            margin: 15px 0;
            display: flex;
            align-items: center;
        }
        .feature-icon {
            margin-right: 10px;
            font-size: 20px;
        }
    </style>
</head>
<body>
    <div class="container">
        <div class="logo">🎨</div>
        <h1>CX DAM - Digital Asset Manager</h1>
        <p class="description">
            Access your digital assets directly from VS Code. Browse, search, and insert
            images, videos, and documents into your markdown files with ease.
        </p>

        <div>
            <button id="authButton" onclick="authenticate()">
                Authenticate with GitHub
            </button>
            <button class="secondary-button" onclick="cancel()">
                Cancel
            </button>
        </div>

        <div id="status" class="status"></div>

        <div class="features">
            <h3>Features:</h3>
            <div class="feature">
                <span class="feature-icon">🔍</span>
                <span>Search assets by name, workspace, or AI-powered semantic search</span>
            </div>
            <div class="feature">
                <span class="feature-icon">⚡</span>
                <span>Insert assets directly into your documents</span>
            </div>
            <div class="feature">
                <span class="feature-icon">🤖</span>
                <span>AI-generated descriptions for better discoverability</span>
            </div>
            <div class="feature">
                <span class="feature-icon">☁️</span>
                <span>Upload and manage assets from your IDE</span>
            </div>
        </div>
    </div>

    <script>
        const vscode = acquireVsCodeApi();

        function authenticate() {
            vscode.postMessage({ command: 'authenticate' });
        }

        function cancel() {
            vscode.postMessage({ command: 'cancel' });
        }

        function showStatus(message, type) {
            const statusEl = document.getElementById('status');
            statusEl.textContent = message;
            statusEl.className = 'status ' + type;
            statusEl.style.display = 'block';
        }

        function hideStatus() {
            const statusEl = document.getElementById('status');
            statusEl.style.display = 'none';
        }

        window.addEventListener('message', event => {
            const message = event.data;
            const button = document.getElementById('authButton');

            switch (message.command) {
                case 'waiting':
                    button.disabled = true;
                    button.innerHTML = 'Opening browser...';
                    showStatus('Please complete authentication in your browser', 'info');
                    break;
                case 'authenticating':
                    button.innerHTML = '<span class="spinner"></span> Authenticating...';
                    showStatus('Verifying credentials...', 'info');
                    break;
                case 'ready':
                    button.disabled = false;
                    button.innerHTML = 'Authenticate with GitHub';
                    hideStatus();
                    break;
                case 'error':
                    button.disabled = false;
                    button.innerHTML = 'Retry Authentication';
                    showStatus('Error: ' + message.error, 'error');
                    break;
            }
        });
    </script>
</body>
</html>`;
  }

  public dispose() {
    AuthPanel.currentPanel = undefined;

    this.panel.dispose();

    while (this.disposables.length) {
      const disposable = this.disposables.pop();
      if (disposable) {
        disposable.dispose();
      }
    }
  }
}
