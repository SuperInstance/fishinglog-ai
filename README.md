# FishingLog

> Commercial fishing logbook.

**[fishinglog.ai](https://fishinglog.ai)**

Track catch, delivery, quota, and crew hours from the wheelhouse. Works offline. Syncs when you hit range. Built for the boats, not the boardroom.

## What It Does

- **Catch logging** — Species, weight, condition, bycatch per pot/set. Auto-logged timestamps and coordinates. Export to eLandings format
- **IFQ/CDQ tracking** — Remaining pounds, alerts at 80% and 95% harvest, linked to permits
- **Crew time & shares** — Hours, lay share calculations, advance tracking, settlement sheets at delivery
- **Offline-first** — Everything saves locally, syncs via Wi-Fi or cellular when back in range
- **Fuel & maintenance** — Burn rates, engine hours, pot inventory, maintenance reminders by actual hours
- **Delivery history** — Every ticket, buyer, price. Year-over-year comparison by species, season, and area

## Supported Fisheries

IFQ · CDQ · AFA · COAR — focused on Alaska, Bering Sea, and Gulf operations.

## Tech Stack

- Cloudflare Workers (edge deployment)
- Single-file HTML response
- Custom domain via Cloudflare

## Deployment

```bash
npx wrangler deploy
```

## Part of [SuperInstance](https://superinstance.ai)
