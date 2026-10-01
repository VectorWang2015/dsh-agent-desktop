#!/usr/bin/env bash
set -euo pipefail
ROOT="$(realpath "$(dirname "${BASH_SOURCE[0]}")/..")"
exec "$ROOT/.runtime/venv/bin/python" "$ROOT/scripts/probe-native.py" "$@"
