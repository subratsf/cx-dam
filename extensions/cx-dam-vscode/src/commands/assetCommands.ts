import * as vscode from 'vscode';
import { Asset } from '../api/cxDamClient';

export function registerAssetCommands(context: vscode.ExtensionContext) {
  context.subscriptions.push(
    vscode.commands.registerCommand('cx-dam.insertAsset', async (asset: Asset) => {
      await insertAssetIntoEditor(asset);
    })
  );

  context.subscriptions.push(
    vscode.commands.registerCommand('cx-dam.copyAssetUrl', async (asset: Asset) => {
      await copyAssetUrl(asset);
    })
  );

  context.subscriptions.push(
    vscode.commands.registerCommand('cx-dam.previewAsset', async (asset: Asset) => {
      await previewAsset(asset, context.extensionUri);
    })
  );
}

async function insertAssetIntoEditor(asset: Asset) {
  const editor = vscode.window.activeTextEditor;
  if (!editor) {
    vscode.window.showWarningMessage('No active editor found');
    return;
  }

  // Get user preference for insert format
  const config = vscode.workspace.getConfiguration('cxDam');
  const format =
    config.get<string>('autoInsertFormat') || (await promptForFormat());

  if (!format) {
    return; // User cancelled
  }

  const text = formatAsset(asset, format);

  // Insert at cursor position
  const success = await editor.edit((editBuilder) => {
    editBuilder.insert(editor.selection.active, text);
  });

  if (success) {
    vscode.window.showInformationMessage(`Inserted ${asset.name}`);
  } else {
    vscode.window.showErrorMessage('Failed to insert asset');
  }
}

async function promptForFormat(): Promise<string | undefined> {
  const items = [
    {
      label: 'Markdown Image',
      description: '![alt](url)',
      format: 'markdown-image',
    },
    {
      label: 'Markdown Link',
      description: '[text](url)',
      format: 'markdown-link',
    },
    {
      label: 'HTML Image',
      description: '<img src="url" alt="alt">',
      format: 'html-img',
    },
    {
      label: 'URL Only',
      description: 'https://...',
      format: 'url',
    },
  ];

  const selected = await vscode.window.showQuickPick(items, {
    placeHolder: 'Select insert format',
  });

  return selected?.format;
}

function formatAsset(asset: Asset, format: string): string {
  const url = asset.downloadUrl || '';
  const name = asset.name;
  const workspace = asset.workspace;

  switch (format) {
    case 'markdown-image':
      // SFDocs format: ![name](workspace/name)
      return `![${name}](${workspace}/${name})`;

    case 'markdown-link':
      return `[${name}](${url})`;

    case 'html-img':
      return `<img src="${url}" alt="${name}" />`;

    case 'url':
    default:
      return url;
  }
}

async function copyAssetUrl(asset: Asset) {
  const config = vscode.workspace.getConfiguration('cxDam');
  const format = config.get<string>('autoInsertFormat') || 'url';

  const text = formatAsset(asset, format);

  await vscode.env.clipboard.writeText(text);
  vscode.window.showInformationMessage(`Copied ${asset.name} to clipboard`);
}

async function previewAsset(asset: Asset, extensionUri: vscode.Uri) {
  const panel = vscode.window.createWebviewPanel(
    'cxDamAssetPreview',
    `Preview: ${asset.name}`,
    vscode.ViewColumn.Beside,
    {
      enableScripts: true,
      localResourceRoots: [extensionUri],
    }
  );

  panel.webview.html = getPreviewHtml(asset);
}

