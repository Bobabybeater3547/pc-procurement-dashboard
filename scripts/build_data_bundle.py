#!/usr/bin/env python3
"""Build the browser data bundle and append the Chinese mobile runtime."""
from __future__ import annotations

import json
from pathlib import Path
from urllib.request import urlopen

ROOT = Path(__file__).resolve().parents[1]
DATA_DIR = ROOT / "data"
OUT = ROOT / "data-bundle.js"
LOCAL_RUNTIME = ROOT / "dashboard" / "runtime.js"
REMOTE_RUNTIME = "https://raw.githubusercontent.com/Kouki3547/pc-procurement-data/main/dashboard/runtime.js"


def load(name: str) -> dict:
    with (DATA_DIR / name).open("r", encoding="utf-8") as file:
        return json.load(file)


def load_runtime() -> str:
    if LOCAL_RUNTIME.exists():
        return LOCAL_RUNTIME.read_text(encoding="utf-8")
    with urlopen(REMOTE_RUNTIME, timeout=30) as response:  # noqa: S310
        return response.read().decode("utf-8")


def main() -> None:
    payload = {
        "catalog": load("catalog.json"),
        "snapshots": load("snapshots.json"),
        "events": load("events.json"),
        "market": load("market.json"),
    }
    bundle = (
        "window.PC_PROCUREMENT_DATA = "
        + json.dumps(payload, ensure_ascii=False, indent=2)
        + ";\n\n"
        + load_runtime()
        + "\n"
    )
    OUT.write_text(bundle, encoding="utf-8")
    print(f"Wrote {OUT}")


if __name__ == "__main__":
    main()
