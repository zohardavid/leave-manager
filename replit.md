# Workspace

## Overview

pnpm workspace monorepo using TypeScript. Each package manages its own dependencies.
Also includes a standalone Streamlit (Python) application for military reserve unit leave management.

## Stack

- **Monorepo tool**: pnpm workspaces
- **Node.js version**: 24
- **Package manager**: pnpm
- **TypeScript version**: 5.9
- **API framework**: Express 5
- **Database**: PostgreSQL + Drizzle ORM
- **Validation**: Zod (`zod/v4`), `drizzle-zod`
- **API codegen**: Orval (from OpenAPI spec)
- **Build**: esbuild (CJS bundle)
- **Python**: 3.11 (for Streamlit app)

## Applications

### Leave Manager (Streamlit)
- **Path**: `artifacts/leave-manager/app.py`
- **Port**: 5000
- **Command**: `streamlit run artifacts/leave-manager/app.py --server.port 5000`
- **Data**: JSON file at `artifacts/leave-manager/data/data.json`
- **Features**:
  - Soldier interface: login with Full Name + PKAL code, submit/view leave requests
  - Commander interface: approve/deny/edit requests, manpower calendar
  - 30-soldier unit roster (PKAL001–PKAL030)
  - Commander login: PKAL code `COMMANDER`
  - Manpower alert: RED alert when >18 soldiers on leave (< 12 on duty)
  - Deployment countdown to Dec 31, 2026

## Key Commands

- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from OpenAPI spec
- `pnpm --filter @workspace/db run push` — push DB schema changes (dev only)
- `pnpm --filter @workspace/api-server run dev` — run API server locally
- `streamlit run artifacts/leave-manager/app.py --server.port 5000` — run the leave manager app

See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details.
