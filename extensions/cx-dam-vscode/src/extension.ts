import * as vscode from 'vscode';
import { CxDamClient, Workspace } from './api/cxDamClient';
import { AuthManager } from './utils/authManager';
import { AssetTreeProvider } from './views/assetTreeProvider';
import { AuthPanel } from './views/authPanel';
import { SearchPanel } from './views/searchPanel';
import { registerAssetCommands } from './commands/assetCommands';
import { CxDamUriHandler } from './utils/uriHandler';

let client: CxDamClient;
let authManager: AuthManager;
let assetTreeProvider: AssetTreeProvider;
let workspaces: Workspace[] = [];
let uriHandler: CxDamUriHandler;

export async function activate(context: vscode.ExtensionContext) {
  console.log('CX DAM extension is now active');

  // Register URI handler for OAuth callbacks
  uriHandler = new CxDamUriHandler();
  context.subscriptions.push(vscode.window.registerUriHandler(uriHandler));

  // Initialize services
  const config = vscode.workspace.getConfiguration('cxDam');
  const apiUrl = config.get<string>('apiUrl') || 'http://localhost:3001/api';

  client = new CxDamClient(apiUrl);
  authManager = new AuthManager(context);

  // Restore token if exists
  const token = await authManager.getToken();
  if (token) {
    client.setToken(token);
    try {
      workspaces = await client.getWorkspaces();
    } catch (error) {
      console.error('Failed to restore session:', error);
      await authManager.clearToken();
    }
  }

  // Initialize tree view
  assetTreeProvider = new AssetTreeProvider(client);
  vscode.window.registerTreeDataProvider('cxDamAssets', assetTreeProvider);

  // Register workspace tree provider
  const workspaceTreeProvider = new WorkspaceTreeProvider(workspaces);
  vscode.window.registerTreeDataProvider('cxDamWorkspaces', workspaceTreeProvider);

  // Update workspace tree when auth changes
  authManager.onDidChangeAuth(async (authenticated) => {
    if (authenticated) {
      try {
        workspaces = await client.getWorkspaces();
        workspaceTreeProvider.refresh(workspaces);
        await assetTreeProvider.loadAssets();
      } catch (error) {
        vscode.window.showErrorMessage(
          `Failed to load workspaces: ${client.handleError(error)}`
        );
      }
    } else {
      workspaces = [];
      workspaceTreeProvider.refresh([]);
      assetTreeProvider.refresh();
    }
  });

  // Register commands
  registerAssetCommands(context);

  // Authentication command
  context.subscriptions.push(
    vscode.commands.registerCommand('cx-dam.authenticate', async () => {
      AuthPanel.createOrShow(context.extensionUri, client, authManager, uriHandler, async () => {
        // On successful auth, load assets
        try {
          workspaces = await client.getWorkspaces();
          workspaceTreeProvider.refresh(workspaces);
          await assetTreeProvider.loadAssets();
        } catch (error) {
          vscode.window.showErrorMessage(
            `Failed to load data: ${client.handleError(error)}`
          );
        }
      });
    })
  );

  // Authenticate with Token command
  context.subscriptions.push(
    vscode.commands.registerCommand('cx-dam.authenticateWithToken', async () => {
      const token = await vscode.window.showInputBox({
        prompt: 'Enter your CX DAM personal access token',
        placeHolder: 'Paste token from CX DAM web app (User menu > Copy Token for VS Code)',
        password: true,
        ignoreFocusOut: true,
        validateInput: (value) => {
          if (!value || value.trim().length === 0) {
            return 'Token cannot be empty';
          }
          return null;
        },
      });

      if (!token) {
        return;
      }

      // Set token on client
      client.setToken(token.trim());

      try {
        // Validate token by fetching workspaces
        workspaces = await client.getWorkspaces();

        // Token is valid, save it
        await authManager.saveToken(token.trim());

        // Get user info
        try {
          const user = await authManager.getUser();
          if (!user) {
            // If user not saved, try to fetch from API
            // Note: We'd need to add a getMe endpoint to the client
            vscode.window.showInformationMessage('Successfully authenticated with token!');
          }
        } catch (error) {
          // User fetch failed, but token is valid for workspace access
          console.error('Failed to fetch user info:', error);
        }

        // Load data
        workspaceTreeProvider.refresh(workspaces);
        await assetTreeProvider.loadAssets();

        vscode.window.showInformationMessage(
          `Successfully authenticated! Found ${workspaces.length} workspace(s).`
        );
      } catch (error) {
        // Token validation failed
        client.clearToken();
        vscode.window.showErrorMessage(
          `Authentication failed: ${client.handleError(error)}. Please check your token and try again.`
        );
      }
    })
  );

  // Logout command
  context.subscriptions.push(
    vscode.commands.registerCommand('cx-dam.logout', async () => {
      const confirm = await vscode.window.showWarningMessage(
        'Are you sure you want to logout?',
        'Yes',
        'No'
      );

      if (confirm === 'Yes') {
        await authManager.clearToken();
        client.clearToken();
        vscode.window.showInformationMessage('Logged out from CX DAM');
      }
    })
  );

  // Show assets command
  context.subscriptions.push(
    vscode.commands.registerCommand('cx-dam.showAssets', async () => {
      if (!client.isAuthenticated()) {
        vscode.window.showWarningMessage('Please authenticate first');
        vscode.commands.executeCommand('cx-dam.authenticate');
        return;
      }

      await assetTreeProvider.loadAssets();
      vscode.window.showInformationMessage('Assets loaded');
    })
  );

  // Search assets command
  context.subscriptions.push(
    vscode.commands.registerCommand('cx-dam.searchAssets', async () => {
      if (!client.isAuthenticated()) {
        vscode.window.showWarningMessage('Please authenticate first');
        vscode.commands.executeCommand('cx-dam.authenticate');
        return;
      }

      SearchPanel.createOrShow(context.extensionUri, assetTreeProvider, workspaces);
    })
  );

  // Refresh assets command
  context.subscriptions.push(
    vscode.commands.registerCommand('cx-dam.refreshAssets', async () => {
      if (!client.isAuthenticated()) {
        vscode.window.showWarningMessage('Please authenticate first');
        return;
      }

      await assetTreeProvider.loadAssets();
      vscode.window.showInformationMessage('Assets refreshed');
    })
  );

  // Upload asset command
  context.subscriptions.push(
    vscode.commands.registerCommand('cx-dam.uploadAsset', async () => {
      if (!client.isAuthenticated()) {
        vscode.window.showWarningMessage('Please authenticate first');
        vscode.commands.executeCommand('cx-dam.authenticate');
        return;
      }

      // Get the token and construct authentication URL
      const token = await authManager.getToken();
      if (!token) {
        vscode.window.showWarningMessage('No authentication token found. Please authenticate again.');
        return;
      }

      // Get configuration
      const config = vscode.workspace.getConfiguration('cxDam');
      const apiUrl = config.get<string>('apiUrl') || 'http://localhost:3001/api';

      // Construct token-login URL that will set the cookie and redirect to upload page
      const tokenLoginUrl = `${apiUrl}/auth/token-login?token=${encodeURIComponent(token)}&redirect=/upload`;

      // Open in VS Code's simple browser
      try {
        await vscode.commands.executeCommand('simpleBrowser.show', tokenLoginUrl);
        vscode.window.showInformationMessage('Upload page opened in VS Code browser');
      } catch (error) {
        // Fallback to external browser if simple browser is not available
        vscode.env.openExternal(vscode.Uri.parse(tokenLoginUrl));
        vscode.window.showInformationMessage('Upload page opened in external browser');
      }
    })
  );

  // Open web app command
  context.subscriptions.push(
    vscode.commands.registerCommand('cx-dam.openWebApp', async () => {
      if (!client.isAuthenticated()) {
        vscode.window.showWarningMessage('Please authenticate first');
        vscode.commands.executeCommand('cx-dam.authenticate');
        return;
      }

      // Get the token and construct authentication URL
      const token = await authManager.getToken();
      if (!token) {
        vscode.window.showWarningMessage('No authentication token found. Please authenticate again.');
        return;
      }

      // Get configuration
      const config = vscode.workspace.getConfiguration('cxDam');
      const apiUrl = config.get<string>('apiUrl') || 'http://localhost:3001/api';

      // Construct token-login URL that will set the cookie and redirect to home page
      const tokenLoginUrl = `${apiUrl}/auth/token-login?token=${encodeURIComponent(token)}&redirect=/`;

      // Open in VS Code's simple browser
      try {
        await vscode.commands.executeCommand('simpleBrowser.show', tokenLoginUrl);
        vscode.window.showInformationMessage('CX DAM opened in VS Code browser');
      } catch (error) {
        // Fallback to external browser if simple browser is not available
        vscode.env.openExternal(vscode.Uri.parse(tokenLoginUrl));
        vscode.window.showInformationMessage('CX DAM opened in external browser');
      }
    })
  );

  // Open settings command
  context.subscriptions.push(
    vscode.commands.registerCommand('cx-dam.openSettings', () => {
      vscode.commands.executeCommand(
        'workbench.action.openSettings',
        'cxDam'
      );
    })
  );

  // Show welcome message if first time
  const hasShownWelcome = context.globalState.get('hasShownWelcome');
  if (!hasShownWelcome) {
    const action = await vscode.window.showInformationMessage(
      'Welcome to CX DAM! Authenticate to get started.',
      'Authenticate',
      'Later'
    );

    if (action === 'Authenticate') {
      vscode.commands.executeCommand('cx-dam.authenticate');
    }

    context.globalState.update('hasShownWelcome', true);
  }

  // Load assets if already authenticated
  if (client.isAuthenticated()) {
    await assetTreeProvider.loadAssets();
  }
}

