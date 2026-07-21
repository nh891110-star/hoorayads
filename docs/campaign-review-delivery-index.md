# Campaign Review Delivery Index

This is the starting page for the Campaign Review delivery. Use the **Core documents** first; supporting and historical documents are listed separately so reviewers do not mistake an older QA snapshot for the current product contract.

## Core documents

| Document | Purpose | Recommended reader |
| --- | --- | --- |
| [Campaign Review Reverse PRD](./campaign-review-reverse-prd-one-pager.md) | Current product scope, user journey, tool architecture, field/default policy, advertiser switching, edit/approval behavior, and release status. | PM, Design, Engineering |
| [Campaign Review Golden Prompts](./campaign-review-golden-prompts.md) | Ordered 15-step acceptance run plus complete, partial, exploratory, guardrail, objective, edit, switch, confirm, and stale-card scenarios. | PM, QA, Engineering |
| [Hooray ChatGPT Coworker Installation](./hooray-chatgpt-coworker-installation-one-pager.md) | Private Developer Mode testing, field-by-field OAuth configuration, coworker connection, restricted internal publishing, smoke tests, and troubleshooting. | App owner, Workspace admin, Testers |
| [ChatGPT End-to-End QA - July 21](./campaign-review-chatgpt-qa-2026-07-21.md) | Latest signed-in production ChatGPT results, exact prompts, acceptance matrix, real TikTok errors, advertiser discovery/switch results, and remaining release gate. | PM, QA, Engineering |
| [Campaign/API Field Mapping](./campaign-review-api-field-mapping.md) | Exact card-to-MCP/API mapping, enums, conditional fields, omission rules, and AI-suggestion provenance. | PM, Engineering |

## Setup and release documents

| Document | Purpose |
| --- | --- |
| [Hooray ChatGPT Coworker Installation](./hooray-chatgpt-coworker-installation-one-pager.md) | The authoritative installation and publication guide. Use private Dev apps while schemas change; use restricted internal publishing for a stable pilot. |
| [Campaign Review OAuth Setup - Chinese](./campaign-review-oauth-setup-zh.md) | Chinese OAuth architecture and operational notes. The coworker-installation guide above is authoritative for the current ChatGPT field values. |
| [MCP App Compatibility Playbook](./mcp-app-compatibility-playbook.md) | Cross-host widget/OAuth compatibility and debugging guidance. |

## Product and QA supporting documents

| Document | Purpose |
| --- | --- |
| [BRD QA Matrix](./campaign-review-brd-qa-matrix.md) | Functional acceptance matrix and live-write gates. |
| [Objective QA One-Pager](./campaign-review-objective-qa-one-pager.md) | Website Conversions, Lead Generation, App Promotion, and unsupported-objective coverage. |
| [Demo Golden Prompts](./campaign-review-demo-golden-prompts.md) | Simulation-only prompts. Do not use these to claim production creation success. |

## Historical snapshots

| Document | Status |
| --- | --- |
| [ChatGPT QA - July 20](./campaign-review-chatgpt-qa-2026-07-20.md) | Historical QA snapshot. Use the July 21 report for the latest acceptance state. |
| [Reporting Live Demo Setup](./reporting-live-demo-setup-zh.md) | Earlier reporting-app setup, not the authoritative Campaign Review installation guide. |

## Recommended morning review order

1. Read the Reverse PRD for the product contract.
2. Use the Coworker Installation guide to connect a private Dev app or restricted pilot app.
3. Run the 15-step Golden Prompt acceptance flow.
4. Compare results with the July 21 QA report.
5. Use the API Field Mapping when reviewing card fields or create payload behavior.

## Current release boundary

- Campaign Review creates exactly one Campaign-level object after explicit confirmation.
- It does not create an Ad Group or Ad and therefore cannot deliver or spend.
- Account discovery and prompt-driven advertiser switching are implemented.
- The old card becomes `Inactive`; the replacement card remains editable and confirmable.
- Only a real TikTok create response plus read-back may show `Submitted successfully` and a Campaign ID.
