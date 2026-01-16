import * as vscode from 'vscode';

const TOKEN_KEY = 'cxDam.authToken';
const USER_KEY = 'cxDam.user';

export interface User {
  id: string;
  email: string;
  githubId: string;
  githubUsername: string;
}

export class AuthManager {
  private context: vscode.ExtensionContext;
  private _onDidChangeAuth = new vscode.EventEmitter<boolean>();
  public readonly onDidChangeAuth = this._onDidChangeAuth.event;

  constructor(context: vscode.ExtensionContext) {
    this.context = context;
  }

  async saveToken(token: string): Promise<void> {
    await this.context.secrets.store(TOKEN_KEY, token);
    this._onDidChangeAuth.fire(true);
  }

  async getToken(): Promise<string | undefined> {
    return await this.context.secrets.get(TOKEN_KEY);
  }

  async clearToken(): Promise<void> {
    await this.context.secrets.delete(TOKEN_KEY);
    await this.context.globalState.update(USER_KEY, undefined);
    this._onDidChangeAuth.fire(false);
  }

  async saveUser(user: User): Promise<void> {
    await this.context.globalState.update(USER_KEY, user);
  }

  getUser(): User | undefined {
    return this.context.globalState.get<User>(USER_KEY);
  }

  async isAuthenticated(): Promise<boolean> {
    const token = await this.getToken();
    return token !== undefined;
  }

  dispose() {
    this._onDidChangeAuth.dispose();
  }
}
