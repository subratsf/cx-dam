# ⚡ Quick Start Guide

Get the CX DAM extension running in 5 minutes.

## For Users

### 1. Install the Extension

**Option A: From VSIX (Development)**
1. Download the `.vsix` file
2. Open VS Code
3. Press `Ctrl+Shift+P` / `Cmd+Shift+P`
4. Type "Install from VSIX" and select the file

**Option B: From Marketplace (Coming Soon)**
- Search for "CX DAM" in Extensions

### 2. Configure

Open Settings (`Ctrl+,` / `Cmd+,`) and search for "CX DAM":

```json
{
  "cxDam.apiUrl": "http://localhost:3001/api"
}
```

Or for production:
```json
{
  "cxDam.apiUrl": "https://your-api.herokuapp.com/api"
}
```

### 3. Authenticate

1. Click the CX DAM icon in the left sidebar
2. Click "Authenticate with GitHub"
3. Follow the browser flow
4. Enter the code in VS Code

### 4. Start Using

- Browse assets in the sidebar
- Click search icon to find assets
- Right-click assets to insert or preview
- Use semantic search for natural language queries

## For Developers

### Setup

```bash
# Clone and navigate
cd extensions/cx-dam-vscode

# Install dependencies
npm install

# Compile
npm run compile
```

### Run in Development

1. Open this folder in VS Code
2. Press `F5` to launch Extension Development Host
3. Test the extension in the new window

### Make Changes

```bash
# Watch for changes
npm run watch

# In another terminal, press F5 in VS Code
```

### Package for Distribution

```bash
# Create VSIX file
npm run package

# Output: cx-dam-1.0.0.vsix
```

### Publish to Marketplace (Maintainers Only)

```bash
# Login to publisher account
vsce login your-publisher-name

# Publish
vsce publish
```

## Common Tasks

### Insert an Image

1. Open a markdown file
2. Place cursor where you want the image
3. In CX DAM sidebar, right-click an image
4. Select "Insert Asset at Cursor"
5. Choose format (default: Markdown)

### Search with AI

1. Click search icon (🔍) in CX DAM toolbar
2. Select "AI Semantic Search"
3. Type natural language query: "code screenshot with Python"
4. Click "Search"
5. View results with relevance scores

### Change Insert Format

**Via Settings:**
```json
{
  "cxDam.autoInsertFormat": "markdown-image"  // or "markdown-link", "html-img", "url"
}
```

**Or choose each time:**
- When inserting, you'll be prompted for format if not set

## Keyboard Shortcuts (Coming Soon)

These shortcuts will be added in a future version:

- `Ctrl+Shift+A` / `Cmd+Shift+A` - Search assets
- `Ctrl+Shift+I` / `Cmd+Shift+I` - Insert last selected asset
- `Ctrl+Shift+R` / `Cmd+Shift+R` - Refresh assets

## Troubleshooting

### Extension Not Loading

**Check the Output panel:**
1. `View` → `Output`
2. Select "Extension Host" from dropdown
3. Look for CX DAM logs

### Authentication Failed

**Clear stored credentials:**
1. Press `Ctrl+Shift+P` / `Cmd+Shift+P`
2. Type "Developer: Reload Window"
3. Try authenticating again

### Assets Not Showing

**Refresh the extension:**
1. Click refresh icon in CX DAM toolbar
2. Or run command: "CX DAM: Refresh Assets"

## Tips & Tricks

### 1. Quick Asset Search
Use the search panel (`Ctrl+Shift+P` → "CX DAM: Search Assets") for faster access.

### 2. Filter by Workspace
Click on a workspace in the "Workspaces" section to filter assets.

### 3. Preview Before Inserting
Click on an asset to preview it before inserting into your document.

### 4. Copy Multiple Formats
Change the `autoInsertFormat` setting to switch between Markdown, HTML, or URL formats.

### 5. Use Semantic Search for Discovery
Can't remember the exact name? Use semantic search with descriptions:
- "sunset photo with mountains"
- "diagram showing architecture"
- "screenshot of dashboard"

## Next Steps

- ✅ Authenticate with GitHub
- ✅ Browse your assets
- ✅ Try semantic search
- ✅ Insert an asset into a document
- 📚 Read the [full documentation](./README.md)

---

**Need help?** Open an issue on GitHub or check the troubleshooting section in the README.