export function deactivate() {
  if (authManager) {
    authManager.dispose();
  }
}

// Workspace Tree Provider
class WorkspaceTreeItem extends vscode.TreeItem {
  constructor(public readonly workspace: Workspace) {
    super(workspace.repoFullName, vscode.TreeItemCollapsibleState.None);
    this.tooltip = `${workspace.repoFullName} (${workspace.permission})`;
    this.description = workspace.permission;
    this.iconPath = new vscode.ThemeIcon('repo');
    this.contextValue = 'workspace';

    // Command to filter by workspace
    this.command = {
      command: 'cx-dam.filterByWorkspace',
      title: 'Filter by Workspace',
      arguments: [workspace.repoFullName],
    };
  }
}

class WorkspaceTreeProvider implements vscode.TreeDataProvider<WorkspaceTreeItem> {
  private _onDidChangeTreeData = new vscode.EventEmitter<
    WorkspaceTreeItem | undefined | null | void
  >();
  readonly onDidChangeTreeData = this._onDidChangeTreeData.event;

  constructor(private workspaces: Workspace[]) {}

  refresh(workspaces: Workspace[]): void {
    this.workspaces = workspaces;
    this._onDidChangeTreeData.fire();
  }

  getTreeItem(element: WorkspaceTreeItem): vscode.TreeItem {
    return element;
  }

  async getChildren(): Promise<WorkspaceTreeItem[]> {
    if (this.workspaces.length === 0) {
      return [];
    }

    return this.workspaces.map((ws) => new WorkspaceTreeItem(ws));
  }
}
