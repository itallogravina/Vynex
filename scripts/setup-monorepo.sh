#!/bin/bash
set -euo pipefail

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Functions
log_info() {
  echo -e "${BLUE}ℹ${NC} $1"
}

log_success() {
  echo -e "${GREEN}✓${NC} $1"
}

log_error() {
  echo -e "${RED}✗${NC} $1"
}

log_step() {
  echo -e "\n${YELLOW}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
  echo -e "${YELLOW}$1${NC}"
  echo -e "${YELLOW}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}\n"
}

# Detect OS
detect_os() {
  case "$(uname -s)" in
    Linux*)   echo "linux";;
    Darwin*)  echo "macos";;
    MINGW*)   echo "windows";;
    *)        echo "unknown";;
  esac
}

# Install system dependencies for Tauri
install_tauri_deps() {
  local os="$1"

  case "$os" in
    linux)
      log_info "Installing Tauri Linux dependencies..."
      if command -v apt-get &> /dev/null; then
        sudo apt-get update
        sudo apt-get install -y \
          libwebkit2gtk-4.1-dev \
          libgtk-3-dev \
          libayatana-appindicator3-dev \
          librsvg2-dev \
          libdbus-1-dev \
          pkg-config \
          build-essential
        log_success "Tauri dependencies installed"
      else
        log_error "apt-get not found. Please install Tauri deps manually."
      fi
      ;;
    macos)
      log_info "Installing Tauri macOS dependencies via Homebrew..."
      if ! command -v brew &> /dev/null; then
        log_error "Homebrew not found. Install from https://brew.sh/"
        exit 1
      fi
      brew install xcode-command-line-tools
      log_success "Tauri macOS dependencies installed"
      ;;
    windows)
      log_info "Windows detected. WebView2 and Visual Studio Build Tools required."
      log_info "See: https://tauri.app/v1/guides/getting-started/prerequisites/"
      ;;
  esac
}

# Install Rust if needed
install_rust() {
  if ! command -v rustc &> /dev/null; then
    log_info "Installing Rust..."
    curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh -s -- -y
    source "$HOME/.cargo/env"
    log_success "Rust installed"
  else
    log_success "Rust already installed ($(rustc --version))"
  fi
  rustup update stable
}

# Setup nvm and Node.js
setup_nodejs() {
  log_info "Setting up Node.js v22..."

  # Install nvm if needed
  if [ -s "$HOME/.nvm/nvm.sh" ]; then
    source "$HOME/.nvm/nvm.sh"
    log_success "nvm found"
  else
    log_info "Installing nvm..."
    curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.7/install.sh | bash
    source "$HOME/.nvm/nvm.sh"
    log_success "nvm installed"
  fi

  # Install Node.js v22
  nvm install 22
  nvm use 22
  log_success "Node.js $(node --version) active"
}

# Install pnpm
setup_pnpm() {
  log_info "Installing pnpm v11..."
  npm install -g pnpm@11
  log_success "pnpm $(pnpm --version) installed"
}

# Create monorepo structure
create_monorepo_structure() {
  local root_dir="$1"

  log_step "Creating monorepo structure in $root_dir"

  mkdir -p "$root_dir"
  cd "$root_dir"

  # Root files
  log_info "Creating root files..."

  cat > package.json << 'EOF'
{
  "name": "vynex",
  "version": "0.1.0",
  "private": true,
  "packageManager": "pnpm@11",
  "scripts": {
    "dev": "turbo run dev",
    "build": "turbo run build",
    "lint": "turbo run lint",
    "typecheck": "turbo run typecheck",
    "format": "turbo run format"
  },
  "devDependencies": {
    "turbo": "^2",
    "typescript": "^5.9",
    "eslint": "^9",
    "prettier": "^3"
  }
}
EOF
  log_success "package.json created"

  cat > pnpm-workspace.yaml << 'EOF'
packages:
  - 'apps/*'
  - 'packages/*'
allowBuilds:
  esbuild: true
publicHoistPattern:
  - '*metro*'
  - '*react-native*'
  - '@react-native*'
  - '*hermes*'
EOF
  log_success "pnpm-workspace.yaml created"

  cat > tsconfig.base.json << 'EOF'
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "lib": ["ES2022"],
    "strict": true,
    "noUncheckedIndexedAccess": true,
    "exactOptionalPropertyTypes": true,
    "noImplicitReturns": true,
    "noFallthroughCasesInSwitch": true,
    "skipLibCheck": true,
    "esModuleInterop": true,
    "resolveJsonModule": true,
    "isolatedModules": true,
    "declaration": true,
    "declarationMap": true,
    "sourceMap": true,
    "paths": {
      "@vynex/shared": ["./packages/shared/src/index.ts"]
    }
  },
  "exclude": ["node_modules", "dist", "build"]
}
EOF
  log_success "tsconfig.base.json created"

  # Create packages directory
  mkdir -p packages/shared/src

  # packages/shared
  cat > packages/shared/package.json << 'EOF'
{
  "name": "@vynex/shared",
  "version": "0.1.0",
  "private": true,
  "main": "dist/index.js",
  "types": "dist/index.d.ts",
  "exports": {
    ".": {
      "types": "./dist/index.d.ts",
      "import": "./dist/index.js",
      "default": "./dist/index.js"
    }
  },
  "scripts": {
    "build": "tsc",
    "typecheck": "tsc --noEmit"
  },
  "devDependencies": {
    "typescript": "*"
  }
}
EOF

  cat > packages/shared/tsconfig.json << 'EOF'
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "outDir": "dist",
    "rootDir": "src"
  },
  "include": ["src"]
}
EOF

  cat > packages/shared/src/index.ts << 'EOF'
