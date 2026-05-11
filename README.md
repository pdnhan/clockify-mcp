# clockify-mcp

MCP server for the Clockify time-tracking API. Runs as a Docker container, speaks streamable HTTP, exposes 21 tools covering time tracking, projects, tasks, tags, clients, and reports.

## Quick start

```bash
cp .env.example .env
# fill in CLOCKIFY_API_KEY and CLOCKIFY_WORKSPACE_ID
docker compose up -d
curl http://127.0.0.1:3000/health
```

## Configuration

| Var | Required | Default |
|---|---|---|
| `CLOCKIFY_API_KEY` | yes | — |
| `CLOCKIFY_WORKSPACE_ID` | yes | — |
| `CLOCKIFY_BASE_URL` | no | `https://api.clockify.me/api/v1` |
| `CLOCKIFY_REPORTS_BASE_URL` | no | `https://reports.api.clockify.me/v1` |
| `PORT` | no | `3000` |
| `LOG_LEVEL` | no | `info` |

Use the regional base URLs for EU (`euc1`), USA (`use2`), UK (`euw2`), or AU (`apse2`) deployments.

## Connecting from Claude Desktop

Add to `claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "clockify": {
      "command": "npx",
      "args": [
        "-y",
        "mcp-remote@latest",
        "http://127.0.0.1:3000/mcp"
      ]
    }
  }
}
```

## Tools

Time tracking: `start_timer`, `stop_timer`, `get_running_timer`, `list_time_entries`, `create_time_entry`, `update_time_entry`, `delete_time_entry`.

Workspace / user: `get_current_user`, `list_workspaces`.

Projects / tasks: `list_projects`, `get_project`, `create_project`, `list_tasks`, `create_task`.

Tags / clients: `list_tags`, `list_clients`, `create_client`.

Reports: `report_summary`, `report_detailed`, `report_weekly`, `list_shared_reports`.

Date arguments accept ISO strings or the literals `today`, `yesterday`, `this_week`, `last_week`, `this_month` (resolved in UTC).

## Development

```bash
pnpm install
pnpm test
pnpm dev
```

## Security

The server binds inside the container only; the compose file maps it to `127.0.0.1` on the host. Do not expose port 3000 publicly without adding authentication in front of it.
