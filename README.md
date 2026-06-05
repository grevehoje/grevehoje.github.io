# GreveHoje (GreveHoje.pt)

Modern, minimalist transport strike tracker for Portugal.

## Vision
A "one-glance" dashboard for commuters in Portugal. High signal, zero noise. Optimized for mobile and performance.

## Core Principles
- **Speed First:** Minimal JS, optimized CSS, fast API responses.
- **Directness:** Immediate status indication (Red/Green/Yellow).
- **Maintainability:** Standard TypeScript, lean dependencies, no over-engineering.
- **Monetization:** Clean ad slots that don't compromise UX (CLS-aware).

## Tech Stack
- **Frontend:** React 18+ (TypeScript), Vite, Vanilla CSS (CSS Modules).
- **Backend:** Node.js (TypeScript), Express.
- **Data Layer:** In-memory cache + daily scraper/aggregator.
- **Deployment:** Vercel/Fly.io (Targeting serverless/edge where possible).

## Architecture
```text
[Client: React] <---> [API: Express] <---> [Scraper/Cache] <---> [Transport Data Sources]
```

## Data Sources (Initial Scope)
- **CP** (Comboios de Portugal)
- **Metropolitano de Lisboa**
- **Metro do Porto**
- **Carris**
- **Fertagus**

## UI/UX Plan
- **Primary View:** Global status "Are there strikes today?"
- **Secondary View:** List of operators with impact details.
- **Ads:** Non-intrusive 728x90 (Desktop) / 320x50 (Mobile) sticky footer/header.

## Getting Started

### Prerequisites
- Node.js 18+
- pnpm

### Installation
```bash
pnpm install
```

### Development
Start both client and server:
```bash
pnpm dev
```

- **Frontend:** http://localhost:5173
- **Backend:** http://localhost:3001

## Implementation Roadmap
1. [ ] Project Initialization (Shared TS config, Monorepo structure).
2. [ ] Core API: Define data model and mock strike data.
3. [ ] Frontend: Build minimalist, responsive shell + status cards.
4. [ ] Scraper Engine: Implement CP and Metro Lisboa integrations.
5. [ ] Refinement: Add caching and error handling.
6. [ ] Deployment.
