#!/usr/bin/env python3
"""Lightweight schema and referential-integrity validation."""
from __future__ import annotations

import json
import sys
from datetime import date
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
DATA = ROOT / "data"


def read(name: str) -> dict:
    with (DATA / name).open("r", encoding="utf-8") as f:
        return json.load(f)


def fail(message: str) -> None:
    print(f"ERROR: {message}", file=sys.stderr)
    raise SystemExit(1)


def main() -> None:
    catalog = read("catalog.json")
    snapshots = read("snapshots.json")
    events = read("events.json")
    read("market.json")

    products = catalog.get("products", [])
    ids = [p.get("id") for p in products]
    if len(ids) != len(set(ids)):
        fail("Duplicate product IDs")
    if any(not x for x in ids):
        fail("Every product requires an ID")

    known = set(ids)
    for snapshot in snapshots.get("snapshots", []):
        date.fromisoformat(snapshot["date"])
        fx = snapshot.get("fx", {}).get("JPY_CNY")
        if not isinstance(fx, (int, float)) or fx <= 0:
            fail("Each snapshot requires a positive JPY_CNY rate")
        for quote in snapshot.get("quotes", []):
            if quote.get("productId") not in known:
                fail(f"Unknown quote productId: {quote.get('productId')}")
            if quote.get("currency") not in {"JPY", "CNY"}:
                fail("Quote currency must be JPY or CNY")
            if quote.get("checkoutPrice", 0) <= 0:
                fail("Quote checkoutPrice must be positive")
            if not quote.get("sourceUrl") or not quote.get("verifiedAt"):
                fail("Every quote requires sourceUrl and verifiedAt")

    for event in events.get("events", []):
        date.fromisoformat(event["date"])
        if not event.get("sourceUrl"):
            fail("Every market event requires a source URL")

    print(f"Validated {len(products)} products and {len(snapshots.get('snapshots', []))} snapshots.")


if __name__ == "__main__":
    main()
