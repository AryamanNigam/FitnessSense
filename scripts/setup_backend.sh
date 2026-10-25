#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "$0")/../backend"

if [ ! -f .venv/bin/activate ]; then
  rm -rf .venv
  if ! python3 -m venv .venv 2>/dev/null; then
    rm -rf .venv
    python3 -m pip install --user --quiet virtualenv
    python3 -m virtualenv .venv
  fi
fi

.venv/bin/pip install --quiet --upgrade pip
.venv/bin/pip install --quiet -r requirements.txt pytest

mkdir -p data

if [ ! -f .env ]; then
  cp .env.example .env
  echo "Created backend/.env from .env.example - fill in your keys."
fi

echo "Backend ready. Activate with: source backend/.venv/bin/activate"
