# OJ agent guide

- Obsidian Markdown is the durable source of truth. Generated `app/public/data/*.json` is sanitized, derived output.
- Never access broker credentials, place trades, invent prices/fills, or mark a trade entered/closed without explicit user confirmation.
- Preserve history: add dated log entries rather than replacing material facts.
- Validate notes before building. Incomplete contract fields must stay `TBD`/`null`.
- Public data must exclude account numbers, credentials, addresses, tax data, private attachments, and raw confirmations.
- Review the rendered app in desktop and mobile viewports after meaningful UI changes. Respect reduced motion and keep a calm, precise visual hierarchy.
