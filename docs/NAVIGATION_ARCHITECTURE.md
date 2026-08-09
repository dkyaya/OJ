# Navigation Architecture

OJ has exactly six primary product sections.

| Section | Route | Purpose |
| --- | --- | --- |
| Overview | `/` | Risk, active positions, near-term catalysts, and draft ideas. |
| Catalysts | `/catalysts` | Month-first calendar, radar, and security mappings. |
| Ideas | `/ideas` | Research, candidate structures, status, and export. |
| Trades | `/trades` | Confirmed active and closed positions. |
| Journal | `/journal` | Check-ins, reviews, and full journal export. |
| Insights | `/insights` | Patterns derived from canonical records. |

Settings is a secondary route at `/settings`. Desktop shows the six sections in the sidebar. Mobile shows Overview, Catalysts, Ideas, and Trades directly; More opens a bottom sheet containing Journal, Insights, Settings, and Build Idea. Every control has a text label and remains keyboard reachable.

Legacy hashes for Trade Ideas, Research, Active Trades, Closed Trades, and Analytics normalize to their current section so existing links do not break.
