import * as vscode from 'vscode';
import { AssetTreeProvider } from './assetTreeProvider';
import { Workspace } from '../api/cxDamClient';

export class SearchPanel {
  public static currentPanel: SearchPanel | undefined;
  private readonly panel: vscode.WebviewPanel;
  private disposables: vscode.Disposable[] = [];

  private constructor(
    panel: vscode.WebviewPanel,
    private assetProvider: AssetTreeProvider,
    private workspaces: Workspace[]
  ) {
    this.panel = panel;

    this.panel.webview.html = this.getWebviewContent();

    this.panel.onDidDispose(() => this.dispose(), null, this.disposables);

    this.panel.webview.onDidReceiveMessage(
      async (message) => {
        switch (message.command) {
          case 'search':
            await this.handleSearch(message.params);
            break;
          case 'clear':
            await this.handleClear();
            break;
        }
      },
      null,
      this.disposables
    );
  }

  public static createOrShow(
    extensionUri: vscode.Uri,
    assetProvider: AssetTreeProvider,
    workspaces: Workspace[]
  ) {
    const column = vscode.window.activeTextEditor
      ? vscode.window.activeTextEditor.viewColumn
      : undefined;

    if (SearchPanel.currentPanel) {
      SearchPanel.currentPanel.panel.reveal(column);
      return;
    }

    const panel = vscode.window.createWebviewPanel(
      'cxDamSearch',
      'CX DAM: Search Assets',
      column || vscode.ViewColumn.One,
      {
        enableScripts: true,
        localResourceRoots: [vscode.Uri.joinPath(extensionUri, 'resources')],
        retainContextWhenHidden: true,
      }
    );

    SearchPanel.currentPanel = new SearchPanel(panel, assetProvider, workspaces);
  }

  private async handleSearch(params: {
    query: string;
    workspace: string;
    fileType: string;
    semantic: boolean;
  }) {
    try {
      this.panel.webview.postMessage({ command: 'searching' });

      await this.assetProvider.loadAssets({
        q: params.query || undefined,
        workspace: params.workspace || undefined,
        fileType: params.fileType || undefined,
        semantic: params.semantic,
      });

      const results = this.assetProvider.getAssets();

      this.panel.webview.postMessage({
        command: 'results',
        count: results.length,
      });

      vscode.window.showInformationMessage(`Found ${results.length} assets`);
    } catch (error) {
      this.panel.webview.postMessage({
        command: 'error',
        error: error instanceof Error ? error.message : 'Search failed',
      });
    }
  }

  private async handleClear() {
    await this.assetProvider.loadAssets({});
    this.panel.webview.postMessage({ command: 'cleared' });
  }

