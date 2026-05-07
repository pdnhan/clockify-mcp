# Clockify MCP Server — Design

**Date:** 2026-05-07
**Status:** Draft for review
**Owner:** nhan.phung@itgratevn.com

## 1. Purpose

Provide a Model Context Protocol (MCP) server that exposes the Clockify time-tracking API as agent-callable tools. The server runs as a Docker container with a streamable HTTP transport so Claude Desktop and other MCP clients can connect to a long-running instance.

## 2. Goals

- Cover the time-tracking core of the Clockify API: workspaces, current user, projects, tasks, time entries, tags, clients.
- Cover the Reports API: detailed, summary, weekly, and shared report listing.
- Ship as a single Docker image, configured by environment variables.
- Use ergonomic tool shapes that minimise the number of calls an agent must make for common workflows (start a timer, list today's entries, generate a weekly report).

## 3. Non-Goals (v1)

- Invoices, expenses, approvals, holidays, time-off policies, hourly rates, audit logs.
- Webhooks.
- Per-request API key (multi-tenant). Server is single-tenant.
- stdio MCP transport.
- Binary report exports (CSV / PDF / XLSX). v1 returns JSON only.

## 4. Decisions

| Topic | Decision |
|---|---|
| Tool surface scope | Time-tracking core + Reports API (~21 tools) |
| Tool shape | Resource + verb tools with smart defaults |
| Auth | Single-tenant `CLOCKIFY_API_KEY` env var |
| Workspace selection | `CLOCKIFY_WORKSPACE_ID` env default; optional override per call |
| Transport | Streamable HTTP on `PORT` (default 3000), endpoint `/mcp` |
| Stack | TypeScript on Node 22 (alpine), `@modelcontextprotocol/sdk`, `zod`, native `fetch`, `vitest`, `msw` |
| Region | `CLOCKIFY_BASE_URL` and `CLOCKIFY_REPORTS_BASE_URL` env vars (defaults: global hosts) |

## 5. Architecture

```
┌────────────┐   HTTP/MCP    ┌──────────────────┐  HTTPS   ┌──────────────────┐
│ MCP client │ ─────────────▶│ clockify-mcp     │ ────────▶│ api.clockify.me  │
│ (Claude…)  │  port 3000    │  (Node 22)       │          │   /api/v1        │
└────────────┘  POST /mcp    │  - MCP server    │          ├──────────────────┤
                             │  - HTTP client   │ ────────▶│ reports.api      │
                             │  - tool registry │          │   .clockify.me/v1│
                             └──────────────────┘          └──────────────────┘
                              env:
                                CLOCKIFY_API_KEY (required)
                                CLOCKIFY_WORKSPACE_ID (required)
                                CLOCKIFY_BASE_URL (optional, region)
                                CLOCKIFY_REPORTS_BASE_URL (optional, region)
                                PORT (optional, default 3000)
                                LOG_LEVEL (optional, default info)
```

Single container. Two upstream hosts (api + reports) share the same `X-Api-Key` auth. Health probe on `GET /health`.

## 6. Components

```
src/
  index.ts                # entrypoint: load config, start HTTP, register tools
  server.ts               # McpServer setup + streamable HTTP transport wiring
  config.ts               # zod-validated env parsing; fail fast on missing required vars
  clockify/
    client.ts             # fetch wrapper: per-request host, X-Api-Key header,
                          # retry, error mapping, 10s timeout
    types.ts              # Clockify response shapes (zod)
    endpoints/            # pure functions over client; one file per resource
      workspaces.ts
      users.ts
      projects.ts
      tasks.ts
      timeEntries.ts
      tags.ts
      clients.ts
      reports.ts          # detailed, summary, weekly, shared list
  tools/
    index.ts              # registerTools(server)
    timer.ts              # start_timer, stop_timer, get_running_timer
    timeEntries.ts        # list/create/update/delete time entries
    projects.ts           # list/get/create projects
    tasks.ts              # list/create tasks
    tags.ts               # list/create tags
    clients.ts            # list/create clients
    workspaces.ts         # list_workspaces, get_current_user
    reports.ts            # report_summary, report_detailed, report_weekly,
                          # list_shared_reports
  lib/
    dates.ts              # "today" | "yesterday" | "this_week" | "last_week"
                          # | "this_month" → ISO range, user-timezone aware
    errors.ts             # ClockifyError → MCP error mapper
    userCache.ts          # lazy in-memory cache of GET /user; one-shot fetch
tests/
  *.test.ts               # vitest, msw mocks
Dockerfile
docker-compose.yml
package.json
tsconfig.json
README.md
```

**Boundary rule:** `tools/*` only call `clockify/endpoints/*` and `lib/*`. Endpoints only call `client.ts`. No tool touches `fetch` directly. `lib/userCache.ts` is the only place that calls `clockify/endpoints/users.ts` outside of tools.

## 7. Tool Surface (~21)

### Workspace / user

| Tool | Inputs | Endpoint |
|---|---|---|
| `get_current_user` | — | `GET /user` |
| `list_workspaces` | — | `GET /workspaces` |

### Timer (top of agent funnel)

| Tool | Inputs | Endpoint |
|---|---|---|
| `start_timer` | `description`, `projectId?`, `taskId?`, `tags?`, `billable?` | `POST /workspaces/{ws}/time-entries` (no `end`) |
| `stop_timer` | `userId?` | `PATCH /workspaces/{ws}/user/{userId}/time-entries` `{end: now}` |
| `get_running_timer` | `userId?` | `GET /workspaces/{ws}/user/{userId}/time-entries?in-progress=true` |

### Time entries

| Tool | Inputs | Endpoint |
|---|---|---|
| `list_time_entries` | `start?`, `end?`, `userId?`, `projectId?`, `page?`, `pageSize?` | `GET /workspaces/{ws}/user/{userId}/time-entries` |
| `create_time_entry` | `description`, `start`, `end`, `projectId?`, `taskId?`, `tags?`, `billable?` | `POST /workspaces/{ws}/time-entries` |
| `update_time_entry` | `id`, …patch fields | `PUT /workspaces/{ws}/time-entries/{id}` |
| `delete_time_entry` | `id` | `DELETE /workspaces/{ws}/time-entries/{id}` |

### Projects / tasks

| Tool | Inputs | Endpoint |
|---|---|---|
| `list_projects` | `name?`, `archived?`, `clientId?`, `page?` | `GET /workspaces/{ws}/projects` |
| `get_project` | `id` | `GET /workspaces/{ws}/projects/{id}` |
| `create_project` | `name`, `clientId?`, `color?`, `billable?` | `POST /workspaces/{ws}/projects` |
| `list_tasks` | `projectId`, `name?`, `status?` | `GET /workspaces/{ws}/projects/{projectId}/tasks` |
| `create_task` | `projectId`, `name`, `assigneeIds?` | `POST /workspaces/{ws}/projects/{projectId}/tasks` |

### Tags / clients

| Tool | Inputs | Endpoint |
|---|---|---|
| `list_tags` | `name?`, `archived?` | `GET /workspaces/{ws}/tags` |
| `list_clients` | `name?`, `archived?` | `GET /workspaces/{ws}/clients` |
| `create_client` | `name`, `address?`, `note?` | `POST /workspaces/{ws}/clients` |

### Reports

| Tool | Inputs | Endpoint |
|---|---|---|
| `report_summary` | `start`, `end`, `groups?` (e.g. `["PROJECT","USER"]`), `users?`, `projects?`, `clients?`, `tags?`, `billable?` | `POST {reports}/workspaces/{ws}/reports/summary` |
| `report_detailed` | `start`, `end`, `page?`, `pageSize?`, `sortColumn?`, `users?`, `projects?`, `tags?`, `billable?` | `POST {reports}/workspaces/{ws}/reports/detailed` |
| `report_weekly` | `start`, `end`, `weeklyFilter?` (`{group, subgroup}`), `users?`, `projects?` | `POST {reports}/workspaces/{ws}/reports/weekly` |
| `list_shared_reports` | `page?`, `pageSize?` | `GET {reports}/workspaces/{ws}/shared-reports` |

### Smart defaults (applied in tool layer, not endpoint layer)

- `workspaceId`: every tool accepts an optional override; falls back to `CLOCKIFY_WORKSPACE_ID`.
- `userId`: defaults to current user (lazy-cached from `GET /user` on first call; cache lives for the process lifetime).
- `start` / `end`: accept ISO strings *or* the literals `today`, `yesterday`, `this_week`, `last_week`, `this_month`. Resolved through `lib/dates.ts` against the current user's timezone.
- `exportType` for reports: fixed to JSON in v1.

## 8. Data Flow Example — `start_timer`

```
agent
  ─▶ POST /mcp  (MCP tools/call name="start_timer")
       ─▶ tools/timer.start_timer(args)
            ├─ resolve workspaceId       (arg ?? config.workspaceId)
            ├─ resolve userId            (cache ?? GET /user)
            ├─ build body                ({ start: now, description, projectId?, ... })
            └─ clockify/endpoints/timeEntries.create(client, ws, body)
                 └─ client.request({ host: "api", method: "POST",
                                     path: `/workspaces/${ws}/time-entries`, body })
                      └─ fetch + X-Api-Key header
                           ├─ 2xx → return parsed JSON
                           └─ 4xx/5xx → throw ClockifyError(status, code, message)
                                └─ tools layer: map to McpError with hint
```

The current-user cache is lazy and never invalidated; restart the container if the API key changes. Workspace id is *not* cached because the env value is read directly.

## 9. Error Handling

| Source | Behaviour |
|---|---|
| Missing/invalid env var | Exit 1 at startup; log the offending var name |
| Clockify 401 / 403 | MCP error: `Clockify auth failed — check CLOCKIFY_API_KEY` |
| Clockify 404 | MCP error including resource type and id |
| Clockify 429 | Exponential backoff, 3 retries (1s, 2s, 4s), then surface |
| Clockify 5xx | One retry, then surface |
| Network / 10s timeout | Surface immediately; retry only on idempotent verbs (GET) |
| Any 4xx with JSON body | Pass through Clockify `code` and `message` fields verbatim |
| Tool input zod failure | MCP `InvalidParams` with the failing field path |

All Clockify errors include the upstream `code` and `message` when the response is JSON.

## 10. Configuration

| Var | Required | Default | Notes |
|---|---|---|---|
| `CLOCKIFY_API_KEY` | yes | — | Personal API key from Clockify profile |
| `CLOCKIFY_WORKSPACE_ID` | yes | — | Default workspace |
| `CLOCKIFY_BASE_URL` | no | `https://api.clockify.me/api/v1` | Region override |
| `CLOCKIFY_REPORTS_BASE_URL` | no | `https://reports.api.clockify.me/v1` | Region override |
| `PORT` | no | `3000` | HTTP port |
| `LOG_LEVEL` | no | `info` | `error`, `warn`, `info`, `debug` |

## 11. Testing

- `vitest` + `msw` mock both Clockify hosts. No live API in CI.
- One test file per `tools/*.ts`: happy path + at least one error case.
- One test file per `clockify/endpoints/*.ts`: asserts request shape (URL, method, body).
- `client.ts` tests: auth header, retry behaviour, base-URL composition per host, error mapping.
- `lib/dates.ts` tests: each literal in multiple timezones, plus DST boundaries.
- Integration smoke test: spin the server in-process, send `tools/list` and one `tools/call` over the HTTP transport, assert response.
- Optional `pnpm test:live`: reads `CLOCKIFY_API_KEY` from the local environment for manual end-to-end verification. Not run in CI.

## 12. Docker

```dockerfile
# Dockerfile (multi-stage)
FROM node:22-alpine AS build
WORKDIR /app
COPY package.json pnpm-lock.yaml ./
RUN corepack enable && pnpm install --frozen-lockfile
COPY tsconfig.json src ./
RUN pnpm build         # tsc → dist/

FROM node:22-alpine
WORKDIR /app
ENV NODE_ENV=production PORT=3000
COPY --from=build /app/dist ./dist
COPY --from=build /app/node_modules ./node_modules
COPY package.json ./
EXPOSE 3000
USER node
HEALTHCHECK --interval=30s --timeout=3s \
  CMD wget -qO- http://localhost:3000/health || exit 1
CMD ["node", "dist/index.js"]
```

```yaml
# docker-compose.yml
services:
  clockify-mcp:
    build: .
    image: clockify-mcp:latest
    ports:
      - "3000:3000"
    environment:
      CLOCKIFY_API_KEY: ${CLOCKIFY_API_KEY}
      CLOCKIFY_WORKSPACE_ID: ${CLOCKIFY_WORKSPACE_ID}
      CLOCKIFY_BASE_URL: ${CLOCKIFY_BASE_URL:-}
      CLOCKIFY_REPORTS_BASE_URL: ${CLOCKIFY_REPORTS_BASE_URL:-}
    restart: unless-stopped
```

Target image size ~30 MB.

## 13. Observability

- Structured JSON logs to stdout. Each request logs: timestamp, level, tool name, upstream host, upstream status, duration ms, error code (if any).
- API key is never logged.
- `LOG_LEVEL=debug` adds request body shapes (with secrets redacted) for tool debugging.

## 14. Security

- API key is read from env only; never accepted from MCP clients.
- HTTP server binds to `0.0.0.0:3000` inside the container; operators are expected to expose it on `127.0.0.1` on the host (documented in README).
- No persistent storage. No on-disk caches.
- Container runs as the non-root `node` user.

## 15. Open Questions

None blocking v1. Future considerations:
- Add `exportType` for binary report formats once an MCP-friendly handoff pattern is chosen (resource link vs. base64 blob).
- Add stdio transport if a use case appears.
- Add multi-tenant per-request key once a client supports forwarding it.

## 16. Acceptance Criteria

1. `docker compose up` starts a server on port 3000 with `CLOCKIFY_API_KEY` and `CLOCKIFY_WORKSPACE_ID` set.
2. `GET /health` returns 200.
3. An MCP `tools/list` call over `POST /mcp` returns all 21 tools with valid zod-derived schemas.
4. `start_timer` followed by `get_running_timer` and `stop_timer` round-trips against a real Clockify account.
5. `report_summary` with `start: "this_week"`, `end: "today"`, `groups: ["PROJECT"]` returns aggregated totals.
6. All vitest suites pass; integration smoke test passes.
7. Container image builds reproducibly under 50 MB.
