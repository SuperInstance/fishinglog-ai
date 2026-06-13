# FishingLog.ai

Edge AI for commercial fishing vessels — watches the catch, learns from the captain, alerts on species mismatches, and generates regulatory reports. All running locally on a Jetson Orin Nano.

## Brand Line
> From the wheelhouse to the back deck — edge AI that earns its sea legs alongside you.

## Installation

```bash
git clone https://github.com/Lucineer/fishinglog-ai.git
cd fishinglog-ai
```

```bash
# Deploy on vessel (Jetson)
docker compose -f docker/docker-compose.yml up --build

# Deploy cloud backend (optional)
npm install && npx wrangler deploy
```

## Usage

```bash
# Configure vessel
cp cocapn/cocapn.json.example cocapn/cocapn.json
# Edit with vessel name, region, target species

# Generate daily catch report
curl http://localhost:8080/api/report/daily

# Export for ADFG compliance
curl http://localhost:8080/api/report/regional/adfg
```

## Fleet Context

Part of the Cocapn fleet. Related repos:
- [fleet-orchestrator](https://github.com/SuperInstance/fleet-orchestrator) — Coordinates distributed agent fleets on the edge
- [deckboss](https://github.com/SuperInstance/deckboss) — Agent Edge OS for persistent AI backends
- [jetson-claw](https://github.com/SuperInstance/jetson-claw) — Jetson edge runtime for fleet deployment

---
🦐 Cocapn fleet — lighthouse keeper architecture