# CueMe Release Guide

This guide explains how to build, package, and distribute the CueMe Electron application.

## 🏗️ Build & Release Process

### Prerequisites

1. **Node.js 18+** installed
2. **Git** configured with GitHub access
3. **GitHub repository** set up with proper permissions
4. **GitHub token** with repo access (for automated releases)

### Quick Release

```bash
# 1. Prepare and create release
./scripts/prepare-release.sh v1.0.0

# 2. Monitor GitHub Actions
# Visit: https://github.com/itsukison/CueMe2/actions
```

### Manual Build Process

```bash
# Install dependencies
npm install

# Build for development
npm run app:dev

# Build for production (current platform)
npm run app:build

# Build for all platforms
npm run app:build:all

# Build for specific platforms
npm run app:build:mac
npm run app:build:win
npm run app:build:linux
```

## 📦 Distribution Strategy

### 1. GitHub Releases (Recommended)

**Pros:**
- ✅ Free hosting
- ✅ Version management
- ✅ Download analytics
- ✅ Automatic updates support
- ✅ Release notes

**Setup:**
- Already configured in `package.json`
- GitHub Actions workflow in `.github/workflows/release.yml`
- Automatic builds on tag push

### 2. Alternative Distribution Methods

#### Direct Website Hosting
```bash
# Upload to your own server
scp release/* user@yourserver.com:/var/www/downloads/
```

#### CDN Distribution
```bash
# Upload to AWS S3, Cloudflare, etc.
aws s3 sync release/ s3://your-bucket/releases/v1.0.0/
```

## 🔧 Configuration

### Electron Builder Settings

Key configurations in `package.json`:

```json
{
  "build": {
    "appId": "com.cueme.interview-assistant",
    "productName": "CueMe",
    "publish": [{
      "provider": "github",
      "owner": "ibttf",
      "repo": "interview-coder-frontend"
    }]
  }
}
```

### Platform-Specific Builds

#### macOS
- **Formats:** DMG (installer), ZIP (portable)
- **Architectures:** x64, ARM64 (Apple Silicon)
- **Code Signing:** Configured for notarization

#### Windows
- **Formats:** NSIS (installer), Portable EXE
- **Architectures:** x64, ia32
- **Features:** Auto-updater, desktop shortcuts

#### Linux
- **Formats:** AppImage (portable), DEB (Ubuntu/Debian)
- **Architecture:** x64
- **Features:** System integration

## 🚀 Release Workflow

### Automated (Recommended)

1. **Prepare Release:**
   ```bash
   ./scripts/prepare-release.sh v1.2.3
   ```

2. **GitHub Actions Builds:**
   - Triggered automatically on tag push
   - Builds for all platforms
   - Creates GitHub release
   - Uploads all artifacts

3. **Landing Page Updates:**
   - Automatically detects new release
   - Shows platform-specific downloads
   - Updates version information

### Manual Release

1. **Version Bump:**
   ```bash
   npm version 1.2.3 --no-git-tag-version
   ```

2. **Build:**
   ```bash
   npm run app:build:all
   ```

3. **Create Release:**
   ```bash
   gh release create v1.2.3 release/* --title "CueMe v1.2.3" --notes "Release notes here"
   ```

## 📊 Landing Page Integration

The landing page automatically:

1. **Detects User Platform:** macOS, Windows, or Linux
2. **Fetches Latest Release:** From GitHub API
3. **Shows Recommended Download:** Platform-specific installer
4. **Provides All Options:** All available formats
5. **Displays System Requirements:** Per platform

### API Endpoint

```javascript
// Fetches latest release info
fetch('https://api.github.com/repos/itsukison/CueMe2/releases/latest')
```

## 🔐 Security & Code Signing

### macOS Code Signing

```bash
# Set up certificates (requires Apple Developer account)
export CSC_LINK="path/to/certificate.p12"
export CSC_KEY_PASSWORD="certificate_password"
```

### Windows Code Signing

```bash
# Set up certificate
export CSC_LINK="path/to/certificate.p12"
export CSC_KEY_PASSWORD="certificate_password"
```

## 📈 Analytics & Monitoring

### Download Tracking

- **GitHub:** Built-in download counts per release
- **Custom:** Add analytics to landing page download buttons
- **User Feedback:** Monitor GitHub issues for installation problems

### Release Metrics

```bash
# Get download stats
gh api repos/itsukison/CueMe2/releases/latest
```

## 🐛 Troubleshooting

### Common Build Issues

1. **Missing Dependencies:**
   ```bash
   npm ci  # Clean install
   ```

2. **Platform-Specific Builds:**
   ```bash
   # Use Docker for cross-platform builds
   docker run --rm -ti -v ${PWD}:/project electronuserland/builder
   ```

3. **Code Signing Errors:**
   ```bash
   # Skip code signing for testing
   export CSC_IDENTITY_AUTO_DISCOVERY=false
   ```

### Release Issues

1. **GitHub API Rate Limits:** Use authenticated requests
2. **Large File Uploads:** Use Git LFS for assets > 100MB
3. **Permission Errors:** Check GitHub token permissions

## 📋 Checklist

Before releasing:

- [ ] All tests pass
- [ ] Version number updated
- [ ] Release notes prepared
- [ ] Code signed (for production)
- [ ] All platforms tested
- [ ] Landing page updated
- [ ] Documentation updated

## 🔄 Auto-Updates

The app supports automatic updates via electron-updater:

```javascript
// In main process
import { autoUpdater } from 'electron-updater'

autoUpdater.checkForUpdatesAndNotify()
```

Users will be notified when new versions are available and can update with one click.

## 📞 Support

For release-related issues:

1. Check GitHub Actions logs
2. Review electron-builder documentation
3. Test builds locally first
4. Monitor user feedback on releases

---

**Happy Releasing! 🚀**