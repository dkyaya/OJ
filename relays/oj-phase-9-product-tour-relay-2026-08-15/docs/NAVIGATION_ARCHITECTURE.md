# Navigation Architecture

OJ has exactly six primary product sections.

| Section | Route | Purpose |
| --- | --- | --- |
| Overview | `/` | Risk, active positions, near-term catalysts, and draft ideas. |
| Catalysts | `/catalysts` | Month-first calendar, radar, and security mappings. |
| Ideas | `/ideas` | Research, candidate structures, status, and export. |
| Trades | `/trades` | Confirmed active and closed positions. |
| Journal | `/journal` | Trade debriefs, personal lessons, and full journal export. |
| Insights | `/insights` | Patterns derived from canonical records. |

Settings is a secondary route at `/settings`. Workspace is a secondary route at `/workspace`; it summarizes members, missions, questions, debriefs, and allowlisted activity without becoming a seventh primary tab. Desktop exposes Workspace below Build Idea. Mobile exposes four user-selected primary shortcuts plus More in the liquid-glass navigation bar. The glass selection can be tapped or dragged across those shortcuts. More contains the other primary sections, Workspace, Settings, and Build Idea, so customization never removes access. Every control has a text label and remains keyboard reachable.

The product tour navigates programmatically by canonical route and resolves stable semantic targets after each route renders. It does not depend on the order of desktop links, the four selected mobile shortcuts, or whether Journal or Insights currently lives in More. See `PRODUCT_TOUR.md`.

Legacy hashes for Trade Ideas, Research, Active Trades, Closed Trades, and Analytics normalize to their current section so existing links do not break.
