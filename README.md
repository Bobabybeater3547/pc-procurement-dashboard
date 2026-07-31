# PC Procurement Dashboard

A static, GitHub-Pages-compatible dashboard for a March–April 2027 personal PC purchase. It compares Japanese and Chinese channels using **CNY-normalized landed cost**, while keeping product discovery dynamic.

## What is implemented

- Dynamic product catalog: new products can be inserted and old products retired without changing UI code.
- Dated market snapshots: FX and retailer quotes are versioned together.
- Japan/China quote model: list price, checkout price, shipping, stock, source, evidence quality and verification date.
- CNY conversion with an interactive FX override.
- Candidate filters, fit score, basket and budget scenario.
- Product-launch and market-risk timeline.
- JSON import/export for monthly updates.
- Data validation and a GitHub Actions validation workflow.

## Important limitation

The site does **not** scrape Amazon, JD, Tmall or Kakaku.com in the browser. Those sites use dynamic pricing, regional sessions, coupons and anti-bot systems. Automatically scraping them would be unreliable and may violate site terms. The monthly research task should produce a structured update package with dated source evidence, then merge it into this repository.

## Run locally

Opening `index.html` directly works because `data-bundle.js` embeds the current dataset.

To edit source JSON:

```bash
python3 scripts/validate_data.py
python3 scripts/build_data_bundle.py
```

## Apply a monthly update

1. Copy `monthly_update_template.json` to a dated update file.
2. Add new/changed products, retired IDs, a new snapshot and market events.
3. Run:

```bash
python3 scripts/merge_monthly_update.py update-2026-08.json
```

The script validates references and rebuilds `data-bundle.js`.

## GitHub Pages

1. Create a public repository, for example `pc-procurement-dashboard`.
2. Upload this folder's contents to the repository root.
3. In **Settings → Pages**, deploy from the `main` branch and `/ (root)`.
4. Keep the GitHub App connected so future monthly updates can replace the JSON and `data-bundle.js` files.

## Monthly update logic

Each cycle must perform these steps in order:

1. Discover products launched, released, discontinued or materially repriced during the previous month.
2. Update the catalog before comparing prices.
3. Record current JPY/CNY mid-market rate with timestamp and source.
4. Verify Japan and China retailer quotes, distinguishing list, coupon and checkout prices.
5. Estimate landed cost and warranty friction; do not equate sticker price with final cost.
6. Update recommendations and the complete-build scenario.

## Seed data quality

The initial snapshot intentionally contains only price observations that could be tied to a dated source. China retailer pages were found but did not expose dependable checkout prices in search results, so the dashboard displays those gaps rather than inventing values.