export const VYNEX_VERSION = '0.1.0'

export type AppName = 'vynex'
EOF
  log_success "packages/shared scaffold created"

  # Create apps directory
  mkdir -p apps/server/src apps/desktop/src apps/desktop/src-tauri/src apps/mobile/src

  # apps/server
  cat > apps/server/package.json << 'EOF'
{
  "name": "@vynex/server",
  "version": "0.1.0",
  "private": true,
  "scripts": {
    "dev": "tsx watch src/index.ts",
    "build": "tsc",
    "typecheck": "tsc --noEmit"
  },
  "dependencies": {
    "fastify": "^5.3.2"
  },
  "devDependencies": {
    "@types/node": "^22.15.21",
    "tsx": "^4.19.4",
    "typescript": "*"
  }
}
EOF

  cat > apps/server/tsconfig.json << 'EOF'
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "module": "CommonJS",
    "moduleResolution": "node",
    "outDir": "dist",
    "rootDir": "src"
  },
  "include": ["src"]
}
EOF

  cat > apps/server/src/index.ts << 'EOF'
import Fastify from 'fastify'

const server = Fastify({ logger: true })

server.get('/health', async () => {
  return { status: 'ok', app: 'vynex-server' }
})

const port = Number(process.env['PORT'] ?? 3000)

server.listen({ port, host: '0.0.0.0' }, (err, address) => {
  if (err) {
    server.log.error(err)
    process.exit(1)
  }
  server.log.info(`Listening on ${address}`)
})
EOF
  log_success "apps/server scaffold created"

  # apps/desktop
  cat > apps/desktop/package.json << 'EOF'
{
  "name": "@vynex/desktop",
  "version": "0.1.0",
  "private": true,
  "scripts": {
    "dev": "tauri dev",
    "build": "tauri build",
    "typecheck": "tsc --noEmit"
  },
  "dependencies": {
    "react": "^19.1.0",
    "react-dom": "^19.1.0",
    "@tauri-apps/api": "^2"
  },
  "devDependencies": {
    "@tauri-apps/cli": "^2",
    "@vitejs/plugin-react": "^4",
    "@types/react": "^19",
    "@types/react-dom": "^19",
    "typescript": "*",
    "vite": "^6"
  }
}
EOF

  cat > apps/desktop/tsconfig.json << 'EOF'
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "lib": ["DOM", "DOM.Iterable", "ES2022"],
    "jsx": "react-jsx"
  },
  "include": ["src", "vite.config.ts"]
}
EOF

  cat > apps/desktop/vite.config.ts << 'EOF'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    port: 1420,
    strictPort: true,
  },
  build: {
    outDir: 'dist',
  },
})
EOF

  cat > apps/desktop/index.html << 'EOF'
<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Vynex</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>
EOF

  cat > apps/desktop/src/main.tsx << 'EOF'
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
EOF

  cat > apps/desktop/src/App.tsx << 'EOF'