  private getWebviewContent(): string {
    const workspaceOptions = this.workspaces
      .map((ws) => `<option value="${ws.repoFullName}">${ws.repoFullName}</option>`)
      .join('');

    return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Search CX DAM Assets</title>
    <style>
        * {
            box-sizing: border-box;
            margin: 0;
            padding: 0;
        }
        body {
            font-family: var(--vscode-font-family);
            padding: 20px;
            color: var(--vscode-foreground);
            background-color: var(--vscode-editor-background);
        }
        .search-container {
            max-width: 800px;
            margin: 0 auto;
        }
        h1 {
            margin-bottom: 20px;
            font-size: 24px;
        }
        .form-group {
            margin-bottom: 15px;
        }
        label {
            display: block;
            margin-bottom: 5px;
            font-weight: 500;
            font-size: 13px;
        }
        input, select {
            width: 100%;
            padding: 8px;
            background-color: var(--vscode-input-background);
            color: var(--vscode-input-foreground);
            border: 1px solid var(--vscode-input-border);
            font-family: var(--vscode-font-family);
            font-size: 13px;
        }
        input:focus, select:focus {
            outline: 1px solid var(--vscode-focusBorder);
        }
        .search-mode {
            display: flex;
            gap: 20px;
            margin-bottom: 15px;
        }
        .radio-group {
            display: flex;
            align-items: center;
            gap: 5px;
        }
        .radio-group input[type="radio"] {
            width: auto;
        }
        .button-group {
            display: flex;
            gap: 10px;
            margin-top: 20px;
        }
        button {
            padding: 10px 20px;
            background-color: var(--vscode-button-background);
            color: var(--vscode-button-foreground);
            border: none;
            cursor: pointer;
            font-size: 13px;
            font-family: var(--vscode-font-family);
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
            padding: 10px;
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
        .status.success {
            background-color: var(--vscode-testing-iconPassed);
            color: var(--vscode-button-foreground);
        }
        .help-text {
            font-size: 12px;
            color: var(--vscode-descriptionForeground);
            margin-top: 5px;
        }
        .spinner {
            display: inline-block;
            width: 16px;
            height: 16px;
            border: 2px solid var(--vscode-button-foreground);
            border-top-color: transparent;
            border-radius: 50%;
            animation: spin 1s linear infinite;
            vertical-align: middle;
            margin-right: 5px;
        }
        @keyframes spin {
            to { transform: rotate(360deg); }
        }
    </style>
</head>
<body>
    <div class="search-container">
        <h1>🔍 Search CX DAM Assets</h1>

        <div class="search-mode">
            <div class="radio-group">
                <input type="radio" id="nameSearch" name="searchMode" value="name" checked>
                <label for="nameSearch">Name Search</label>
            </div>
            <div class="radio-group">
                <input type="radio" id="semanticSearch" name="searchMode" value="semantic">
                <label for="semanticSearch">🤖 AI Semantic Search</label>
            </div>
        </div>

        <form id="searchForm">
            <div class="form-group">
                <label for="query">Search Query</label>
                <input
                    type="text"
                    id="query"
                    placeholder="Enter search query..."
                    autofocus
                >
                <div class="help-text" id="helpText">
                    Search by asset name or keywords
                </div>
            </div>

            <div class="form-group">
                <label for="workspace">Workspace (Optional)</label>
                <select id="workspace">
                    <option value="">All Workspaces</option>
                    ${workspaceOptions}
                </select>
            </div>

            <div class="form-group">
                <label for="fileType">File Type (Optional)</label>
                <select id="fileType">
                    <option value="">All Types</option>
                    <option value="image/png">PNG</option>
                    <option value="image/jpeg">JPEG</option>
                    <option value="image/gif">GIF</option>
                    <option value="image/svg+xml">SVG</option>
                    <option value="video/mp4">MP4</option>
                    <option value="application/pdf">PDF</option>
                </select>
            </div>

            <div class="button-group">
                <button type="submit" id="searchButton">Search</button>
                <button type="button" class="secondary-button" onclick="clearSearch()">
                    Clear Filters
                </button>
            </div>
        </form>

        <div id="status" class="status"></div>
    </div>

    <script>
        const vscode = acquireVsCodeApi();
        const form = document.getElementById('searchForm');
        const searchButton = document.getElementById('searchButton');
        const nameSearchRadio = document.getElementById('nameSearch');
        const semanticSearchRadio = document.getElementById('semanticSearch');
        const helpText = document.getElementById('helpText');

        // Update help text based on search mode
        nameSearchRadio.addEventListener('change', updateHelpText);
        semanticSearchRadio.addEventListener('change', updateHelpText);

        function updateHelpText() {
            if (semanticSearchRadio.checked) {
                helpText.textContent = 'Use natural language (e.g., "professional portrait with blue background")';
            } else {
                helpText.textContent = 'Search by asset name or keywords';
            }
        }

        form.addEventListener('submit', (e) => {
            e.preventDefault();
            performSearch();
        });

        function performSearch() {
            const query = document.getElementById('query').value.trim();
            const workspace = document.getElementById('workspace').value;
            const fileType = document.getElementById('fileType').value;
            const semantic = semanticSearchRadio.checked;

            if (semantic && !query) {
                showStatus('Please enter a search query for semantic search', 'error');
                return;
            }

            vscode.postMessage({
                command: 'search',
                params: { query, workspace, fileType, semantic }
            });
        }

        function clearSearch() {
            document.getElementById('query').value = '';
            document.getElementById('workspace').value = '';
            document.getElementById('fileType').value = '';
            nameSearchRadio.checked = true;
            updateHelpText();

            vscode.postMessage({ command: 'clear' });
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

            switch (message.command) {
                case 'searching':
                    searchButton.disabled = true;
                    searchButton.innerHTML = '<span class="spinner"></span>Searching...';
                    hideStatus();
                    break;
                case 'results':
                    searchButton.disabled = false;
                    searchButton.textContent = 'Search';
                    showStatus(\`Found \${message.count} assets. Check the CX DAM sidebar.\`, 'success');
                    setTimeout(hideStatus, 3000);
                    break;
                case 'error':
                    searchButton.disabled = false;
                    searchButton.textContent = 'Search';
                    showStatus('Error: ' + message.error, 'error');
                    break;
                case 'cleared':
                    showStatus('Filters cleared', 'info');
                    setTimeout(hideStatus, 2000);
                    break;
            }
        });
    </script>
</body>
</html>`;
  }

  public dispose() {
    SearchPanel.currentPanel = undefined;

    this.panel.dispose();

    while (this.disposables.length) {
      const disposable = this.disposables.pop();
      if (disposable) {
        disposable.dispose();
      }
    }
  }
}
