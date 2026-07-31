#!/usr/bin/env python3
"""Merge a monthly update package into catalog, snapshots and events."""
from __future__ import annotations

import argparse
import json
import subprocess
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
DATA = ROOT / "data"


def load(path: Path) -> dict:
    with path.open("r", encoding="utf-8") as f:
        return json.load(f)


def save(path: Path, obj: dict) -> None:
    path.write_text(json.dumps(obj, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("update", type=Path)
    args = parser.parse_args()
    update = load(args.update)

    catalog = load(DATA / "catalog.json")
    by_id = {p["id"]: p for p in catalog["products"]}
    for product in update.get("upsertProducts", []):
        by_id[product["id"]] = product
    for product_id in update.get("retireProductIds", []):
        if product_id in by_id:
            by_id[product_id]["status"] = "retired"
    catalog["products"] = sorted(by_id.values(), key=lambda x: (x["category"], x["brand"], x["model"]))
    save(DATA / "catalog.json", catalog)

    snapshots = load(DATA / "snapshots.json")
    if update.get("snapshot"):
        snapshots["snapshots"] = [s for s in snapshots["snapshots"] if s["date"] != update["snapshot"]["date"]]
        snapshots["snapshots"].append(update["snapshot"])
        snapshots["snapshots"].sort(key=lambda x: x["date"])
    save(DATA / "snapshots.json", snapshots)

    events = load(DATA / "events.json")
    existing = {(e["date"], e["title"]) for e in events["events"]}
    for event in update.get("events", []):
        if (event["date"], event["title"]) not in existing:
            events["events"].append(event)
    events["events"].sort(key=lambda x: x["date"], reverse=True)
    save(DATA / "events.json", events)

    subprocess.run(["python3", str(ROOT / "scripts" / "validate_data.py")], check=True)
    subprocess.run(["python3", str(ROOT / "scripts" / "build_data_bundle.py")], check=True)
    print("Monthly update merged successfully.")


if __name__ == "__main__":
    main()