function getPreviewHtml(asset: Asset): string {
  const fileType = asset.fileType.toLowerCase();
  let content = '';

  if (fileType.startsWith('image/')) {
    content = `<img src="${asset.downloadUrl}" alt="${asset.name}" style="max-width: 100%; height: auto;" />`;
  } else if (fileType.startsWith('video/')) {
    content = `
      <video controls style="max-width: 100%; height: auto;">
        <source src="${asset.downloadUrl}" type="${asset.fileType}">
        Your browser does not support the video tag.
      </video>
    `;
  } else if (fileType === 'application/pdf') {
    content = `<iframe src="${asset.downloadUrl}" style="width: 100%; height: 100vh; border: none;"></iframe>`;
  } else {
    content = `
      <div style="padding: 20px; text-align: center;">
        <p>Preview not available for this file type.</p>
        <a href="${asset.downloadUrl}" target="_blank">Open in browser</a>
      </div>
    `;
  }

  const aiDescription = asset.aiDescription
    ? `
    <div style="margin-bottom: 20px; padding: 15px; background-color: var(--vscode-editor-background); border: 1px solid var(--vscode-panel-border);">
      <div style="display: flex; align-items: center; margin-bottom: 10px;">
        <span style="font-size: 20px; margin-right: 8px;">🤖</span>
        <strong>AI Description</strong>
      </div>
      <p style="margin: 0; line-height: 1.6;">${asset.aiDescription}</p>
    </div>
  `
    : '';

  return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${asset.name}</title>
    <style>
        body {
            font-family: var(--vscode-font-family);
            padding: 20px;
            color: var(--vscode-foreground);
            background-color: var(--vscode-editor-background);
            margin: 0;
        }
        .container {
            max-width: 1200px;
            margin: 0 auto;
        }
        h1 {
            margin-bottom: 10px;
            font-size: 24px;
        }
        .metadata {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
            gap: 15px;
            margin-bottom: 20px;
            padding: 15px;
            background-color: var(--vscode-editor-background);
            border: 1px solid var(--vscode-panel-border);
        }
        .metadata-item {
            display: flex;
            flex-direction: column;
        }
        .metadata-label {
            font-size: 11px;
            text-transform: uppercase;
            color: var(--vscode-descriptionForeground);
            margin-bottom: 5px;
        }
        .metadata-value {
            font-size: 14px;
        }
        .tags {
            display: flex;
            flex-wrap: wrap;
            gap: 5px;
        }
        .tag {
            padding: 3px 8px;
            background-color: var(--vscode-badge-background);
            color: var(--vscode-badge-foreground);
            border-radius: 3px;
            font-size: 12px;
        }
        .badge {
            display: inline-block;
            padding: 4px 8px;
            border-radius: 3px;
            font-size: 12px;
            font-weight: 600;
        }
        .badge.stage {
            background-color: #fbbf24;
            color: #78350f;
        }
        .badge.prod {
            background-color: #34d399;
            color: #064e3b;
        }
        .preview {
            margin-top: 20px;
            text-align: center;
        }
    </style>
</head>
<body>
    <div class="container">
        <h1>${asset.name}</h1>

        ${aiDescription}

        <div class="metadata">
            <div class="metadata-item">
                <div class="metadata-label">Workspace</div>
                <div class="metadata-value">${asset.workspace}</div>
            </div>
            <div class="metadata-item">
                <div class="metadata-label">File Type</div>
                <div class="metadata-value">${asset.fileType}</div>
            </div>
            <div class="metadata-item">
                <div class="metadata-label">File Size</div>
                <div class="metadata-value">${formatFileSize(asset.fileSize)}</div>
            </div>
            <div class="metadata-item">
                <div class="metadata-label">State</div>
                <div class="metadata-value">
                    <span class="badge ${asset.state.toLowerCase()}">${asset.state}</span>
                </div>
            </div>
            <div class="metadata-item">
                <div class="metadata-label">Uploaded</div>
                <div class="metadata-value">${new Date(asset.uploadedAt).toLocaleDateString()}</div>
            </div>
            ${
              asset.tags && asset.tags.length > 0
                ? `
            <div class="metadata-item">
                <div class="metadata-label">Tags</div>
                <div class="tags">
                    ${asset.tags.map((tag) => `<span class="tag">${tag}</span>`).join('')}
                </div>
            </div>
            `
                : ''
            }
        </div>

        <div class="preview">
            ${content}
        </div>
    </div>

    <script>
        function formatFileSize(bytes) {
            if (bytes < 1024) return bytes + ' B';
            if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
            return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
        }
    </script>
</body>
</html>`;
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) {
    return `${bytes} B`;
  } else if (bytes < 1024 * 1024) {
    return `${(bytes / 1024).toFixed(1)} KB`;
  } else {
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  }
}
