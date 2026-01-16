import * as vscode from 'vscode';
import { CxDamClient, Asset } from '../api/cxDamClient';
import * as path from 'path';

export class AssetTreeItem extends vscode.TreeItem {
  constructor(
    public readonly asset: Asset,
    public readonly collapsibleState: vscode.TreeItemCollapsibleState
  ) {
    super(asset.name, collapsibleState);

    this.tooltip = this.getTooltip();
    this.description = this.getDescription();
    this.contextValue = 'asset';
    this.iconPath = this.getIcon();

    // Command to preview asset on click
    this.command = {
      command: 'cx-dam.previewAsset',
      title: 'Preview Asset',
      arguments: [this.asset],
    };
  }

  private getTooltip(): string {
    const lines = [
      `Name: ${this.asset.name}`,
      `Workspace: ${this.asset.workspace}`,
      `Type: ${this.asset.fileType}`,
      `Size: ${this.formatFileSize(this.asset.fileSize)}`,
      `State: ${this.asset.state}`,
      `Uploaded: ${new Date(this.asset.uploadedAt).toLocaleDateString()}`,
    ];

    if (this.asset.aiDescription) {
      lines.push('', `AI Description: ${this.asset.aiDescription}`);
    }

    if (this.asset.tags && this.asset.tags.length > 0) {
      lines.push('', `Tags: ${this.asset.tags.join(', ')}`);
    }

    return lines.join('\n');
  }

  private getDescription(): string {
    const parts: string[] = [];

    if (this.asset.state === 'Stage') {
      parts.push('🔧');
    }

    parts.push(this.asset.workspace);

    if (this.asset.searchScore !== undefined) {
      parts.push(`${Math.round(this.asset.searchScore * 100)}%`);
    }

    return parts.join(' • ');
  }

  private getIcon(): vscode.ThemeIcon {
    const fileType = this.asset.fileType.toLowerCase();

    if (fileType.startsWith('image/')) {
      return new vscode.ThemeIcon('file-media');
    } else if (fileType.startsWith('video/')) {
      return new vscode.ThemeIcon('device-camera-video');
    } else if (fileType === 'application/pdf') {
      return new vscode.ThemeIcon('file-pdf');
    } else if (fileType.startsWith('text/')) {
      return new vscode.ThemeIcon('file-code');
    } else {
      return new vscode.ThemeIcon('file');
    }
  }

  private formatFileSize(bytes: number): string {
    if (bytes < 1024) {
      return `${bytes} B`;
    } else if (bytes < 1024 * 1024) {
      return `${(bytes / 1024).toFixed(1)} KB`;
    } else {
      return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
    }
  }
}

export class AssetTreeProvider implements vscode.TreeDataProvider<AssetTreeItem> {
  private _onDidChangeTreeData = new vscode.EventEmitter<
    AssetTreeItem | undefined | null | void
  >();
  readonly onDidChangeTreeData = this._onDidChangeTreeData.event;

  private assets: Asset[] = [];
  private isLoading = false;

  constructor(private client: CxDamClient) {}

  refresh(): void {
    this._onDidChangeTreeData.fire();
  }

  async loadAssets(searchParams?: {
    q?: string;
    workspace?: string;
    fileType?: string;
    semantic?: boolean;
  }): Promise<void> {
    if (this.isLoading) {
      return;
    }

    this.isLoading = true;

    try {
      let response;

      if (searchParams?.semantic && searchParams.q) {
        response = await this.client.semanticSearch(searchParams.q);
      } else {
        response = await this.client.searchAssets({
          q: searchParams?.q,
          workspace: searchParams?.workspace,
          fileType: searchParams?.fileType,
          limit: 50,
        });
      }

      this.assets = response.data.data;
      this.refresh();
    } catch (error) {
      vscode.window.showErrorMessage(
        `Failed to load assets: ${this.client.handleError(error)}`
      );
      this.assets = [];
    } finally {
      this.isLoading = false;
    }
  }

  getTreeItem(element: AssetTreeItem): vscode.TreeItem {
    return element;
  }

  async getChildren(element?: AssetTreeItem): Promise<AssetTreeItem[]> {
    if (element) {
      return [];
    }

    if (!this.client.isAuthenticated()) {
      return [this.createInfoItem('Please authenticate with CX DAM', 'sign-in')];
    }

    if (this.isLoading) {
      return [this.createInfoItem('Loading assets...', 'loading~spin')];
    }

    if (this.assets.length === 0) {
      return [this.createInfoItem('No assets found. Try searching or uploading.', 'info')];
    }

    return this.assets.map(
      (asset) => new AssetTreeItem(asset, vscode.TreeItemCollapsibleState.None)
    );
  }

  private createInfoItem(message: string, icon: string): AssetTreeItem {
    const item = new AssetTreeItem(
      {
        id: 'info',
        name: message,
        workspace: '',
        s3Key: '',
        fileType: '',
        fileSize: 0,
        state: 'Prod',
        uploadedBy: '',
        uploadedAt: new Date().toISOString(),
        tags: [],
      },
      vscode.TreeItemCollapsibleState.None
    );
    item.iconPath = new vscode.ThemeIcon(icon);
    item.contextValue = 'info';
    item.command = undefined;
    return item;
  }

  getAssets(): Asset[] {
    return this.assets;
  }
}
