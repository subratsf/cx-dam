# CX DAM - VS Code Extension

> Browse, search, and insert digital assets from CX DAM directly in VS Code and Cursor.

![CX DAM Extension](https://img.shields.io/badge/VS%20Code-Extension-blue)
![Version](https://img.shields.io/badge/version-1.0.0-green)

## ✨ Features

### 🔐 GitHub Authentication
- Secure authentication via GitHub OAuth
- Persistent session management
- One-click logout

### 🗂️ Asset Browser
- Browse all your assets in a dedicated sidebar
- View assets by workspace
- See file types, sizes, and metadata at a glance
- AI-generated descriptions for better context

### 🔍 Advanced Search
- **Name Search**: Find assets by name or keywords
- **AI Semantic Search**: Use natural language queries like "professional portrait with blue background"
- Filter by workspace and file type
- View relevance scores for semantic search results

### ⚡ Quick Actions
- **Insert Asset**: Insert assets directly at cursor position
- **Copy URL**: Copy asset URLs to clipboard
- **Preview**: Preview images, videos, and PDFs in VS Code
- Multiple insert formats: Markdown, HTML, or plain URL

### 🤖 AI-Powered
- View AI-generated descriptions for images
- Semantic search with natural language
- Relevance scoring for better results

## 📦 Installation

### From VSIX File (Development)

1. Clone the repository:
   ```bash
   cd extensions/cx-dam-vscode
   npm install
   ```

2. Compile the extension:
   ```bash
   npm run compile
   ```

3. Package the extension:
   ```bash
   npm run package
   ```

4. Install in VS Code:
   - Open VS Code
   - Go to Extensions (Ctrl+Shift+X / Cmd+Shift+X)
   - Click the "..." menu → "Install from VSIX..."
   - Select the generated `.vsix` file

### From Marketplace (Coming Soon)

Search for "CX DAM" in the VS Code Extensions marketplace.

## 🚀 Getting Started

### 1. Configure API URL

Open VS Code settings and set your CX DAM API URL:

```json
{
  "cxDam.apiUrl": "http://localhost:3001/api"
}
```

Or use the settings UI:
- `Ctrl+,` / `Cmd+,` → Search for "CX DAM"
- Set the API URL

### 2. Authenticate

1. Click on the CX DAM icon in the Activity Bar (left sidebar)
2. Click "CX DAM: Authenticate" or use Command Palette (`Ctrl+Shift+P` / `Cmd+Shift+P`)
3. Follow the GitHub OAuth flow
4. Enter the authorization code when prompted

### 3. Browse Assets

- Assets will appear in the CX DAM sidebar
- Click on any asset to preview it
- Right-click for more options (Insert, Copy URL, etc.)

### 4. Search Assets

Click the search icon (🔍) in the CX DAM sidebar toolbar:
- **Name Search**: Search by asset name
- **Semantic Search**: Use natural language (e.g., "code screenshot with syntax highlighting")

### 5. Insert Assets

With a markdown file open:
1. Right-click an asset → "Insert Asset at Cursor"
2. Or click the insert icon (➕) on the asset
3. Choose your preferred format (Markdown, HTML, URL)

## 🎯 Commands

Access via Command Palette (`Ctrl+Shift+P` / `Cmd+Shift+P`):

| Command | Description |
|---------|-------------|
| `CX DAM: Authenticate` | Login with GitHub |
| `CX DAM: Logout` | Sign out |
| `CX DAM: Show Assets` | Load all assets |
| `CX DAM: Search Assets` | Open search panel |
| `CX DAM: Refresh Assets` | Reload asset list |
| `CX DAM: Upload Asset` | Upload new asset (coming soon) |
| `CX DAM: Open Settings` | Configure extension |

## ⚙️ Configuration

| Setting | Type | Default | Description |
|---------|------|---------|-------------|
| `cxDam.apiUrl` | string | `http://localhost:3001/api` | CX DAM API URL |
| `cxDam.autoInsertFormat` | string | `markdown-image` | Default insert format |
| `cxDam.showAIDescriptions` | boolean | `true` | Show AI descriptions |
| `cxDam.enableSemanticSearch` | boolean | `true` | Enable semantic search |

### Insert Formats

Choose how assets are inserted into your documents:

- **`markdown-image`**: `![name](workspace/name)` (SFDocs format)
- **`markdown-link`**: `[name](url)`
- **`html-img`**: `<img src="url" alt="name" />`
- **`url`**: `https://...`

## 📋 Usage Examples

### Insert an Image in Markdown

1. Open a markdown file
2. Place cursor where you want the image
3. In CX DAM sidebar, right-click an image → "Insert Asset"
4. Result: `![image.png](my-workspace/image.png)`

### Search for Assets with AI

1. Click the search icon in CX DAM sidebar
2. Select "AI Semantic Search"
3. Type: "professional headshot with neutral background"
4. Click "Search"
5. Results appear with relevance scores

### Copy Asset URL

1. Right-click any asset → "Copy Asset URL"
2. Paste anywhere: `Ctrl+V` / `Cmd+V`

## 🔧 Development

### Prerequisites

- Node.js 18+
- VS Code or Cursor
- CX DAM backend running

### Setup

```bash
cd extensions/cx-dam-vscode
npm install
```

### Build

```bash
npm run compile
```

### Watch Mode

```bash
npm run watch
```

### Debug

1. Open the extension folder in VS Code
2. Press `F5` to launch Extension Development Host
3. Test the extension in the new window

### Package

```bash
npm run package
```

This creates a `.vsix` file you can share or install.

## 🐛 Troubleshooting

### Authentication Issues

**Problem**: "Network error: Unable to reach CX DAM server"

**Solution**:
- Check that the backend is running
- Verify `cxDam.apiUrl` setting
- Ensure you have network access to the API

### Assets Not Loading

**Problem**: "Failed to load assets"

**Solution**:
- Run "CX DAM: Refresh Assets" command
- Check your authentication status
- Verify you have access to at least one workspace

### Semantic Search Not Working

**Problem**: Semantic search returns no results

**Solution**:
- Ensure the Python image analysis service is running
- Check backend configuration for `IMAGE_ANALYSIS_SERVICE_URL`
- Verify assets have been indexed with AI descriptions

### Preview Not Showing

**Problem**: Asset preview shows blank screen

**Solution**:
- Check asset URL in browser
- Ensure CloudFront/S3 access is configured
- Try right-clicking → "Copy Asset URL" and open in browser

## 📚 Resources

- [CX DAM Documentation](../../README.md)
- [VS Code Extension API](https://code.visualstudio.com/api)
- [GitHub Issues](https://github.com/your-org/cx-dam/issues)

## 🤝 Contributing

Contributions are welcome! Please:

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Submit a pull request

## 📄 License

MIT License - see [LICENSE](../../LICENSE) for details

## 🙏 Acknowledgments

- Built with VS Code Extension API
- Uses Axios for HTTP requests
- Inspired by modern asset management workflows

---

**Made with ❤️ for developers**
