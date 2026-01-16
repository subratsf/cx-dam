# Changelog

All notable changes to the CX DAM VS Code extension will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.0.0] - 2026-01-16

### Added
- 🎉 Initial release of CX DAM VS Code extension
- 🔐 GitHub OAuth authentication
- 🗂️ Asset browser sidebar with tree view
- 🔍 Asset search with name-based and AI semantic search
- 🤖 AI-generated descriptions display
- ⚡ Quick actions: Insert, Copy URL, Preview
- 📋 Multiple insert formats: Markdown, HTML, URL
- 🖼️ Asset preview panel for images, videos, and PDFs
- 🏢 Workspace filtering and management
- ⚙️ Configurable settings for API URL and insert format
- 📊 Relevance scoring for semantic search results
- 🔄 Asset refresh and reload functionality
- 💾 Persistent authentication with secure token storage
- 🎨 VS Code theme-aware UI

### Features in Detail

#### Authentication
- Secure GitHub OAuth flow
- Token stored in VS Code secrets storage
- Auto-restore session on startup
- One-click logout

#### Asset Management
- Browse all accessible assets
- View metadata: size, type, upload date
- AI descriptions for better context
- Stage/Prod state indicators
- Tag support

#### Search
- **Name Search**: Fast keyword search
- **Semantic Search**: Natural language queries
- Filter by workspace and file type
- Relevance scoring (50%+ threshold)
- Real-time results in sidebar

#### Insertion
- Insert at cursor position
- Formats:
  - `![name](workspace/name)` - SFDocs format
  - `[name](url)` - Markdown link
  - `<img src="url" />` - HTML
  - Raw URL
- Copy to clipboard option
- Quick insert from context menu

#### Preview
- In-editor preview panel
- Support for images, videos, PDFs
- Display metadata and AI descriptions
- Responsive design

### Known Limitations
- Upload feature not yet implemented (use web interface)
- No keyboard shortcuts (coming in v1.1.0)
- Requires backend API v1.0.0+

### Requirements
- VS Code 1.85.0 or higher
- CX DAM backend API running
- GitHub account for authentication

## [Unreleased]

### Planned for v1.1.0
- ⌨️ Keyboard shortcuts for common actions
- 📤 Direct asset upload from VS Code
- 🔔 Notifications for upload completion
- 📁 Drag-and-drop file upload
- 🎯 Recent assets quick access
- 🔖 Favorite assets
- 📝 Asset renaming and editing
- 🗑️ Asset deletion from VS Code
- 📊 Usage analytics (opt-in)

### Planned for v1.2.0
- 🔄 Auto-sync with backend
- 🌐 Multi-language support
- 🎨 Custom themes
- 📱 Mobile preview (via Live Share)
- 🔗 Deep linking to assets
- 📦 Bulk operations
- 🏷️ Tag management

### Future Considerations
- VS Code Web support
- Collaborative features
- Asset versioning view
- Integration with Git workflow
- Custom asset templates

---

## Version History

| Version | Release Date | Highlights |
|---------|--------------|------------|
| 1.0.0   | 2026-01-16   | Initial release with core features |

---

**Note**: This extension requires the CX DAM backend API. Make sure you have the backend running and configured properly.
