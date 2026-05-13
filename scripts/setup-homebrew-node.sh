#!/usr/bin/env bash
# Option B: install Homebrew (if needed), then Node.js + npm.
# Run from the repo root (no npm required):
#   bash scripts/setup-homebrew-node.sh
#
# The Homebrew installer may ask for your macOS password (sudo). If you use
# Terminal inside Cursor, use a normal Terminal.app window if sudo fails.

set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

have_brew() { command -v brew >/dev/null 2>&1; }

load_brew_env() {
  if have_brew; then return 0; fi
  if [[ -x /opt/homebrew/bin/brew ]]; then
    eval "$(/opt/homebrew/bin/brew shellenv)"
  elif [[ -x /usr/local/bin/brew ]]; then
    eval "$(/usr/local/bin/brew shellenv)"
  fi
  have_brew
}

echo "==> MADSToQ: Homebrew + Node setup"
echo

if ! load_brew_env; then
  echo "Homebrew not found. Installing using the official script (NONINTERACTIVE=1)..."
  echo "If this stops at a password prompt, complete it in Terminal.app."
  echo
  NONINTERACTIVE=1 /bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"
  echo
  if ! load_brew_env; then
    echo "Homebrew was installed but is not on PATH yet. Add it to your shell config, then open a new terminal."
    echo
    echo "Apple Silicon (M1/M2/M3) — run once:"
    echo '  echo '\''eval "$(/opt/homebrew/bin/brew shellenv)"'\'' >> ~/.zprofile'
    echo '  eval "$(/opt/homebrew/bin/brew shellenv)"'
    echo
    echo "Intel Mac — often:"
    echo '  echo '\''eval "$(/usr/local/bin/brew shellenv)"'\'' >> ~/.zprofile'
    echo '  eval "$(/usr/local/bin/brew shellenv)"'
    echo
    exit 1
  fi
fi

echo "==> Using: $(command -v brew)"
brew --version | head -1

echo
echo "==> Installing Node (includes npm)..."
brew install node

echo
echo "==> Done. Versions:"
node -v
npm -v

echo
echo "Next (from this folder):"
echo "  npm install"
echo "  npm run dev"