export default function App() {
  return (
    <main>
      <h1>Vynex</h1>
    </main>
  )
}
EOF

  cat > apps/desktop/src-tauri/tauri.conf.json << 'EOF'
{
  "$schema": "https://schema.tauri.app/config/2",
  "productName": "Vynex",
  "version": "0.1.0",
  "identifier": "com.vynex.desktop",
  "build": {
    "frontendDist": "../dist",
    "devUrl": "http://localhost:1420",
    "beforeDevCommand": "pnpm vite",
    "beforeBuildCommand": "pnpm vite build"
  },
  "app": {
    "windows": [
      {
        "title": "Vynex",
        "width": 1200,
        "height": 800
      }
    ],
    "security": {
      "csp": null
    }
  },
  "bundle": {
    "active": true,
    "targets": "all",
    "icon": []
  }
}
EOF

  cat > apps/desktop/src-tauri/Cargo.toml << 'EOF'
[package]
name = "vynex-desktop"
version = "0.1.0"
edition = "2021"

[build-dependencies]
tauri-build = { version = "2", features = [] }

[dependencies]
tauri = { version = "2", features = [] }
serde = { version = "1", features = ["derive"] }
serde_json = "1"
EOF

  cat > apps/desktop/src-tauri/build.rs << 'EOF'
fn main() {
    tauri_build::build()
}
EOF

  cat > apps/desktop/src-tauri/src/main.rs << 'EOF'
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

fn main() {
    tauri::Builder::default()
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
EOF
  log_success "apps/desktop scaffold created"

  # apps/mobile
  cat > apps/mobile/package.json << 'EOF'
{
  "name": "@vynex/mobile",
  "version": "0.1.0",
  "private": true,
  "main": "index.ts",
  "scripts": {
    "dev": "expo start",
    "typecheck": "tsc --noEmit"
  },
  "dependencies": {
    "expo": "~54.0.0",
    "expo-status-bar": "*",
    "react": "19.1.0",
    "react-native": "0.81.5"
  },
  "devDependencies": {
    "@babel/core": "^7",
    "@types/react": "~19.1.17",
    "typescript": "*"
  }
}
EOF

  cat > apps/mobile/tsconfig.json << 'EOF'
{
  "extends": ["../../tsconfig.base.json", "expo/tsconfig.base"],
  "include": ["src", "index.ts"]
}
EOF

  cat > apps/mobile/app.json << 'EOF'
{
  "expo": {
    "name": "Vynex",
    "slug": "vynex",
    "version": "1.0.0",
    "platforms": ["ios", "android"]
  }
}
EOF

  cat > apps/mobile/index.ts << 'EOF'
import { registerRootComponent } from 'expo'
import App from './src/App'

registerRootComponent(App)
EOF

  cat > apps/mobile/src/App.tsx << 'EOF'
import { StatusBar } from 'expo-status-bar'
import { StyleSheet, Text, View } from 'react-native'

export default function App(): React.JSX.Element {
  return (
    <View style={styles.container}>
      <Text>Vynex Mobile</Text>
      <StatusBar style="auto" />
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
  },
})
EOF
  log_success "apps/mobile scaffold created"

  log_success "Monorepo structure created at $root_dir"
}

# Initialize git
init_git() {
  if [ ! -d .git ]; then
    log_info "Initializing git repository..."
    git init
    git config user.email "dev@vynex.local" || true
    git config user.name "Vynex Dev" || true
    log_success "Git repository initialized"
  fi
}

# Main script
main() {
  log_step "Vynex Monorepo Setup"

  local os=$(detect_os)
  log_info "Detected OS: $os"

  # Get target directory
  local target_dir="${1:-.}"
  if [ "$target_dir" = "." ]; then
    target_dir="vynex"
  fi

  log_step "Step 1: Install system dependencies"
  install_rust
  install_tauri_deps "$os"

  log_step "Step 2: Setup Node.js & pnpm"
  setup_nodejs
  setup_pnpm

  log_step "Step 3: Create monorepo structure"
  create_monorepo_structure "$target_dir"

  log_step "Step 4: Initialize git"
  init_git

  log_step "Step 5: Install dependencies"
  log_info "Running pnpm install..."
  pnpm install
  log_success "Dependencies installed"

  log_step "Step 6: Run verification gates"
  log_info "Typechecking shared package..."
  pnpm --filter @vynex/shared typecheck
  log_success "Typecheck gate passed ✓"

  log_step "Complete! 🎉"
  log_success "Monorepo ready at: $(pwd)"
  echo ""
  echo "Next steps:"
  echo "  cd $target_dir"
  echo "  pnpm dev       # Start all apps"
  echo "  pnpm build     # Build all packages"
  echo "  pnpm typecheck # Typecheck all packages"
  echo ""
}

main "$@"
