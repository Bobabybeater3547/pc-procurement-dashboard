#!/usr/bin/env python3
"""Build browser-loadable dashboard data with the Chinese localization layer."""
from __future__ import annotations

import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
DATA_DIR = ROOT / "data"
OUT = ROOT / "data-bundle.js"
LOCALIZATION_SOURCE = ROOT / "ui" / "localization.js"


def load(name: str) -> dict:
    with (DATA_DIR / name).open("r", encoding="utf-8") as f:
        return json.load(f)


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
        + ";\n"
    )
    if LOCALIZATION_SOURCE.exists():
        bundle += "\n" + LOCALIZATION_SOURCE.read_text(encoding="utf-8") + "\n"
    OUT.write_text(bundle, encoding="utf-8")
    print(f"Wrote {OUT}")


if __name__ == "__main__":
    main()
