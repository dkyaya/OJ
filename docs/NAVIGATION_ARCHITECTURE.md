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

Settings is a secondary route at `/settings`. Workspace is a secondary route at `/workspace`; it summarizes members, missions, questions, debriefs, and allowlisted activity without becoming a seventh primary tab. Desktop exposes Workspace below Build Idea. Mobile keeps all six primary destinations visible in the liquid-glass navigation bar and reserves the seventh slot for More. The glass selection can be tapped or dragged across primary destinations. More opens a compact sheet containing Workspace, Settings, and Build Idea. Every control has a text label and remains keyboard reachable.

Legacy hashes for Trade Ideas, Research, Active Trades, Closed Trades, and Analytics normalize to their current section so existing links do not break.
