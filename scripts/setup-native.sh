#!/usr/bin/env bash
set -euo pipefail
ROOT="$(realpath "$(dirname "${BASH_SOURCE[0]}")/..")"
exec /usr/bin/python3 "$ROOT/scripts/setup-native.py" "$@"
