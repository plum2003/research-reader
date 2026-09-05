#!/usr/bin/env bash
set -euo pipefail

MODE="${1:-run}"
APP_NAME="ResearchReader"
BUNDLE_ID="com.lijiale.researchreader"
MIN_SYSTEM_VERSION="14.0"
PACKAGE_VERSION="${PACKAGE_VERSION:-0.1.0}"
PACKAGE_ARCH="$(uname -m)"

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
DIST_DIR="$ROOT_DIR/dist"
APP_BUNDLE="$DIST_DIR/$APP_NAME.app"
APP_CONTENTS="$APP_BUNDLE/Contents"
APP_MACOS="$APP_CONTENTS/MacOS"
APP_RESOURCES="$APP_CONTENTS/Resources"
APP_BINARY="$APP_MACOS/$APP_NAME"
INFO_PLIST="$APP_CONTENTS/Info.plist"
ICONSET_DIR="$DIST_DIR/AppIcon.iconset"
ICON_FILE="$DIST_DIR/AppIcon.icns"

pkill -x "$APP_NAME" >/dev/null 2>&1 || true

"$ROOT_DIR/node_modules/.bin/tsc" -b
"$ROOT_DIR/node_modules/.bin/vite" build

rm -rf "$ICONSET_DIR" "$ICON_FILE"
swift "$ROOT_DIR/script/render_icon.swift" "$ICONSET_DIR"
iconutil -c icns "$ICONSET_DIR" -o "$ICON_FILE"

rm -rf "$ROOT_DIR/MacApp/Resources/web"
mkdir -p "$ROOT_DIR/MacApp/Resources/web"
cp -R "$ROOT_DIR/dist/." "$ROOT_DIR/MacApp/Resources/web/"

swift build
BUILD_BIN_DIR="$(swift build --show-bin-path)"
BUILD_BINARY="$BUILD_BIN_DIR/$APP_NAME"
RESOURCE_BUNDLE="$BUILD_BIN_DIR/${APP_NAME}_${APP_NAME}.bundle"

rm -rf "$APP_BUNDLE"
mkdir -p "$APP_MACOS" "$APP_RESOURCES"
cp "$BUILD_BINARY" "$APP_BINARY"
chmod +x "$APP_BINARY"
cp "$ICON_FILE" "$APP_RESOURCES/AppIcon.icns"
cp -R "$RESOURCE_BUNDLE" "$APP_BUNDLE/${APP_NAME}_${APP_NAME}.bundle"

# External drives can carry AppleDouble metadata files. They are not app
# resources and must not be shipped inside the distributable bundle.
find "$APP_BUNDLE" -name '._*' -type f -delete
find "$APP_BUNDLE" -name '.DS_Store' -type f -delete

cat >"$INFO_PLIST" <<PLIST
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>CFBundleExecutable</key>
  <string>$APP_NAME</string>
  <key>CFBundleIdentifier</key>
  <string>$BUNDLE_ID</string>
  <key>CFBundleName</key>
  <string>Research Reader</string>
  <key>CFBundleDisplayName</key>
  <string>Research Reader</string>
  <key>CFBundleIconFile</key>
  <string>AppIcon</string>
  <key>CFBundleIconName</key>
  <string>AppIcon</string>
  <key>CFBundlePackageType</key>
  <string>APPL</string>
  <key>CFBundleShortVersionString</key>
  <string>$PACKAGE_VERSION</string>
  <key>CFBundleVersion</key>
  <string>1</string>
  <key>LSMinimumSystemVersion</key>
  <string>$MIN_SYSTEM_VERSION</string>
  <key>NSHighResolutionCapable</key>
  <true/>
  <key>NSPrincipalClass</key>
  <string>NSApplication</string>
  <key>LSMultipleInstancesProhibited</key>
  <true/>
  <key>CFBundleDocumentTypes</key>
  <array>
    <dict>
      <key>CFBundleTypeName</key>
      <string>PDF Document</string>
      <key>CFBundleTypeRole</key>
      <string>Viewer</string>
      <key>LSHandlerRank</key>
      <string>Alternate</string>
      <key>LSItemContentTypes</key>
      <array>
        <string>com.adobe.pdf</string>
      </array>
    </dict>
  </array>
</dict>
</plist>
PLIST

# Info.plist is generated after the resource copy and can itself receive an
# AppleDouble sidecar on external volumes, so clean the completed bundle once
# more before packaging it.
find "$APP_BUNDLE" -name '._*' -type f -delete
find "$APP_BUNDLE" -name '.DS_Store' -type f -delete

open_app() {
  /usr/bin/open -n "$APP_BUNDLE"
}

case "$MODE" in
  run)
    open_app
    ;;
  --debug|debug)
    lldb -- "$APP_BINARY"
    ;;
  --logs|logs)
    open_app
    /usr/bin/log stream --info --style compact --predicate "process == \"$APP_NAME\""
    ;;
  --telemetry|telemetry)
    open_app
    /usr/bin/log stream --info --style compact --predicate "subsystem == \"$BUNDLE_ID\""
    ;;
  package)
    PACKAGE_ZIP="$DIST_DIR/${APP_NAME}-macos-${PACKAGE_ARCH}-v${PACKAGE_VERSION}.zip"
    rm -f "$PACKAGE_ZIP"
    ditto -c -k --keepParent "$APP_BUNDLE" "$PACKAGE_ZIP"
    echo "$PACKAGE_ZIP"
    ;;
  --verify|verify)
    open_app
    sleep 2
    pgrep -x "$APP_NAME" >/dev/null
    ;;
  *)
    echo "usage: $0 [run|package|--debug|--logs|--telemetry|--verify]" >&2
    exit 2
    ;;
esac
