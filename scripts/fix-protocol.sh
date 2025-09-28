#!/bin/bash

# Fix macOS Protocol Handler Registration for Development
echo "🔧 Fixing macOS protocol handler registration..."

# Kill Launch Services to force refresh
echo "1. Resetting Launch Services database..."
/System/Library/Frameworks/CoreServices.framework/Versions/A/Frameworks/LaunchServices.framework/Versions/A/Support/lsregister -kill -r -domain local -domain system -domain user

# Wait for services to restart
echo "2. Waiting for services to restart..."
sleep 2

# Try to register the protocol manually
echo "3. Attempting manual protocol registration..."

# Get the current Electron app bundle (if exists)
ELECTRON_APP_PATH="/Users/bytedance/Desktop/newcueme/CueMeFinal/node_modules/electron/dist/Electron.app"

if [ -d "$ELECTRON_APP_PATH" ]; then
    echo "   Found Electron app at: $ELECTRON_APP_PATH"
    
    # Register the app with Launch Services
    /System/Library/Frameworks/CoreServices.framework/Versions/A/Frameworks/LaunchServices.framework/Versions/A/Support/lsregister -f "$ELECTRON_APP_PATH"
    
    echo "4. Registered Electron app with Launch Services"
else
    echo "   ⚠️  Electron app not found at expected path"
fi

# Test the registration
echo "5. Testing protocol registration..."
sleep 1

# Check if the protocol can be opened (this will fail in development, but we'll see the error)
if open "cueme://test-registration" 2>&1 | grep -q "No application knows how to open"; then
    echo "   ❌ Protocol handler still not working"
    echo "   This is expected in development mode on macOS"
    echo "   However, the protocol may work when triggered by the browser"
else
    echo "   ✅ Protocol handler appears to be working"
fi

echo ""
echo "🎯 Next steps:"
echo "1. Make sure the Electron app is running"
echo "2. Try clicking the launch button in the web authentication flow"  
echo "3. If it still doesn't work, the browser should show a dialog asking which app to use"
echo "4. Select 'Electron' from the dialog"
echo ""
echo "For production builds, this issue should not occur."
