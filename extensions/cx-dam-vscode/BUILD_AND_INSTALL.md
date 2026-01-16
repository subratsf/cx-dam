# 🔨 Build and Install Guide

Complete guide to building, testing, and installing the CX DAM VS Code extension.

## Prerequisites

- **Node.js**: v18.0.0 or higher
- **npm**: v9.0.0 or higher
- **VS Code**: v1.85.0 or higher
- **CX DAM Backend**: Running locally or deployed

## Quick Build

```bash
cd extensions/cx-dam-vscode
npm install
npm run compile
```

## Development Workflow

### 1. Install Dependencies

```bash
npm install
```

This installs:
- TypeScript compiler
- VS Code extension types
- Axios for HTTP requests
- ESLint for code quality
- VSCE for packaging

### 2. Compile TypeScript

```bash
# One-time compile
npm run compile

# Watch mode (auto-recompile on changes)
npm run watch
```

Output goes to `out/` directory.

### 3. Run in Debug Mode

**Method A: Using VS Code**
1. Open the `extensions/cx-dam-vscode` folder in VS Code
2. Press `F5` or go to Run → Start Debugging
3. A new "Extension Development Host" window opens
4. Test the extension in this window

**Method B: Using Command Line**
```bash
code --extensionDevelopmentPath=$(pwd)
```

### 4. Test Changes

Make changes to source files in `src/`:
- If using watch mode (`npm run watch`), changes auto-compile
- Reload the Extension Development Host: `Ctrl+R` / `Cmd+R`
- Or restart debugging: `F5`

### 5. View Logs

**In Extension Development Host:**
1. `View` → `Output`
2. Select "Extension Host" from dropdown
3. See console logs and errors

**In Main VS Code:**
1. `Help` → `Toggle Developer Tools`
2. Go to Console tab

## Package Extension

Create a `.vsix` file for distribution:

```bash
npm run package
```

Output: `cx-dam-1.0.0.vsix`

### Custom Version

```bash
# Update version in package.json first
npm version patch  # 1.0.0 → 1.0.1
npm version minor  # 1.0.1 → 1.1.0
npm version major  # 1.1.0 → 2.0.0

# Then package
npm run package
```

## Install Locally

### Option 1: Via VS Code UI

1. Open VS Code
2. Go to Extensions (`Ctrl+Shift+X` / `Cmd+Shift+X`)
3. Click `...` menu → `Install from VSIX...`
4. Select `cx-dam-1.0.0.vsix`
5. Reload VS Code

### Option 2: Via Command Line

```bash
code --install-extension cx-dam-1.0.0.vsix
```

### Option 3: Manual Copy

**macOS/Linux:**
```bash
cp cx-dam-1.0.0.vsix ~/.vscode/extensions/
cd ~/.vscode/extensions/
unzip -o cx-dam-1.0.0.vsix
```

**Windows:**
```powershell
Copy-Item cx-dam-1.0.0.vsix $env:USERPROFILE\.vscode\extensions\
cd $env:USERPROFILE\.vscode\extensions
Expand-Archive -Force cx-dam-1.0.0.vsix
```

## Publish to Marketplace

### Prerequisites

1. Create a publisher account at https://marketplace.visualstudio.com/manage
2. Get a Personal Access Token (PAT) from Azure DevOps
3. Install VSCE globally (already in package.json)

### Steps

```bash
# Login (first time only)
npx vsce login your-publisher-name

# Publish
npx vsce publish

# Or publish specific version
npx vsce publish minor
npx vsce publish 1.2.0
```

### Automated Publishing (CI/CD)

Add to GitHub Actions:

```yaml
- name: Publish to VS Code Marketplace
  run: |
    npm install
    npm run compile
    npx vsce publish -p ${{ secrets.VSCE_PAT }}
```

## Testing

### Manual Testing Checklist

- [ ] Extension loads without errors
- [ ] Authentication flow works
- [ ] Assets display in sidebar
- [ ] Search functionality works
- [ ] Semantic search returns results
- [ ] Asset preview opens correctly
- [ ] Insert asset command works
- [ ] Copy URL command works
- [ ] Settings are respected
- [ ] Logout works properly

### Automated Tests (Future)

```bash
npm run test
```

## Troubleshooting

### Compilation Errors

**Error**: `Cannot find module 'vscode'`

**Fix**:
```bash
npm install
```

### Extension Won't Load

**Error**: "Extension activation failed"

**Fix**:
1. Check `out/extension.js` exists
2. Run `npm run compile`
3. Check for TypeScript errors

### Changes Not Reflecting

**Issue**: Made changes but extension still shows old behavior

**Fix**:
1. Stop debugging
2. Run `npm run compile`
3. Restart debugging (`F5`)

### Package Creation Fails

**Error**: `vsce command not found`

**Fix**:
```bash
npm install
# VSCE is in devDependencies
```

## File Structure

```
extensions/cx-dam-vscode/
├── src/                    # Source files (TypeScript)
│   ├── extension.ts       # Main entry point
│   ├── api/               # API client
│   ├── commands/          # Command handlers
│   ├── views/             # Webview panels
│   └── utils/             # Utilities
├── out/                   # Compiled JavaScript (generated)
├── resources/             # Icons and assets
│   └── icons/
├── .vscode/               # VS Code config
│   ├── launch.json       # Debug configuration
│   └── tasks.json        # Build tasks
├── package.json           # Extension manifest
├── tsconfig.json          # TypeScript config
├── .eslintrc.json        # ESLint config
├── .vscodeignore         # Files to exclude from package
└── README.md              # Documentation
```

## Build Optimization

### Reduce Bundle Size

1. **Tree-shaking**: Remove unused code
2. **Webpack**: Bundle with webpack (future enhancement)
3. **Minification**: Minify JavaScript

### Example webpack.config.js (Future)

```javascript
module.exports = {
  target: 'node',
  entry: './src/extension.ts',
  output: {
    path: path.resolve(__dirname, 'dist'),
    filename: 'extension.js',
    libraryTarget: 'commonjs2'
  },
  externals: {
    vscode: 'commonjs vscode'
  },
  resolve: {
    extensions: ['.ts', '.js']
  },
  module: {
    rules: [
      {
        test: /\.ts$/,
        use: 'ts-loader',
        exclude: /node_modules/
      }
    ]
  }
};
```

## Version Management

### Semantic Versioning

- **Patch** (1.0.x): Bug fixes
- **Minor** (1.x.0): New features, backward compatible
- **Major** (x.0.0): Breaking changes

### Update Version

```bash
# In package.json, update "version": "1.0.0"

# Or use npm
npm version patch  # Bug fixes
npm version minor  # New features
npm version major  # Breaking changes
```

## Distribution

### Share VSIX File

1. Build: `npm run package`
2. Share `cx-dam-1.0.0.vsix` file
3. Users install via: Extensions → Install from VSIX

### Internal Marketplace

For enterprise: Host on internal VS Code marketplace

### GitHub Releases

Attach `.vsix` file to GitHub releases:

```bash
gh release create v1.0.0 cx-dam-1.0.0.vsix
```

## Performance Tips

1. **Lazy Loading**: Load heavy resources only when needed
2. **Caching**: Cache API responses
3. **Debouncing**: Debounce search input
4. **Virtual Scrolling**: For large asset lists (future)

## Next Steps

After building:

1. ✅ Test locally in Extension Development Host
2. ✅ Package as VSIX
3. ✅ Install and test in regular VS Code
4. ✅ Share with team
5. ✅ Publish to marketplace (optional)

---

**Need help?** Check the [README](./README.md) or [QUICK_START](./QUICK_START.md) guides.
