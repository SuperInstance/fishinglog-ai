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

## References

1. NOAA Fisheries (2024). *Alaska Fisheries Science Center: Catch Accounting System*.
2. NPFMC (2023). *Fishery Management Plan for Bering Sea/Aleutian Islands King and Tanner Crabs*. North Pacific Fishery Management Council.

## License

MIT
