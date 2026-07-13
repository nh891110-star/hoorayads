# MCP App compatibility playbook

This document records cross-host failures that can look like widget bugs even when the tool data is correct.

## `Failed to fetch template`

### Signal

- The MCP tool returns structured data successfully.
- ChatGPT shows `Error loading app` and `Failed to fetch template`.
- A direct `resources/read` for the current URI succeeds.

### Root cause

ChatGPT can cache an older tool descriptor after a widget URI is versioned. If the server removes the old resource immediately, the cached descriptor requests a URI that no longer exists.

### Durable fix

- Keep the tool descriptor pointed at the newest versioned URI.
- Continue registering every previously shipped URI as a legacy alias.
- Serve the current HTML and `text/html;profile=mcp-app` MIME type from every alias.
- Do not write QA that requires old URIs to disappear. QA should require them to remain readable and byte-equivalent to the current template.

The reporting widget currently uses `v5` and preserves `v4`, `v3`, `v2`, and `v1` aliases.

## Stale widget HTML after a release

### Signal

- A new tool call returns current data, but the expanded card still shows the previous controls or labels.
- Changing a report title or starting a new conversation alone does not reliably refresh the widget.
- Direct resource and iframe checks already return the current HTML.

### Root cause

Both hosts can preserve a previously loaded widget template independently from the tool result. Existing conversation cards are static snapshots and must not be used to validate a new release.

### Recovery and verification

- ChatGPT: start a new conversation, re-select the app from `Add files > More`, and then call the reporting tool again.
- Claude: open `Settings > Connectors`, disconnect and reconnect the connector, start a new conversation, and approve the tool if prompted.
- Preserve legacy resource aliases because a refreshed host may still request a previously published URI.
- Expand the rendered card and assert that a newly shipped control exists in the expected order. For reporting `v5`, `Advertiser Account` must be a searchable combobox before `Level`.
- Do not treat updated text data, a changed title, or a successful tool response as proof that the widget HTML refreshed.

## Claude `mcp_session_terminated`

### Signal

- `get_ads_report` returns complete report data.
- Claude can summarize the returned metrics.
- The interactive connector still shows `Unable to reach`.
- The Claude host notification contains `mcp_session_terminated` or says the MCP session no longer exists.

### Root cause

Tool execution and widget template loading are separate host requests. A model may see a successful tool result while the host fails on a later `resources/read`. An in-memory Streamable HTTP session is unsafe when a host performs delayed requests or a deployment does not guarantee sticky, persistent instances.

### Durable fix

- Use a fresh `StreamableHTTPServerTransport` with `sessionIdGenerator: undefined` for every request to `/mcp/claude`.
- Create and close a fresh MCP server with that transport.
- Return `405` for GET and DELETE on the stateless endpoint.
- Keep `/mcp/chatgpt` stateful while the campaign workflow depends on conversational server state.

The UI and `ReportState` remain identical across hosts; only the HTTP session strategy differs.

## Release checks

Before deploying a widget or transport change:

1. Run TypeScript validation.
2. Verify `tools/list` points to the current versioned resource.
3. Read the current and every legacy resource URI.
4. Call `get_ads_report` and validate KPIs, trend points, rows, and fallback text.
5. Mount the returned resource in a real iframe and assert there are no page errors or failed requests.
6. Test a new ChatGPT conversation in the signed-in product UI after re-selecting the app.
7. Test a new Claude conversation after reconnecting the connector and explicitly enabling it.
8. Treat host notifications and browser errors as separate evidence from the model-visible tool result.
9. Expand each real-host card and verify the expected control names and order, not only the returned data.

Run the automated report checks with:

```bash
pnpm run check
MCP_ENDPOINT=https://<host>/mcp/chatgpt pnpm run qa:reporting-widget
MCP_ENDPOINT=https://<host>/mcp/claude pnpm run qa:reporting-widget
```
