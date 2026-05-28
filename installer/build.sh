#!/usr/bin/env bash
# Build the Vynex Windows installer.
# Must be run on Windows (or via GitHub Actions windows-latest).
# On Linux: push a tag to trigger the CI build instead.
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
ROOT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"

echo "==> Building server executable..."
cd "$ROOT_DIR/apps/server"
pnpm build:exe

echo "==> Checking for nssm.exe..."
NSSM="$SCRIPT_DIR/assets/nssm.exe"
if [ ! -f "$NSSM" ]; then
  echo "    Downloading nssm 2.24..."
  NSSM_ZIP="/tmp/nssm.zip"
  curl -fsSL "https://nssm.cc/release/nssm-2.24.zip" -o "$NSSM_ZIP"
  unzip -jo "$NSSM_ZIP" "nssm-2.24/win64/nssm.exe" -d "$SCRIPT_DIR/assets/"
  rm "$NSSM_ZIP"
fi

echo "==> Compiling NSIS installer..."
cd "$SCRIPT_DIR"
if command -v makensis &>/dev/null; then
  makensis vynex-setup.nsi
else
  echo "ERROR: makensis not found. Install NSIS:"
  echo "  Windows: choco install nsis"
  echo "  Linux:   sudo apt install nsis  (cross-compiles Windows installers)"
  exit 1
fi

echo ""
echo "Done: installer/vynex-server-setup.exe"
