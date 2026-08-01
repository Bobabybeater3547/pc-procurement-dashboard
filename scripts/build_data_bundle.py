#!/usr/bin/env python3
"""Build the browser data bundle and append the Chinese mobile runtime."""
from __future__ import annotations

import json
import time
from pathlib import Path
from urllib.request import Request, urlopen

ROOT = Path(__file__).resolve().parents[1]
DATA_DIR = ROOT / "data"
OUT = ROOT / "data-bundle.js"
LOCAL_RUNTIME = ROOT / "dashboard" / "runtime.js"
LOCAL_MANUAL_ENTRY = ROOT / "dashboard" / "manual-entry.js"
LOCAL_LIVE_REFRESH = ROOT / "dashboard" / "live-refresh.js"
REMOTE_RUNTIME = "https://raw.githubusercontent.com/Kouki3547/pc-procurement-data/main/dashboard/runtime.js"
REMOTE_MANUAL_ENTRY = "https://raw.githubusercontent.com/Kouki3547/pc-procurement-data/main/dashboard/manual-entry.js"
REMOTE_LIVE_REFRESH = "https://raw.githubusercontent.com/Kouki3547/pc-procurement-data/main/dashboard/live-refresh.js"


def load(name: str) -> dict:
    with (DATA_DIR / name).open("r", encoding="utf-8") as file:
        return json.load(file)


def fetch_script(remote_url: str) -> str:
    cache_busted = f"{remote_url}?v={int(time.time())}"
    request = Request(
        cache_busted,
        headers={
            "Cache-Control": "no-cache",
            "Pragma": "no-cache",
            "User-Agent": "pc-procurement-dashboard-builder/1.0",
        },
    )
    with urlopen(request, timeout=30) as response:  # noqa: S310
        return response.read().decode("utf-8")


def load_script(local_path: Path, remote_url: str) -> str:
    if local_path.exists():
        return local_path.read_text(encoding="utf-8")
    return fetch_script(remote_url)


def main() -> None:
    payload = {
        "catalog": load("catalog.json"),
        "snapshots": load("snapshots.json"),
        "events": load("events.json"),
        "market": load("market.json"),
    }
    runtime = load_script(LOCAL_RUNTIME, REMOTE_RUNTIME)
    manual_entry = load_script(LOCAL_MANUAL_ENTRY, REMOTE_MANUAL_ENTRY)
    live_refresh = load_script(LOCAL_LIVE_REFRESH, REMOTE_LIVE_REFRESH)

    if "priceEntryButton" not in manual_entry and "manualPriceButton" not in manual_entry:
        raise RuntimeError("Manual price-entry UI marker missing from dashboard/manual-entry.js")
    if "refreshDataButton" not in live_refresh:
        raise RuntimeError("Live refresh marker missing from dashboard/live-refresh.js")

    bundle = (
        "window.PC_PROCUREMENT_DATA = "
        + json.dumps(payload, ensure_ascii=False, indent=2)
        + ";\n\n"
        + runtime
        + "\n\n"
        + manual_entry
        + "\n\n"
        + live_refresh
        + "\n"
    )

    if "录入价格" not in bundle:
        raise RuntimeError("Generated data-bundle.js does not contain the manual price-entry UI")
    if "刷新数据" not in bundle:
        raise RuntimeError("Generated data-bundle.js does not contain the live refresh UI")

    OUT.write_text(bundle, encoding="utf-8")
    print(f"Wrote {OUT} with manual price entry and live refresh")


if __name__ == "__main__":
    main()
