#!/usr/bin/env python3
"""Standard-library-only private-desktop demo. Writes synthetic files, never overwrites."""
from __future__ import annotations

import argparse
import csv
import json
from pathlib import Path
import sys

EXPECTED = "DSH_DESKTOP_OK 中文✓"
ROWS = [("alpha", 2), ("beta", 5), ("gamma", 3)]


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--output", type=Path, required=True, help="New output directory; must not already exist")
    parser.add_argument("--wait", action="store_true", help="Keep the terminal open until Enter after success")
    args = parser.parse_args()
    output = args.output.resolve()
    if output.exists():
        print("Refusing to overwrite an existing output directory.", file=sys.stderr)
        return 2

    print("DSH independent desktop demo", flush=True)
    print("Type the following marker using desktop_action, then press Enter:", flush=True)
    print(EXPECTED, flush=True)
    try:
        marker = input("> ")
    except EOFError:
        print("No marker received; no files written.", file=sys.stderr)
        return 2
    if marker != EXPECTED:
        print("Marker mismatch; no files written.", file=sys.stderr)
        return 2

    # Claim the directory only after the actual GUI input was verified.
    output.mkdir(parents=True, exist_ok=False)
    with (output / "samples.csv").open("x", encoding="utf-8", newline="") as stream:
        writer = csv.writer(stream)
        writer.writerow(["sample", "count"])
        writer.writerows(ROWS)
    result = {
        "marker": marker,
        "row_count": len(ROWS),
        "total": sum(count for _, count in ROWS),
        "python_executable": str(Path(sys.executable).resolve()),
        "python_version": sys.version.split()[0],
        "cwd": str(Path.cwd().resolve()),
    }
    with (output / "result.json").open("x", encoding="utf-8") as stream:
        json.dump(result, stream, ensure_ascii=False, indent=2)
        stream.write("\n")
    with (output / "summary.txt").open("x", encoding="utf-8") as stream:
        stream.write(f"PASS: {marker}\n3 synthetic rows, total 10.\n")

    print("PASS — synthetic CSV and result saved.", flush=True)
    print("3 rows; total = 10", flush=True)
    print(f"Output: {output}", flush=True)
    if args.wait:
        try:
            input("Leave this visible for a screenshot. Press Enter to exit. ")
        except EOFError:
            pass
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
