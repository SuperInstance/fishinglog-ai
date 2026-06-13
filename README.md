# FishingLog AI

**FishingLog AI** is a Cloudflare Worker serving a commercial fishing logbook application — tracking catch per pot/set, IFQ/CDQ quota balances, crew time and share calculations, fuel/maintenance logs, and delivery history for Alaska commercial fishing vessels.

## Why It Matters

Alaska commercial fishing is a $5+ billion industry operating under strict quota management (IFQ, CDQ, AFA, COAR programs). Every vessel must maintain detailed logbooks: catch by species, location, depth, bottom temperature, bycatch rates, and dead-loss percentages. Paper logbooks are error-prone, hard to search, and impossible to aggregate. Existing digital solutions require satellite uplinks that cost $200+/month and don't work in all fishing grounds. FishingLog runs on a phone or tablet in the wheelhouse, works fully offline, and syncs when the vessel returns to range (Wi-Fi at port, cellular near shore). It generates eLandings-compatible export files and tracks quota in real-time, preventing costly overages. The app is designed by and for Alaskan fishermen — the UI uses nautical terminology, displays depths in fathoms, and shows tide charts from NOAA.

## How It Works

**Data model:**
Each catch entry records:

| Field | Example | Source |
|-------|---------|--------|
| Species | Opilio crab | Manual select |
| Weight (lbs) | 4,200 | Scale integration |
| Pot/Set # | 47 | Auto-increment |
| Depth (fathoms) | 215 | Depth sounder |
| Bottom temp (°F) | 37.2 | Sensor |
| Condition | Good / Dead loss % | Manual |

**Quota tracking:**
```
remaining = IFQ_allocation − Σ(all catches this season)
```

Alerts trigger at 80% (caution) and 95% (stop fishing). Prevents IFQ overages which carry criminal penalties.

**Tide integration:**
Fetches NOAA tide predictions for the vessel's port (e.g., Unalaska Bay at 53.88°N 166.54°W). Displays high/low times and heights — critical for determining when to pull gear (crab pots in slack water catch better).

**Delivery tickets:**
Each delivery generates a unique ticket ID (e.g., `AK-2026-0115-0047`), recording: vessel, port, buyer, species breakdown, total weight, and quota remaining. This matches the Alaska Department of Fish & Game eLandings format.

**Crew shares:**
```
crew_share = (gross − operating_costs) × lay_percentage / crew_count
```

Where `lay_percentage` is the vessel's agreed crew share (typically 30–50% of net).

## Quick Start

```bash
# Deploy to Cloudflare Workers
npx wrangler deploy

# Access the wheelhouse interface
# Open https://your-worker.workers.dev/ on phone/tablet
```

## API

| Route | Description |
|-------|-------------|
| `/` | Full wheelhouse logbook UI |

## Architecture Notes

FishingLog AI operates in the **γ-layer practical application** space. Within γ + η = C, it demonstrates conservation principles in resource management: the quota tracking system is a direct instance of conservation-law enforcement (catch cannot exceed allocation), mirroring how the fleet's conservation matrix tracks avoidance-ratio invariants.

See [ARCHITECTURE.md](https://github.com/SuperInstance/SuperInstance/blob/main/ARCHITECTURE.md).

**Offline-first architecture:** The entire app is served as a single HTML payload with inline JavaScript and CSS — no external dependencies, no CDN calls, no font loading. State persists via `localStorage` with a schema version tag for migrations. When connectivity returns, a `navigator.onLine` event listener triggers a sync queue that uploads catch entries as JSON batches to a KV namespace. Conflict resolution is last-write-wins keyed by timestamp + vessel ID, which is safe because each vessel is the sole writer of its own data.

**Quota overage penalties:** IFQ overages carry civil penalties starting at $10,000 per pound over allocation, and criminal penalties for willful violations. Real-time quota tracking is not merely a convenience — it is a legal compliance requirement. The app's quota calculation uses fixed-point arithmetic (integer pounds, not floating-point) to avoid rounding errors that could accumulate over a season's thousands of catch entries.

**Species supported:** The logbook covers all major Alaska commercial species: King crab (red, blue, golden), Tanner crab (bairdi, opilio), Pacific cod, pollock, halibut, sablefish (black cod), all five salmon species, and groundfish (rockfish, flatfish, Atka mackerel). Each species has configurable IFQ category mappings.

## References

1. NOAA Fisheries (2024). *Alaska Fisheries Science Center: Catch Accounting System*.
2. NPFMC (2023). *Fishery Management Plan for Bering Sea/Aleutian Islands King and Tanner Crabs*. North Pacific Fishery Management Council.
3. ADF&G (2024). *Commercial Fisheries Entry Commission: Permit and IFQ Holder Data*. Alaska Department of Fish and Game.

## License

MIT
