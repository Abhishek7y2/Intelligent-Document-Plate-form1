# DocuNexa Enterprise Design System & Visual Guidelines

## 1. Executive Design Philosophy

DocuNexa is an enterprise-grade Document Intelligence Platform tailored for mission-critical legal, financial, and compliance operations. The user interface adheres to Tier-1 Enterprise B2B SaaS standards, focusing on high-density data presentation, instant visual comprehension, and zero cognitive fatigue.

### Core Principles
1. **Instant Comprehension ("Ek Nazar Mein Samajh")**:
   Reviewers and general counsels handle high-stakes multi-page contracts. Key differences, financial impacts, and risk exposures are surfaced immediately via visual badges, comparative shift cards, and concise metric strips.
2. **High Information Density Without Clutter**:
   Horizontal and vertical screen real estate is optimized. Bulky, bloated card stacks are replaced with compact metric strips (46px height) and streamlined headers so that primary document comparison stages remain visible above the fold.
3. **Zero Horizontal Overflow**:
   All grid containers, toolbars, and comparison panes enforce strict boundary containment (`max-width: 100%`, `overflow-x: hidden`, `min-width: 0`) to eliminate horizontal scrollbars across all screen sizes.
4. **Non-Colliding Hierarchy**:
   Titles, navigation steppers, and review action buttons reside in clearly partitioned rows to guarantee zero overlapping on compact or standard resolution displays.

---

## 2. Design Tokens & Color Palette

The DocuNexa design system is rooted in a crisp, clean light-mode palette with calibrated contrast ratios compliant with WCAG 2.1 AA.

### 2.1 Primary Brand & Interaction Tokens
- **Brand Primary Indigo**: `#4f46e5` (Tailwind Indigo-600)
- **Primary Hover / Active**: `#4338ca` (Indigo-700)
- **Primary Subtle Surface**: `#e0e7ff` (Indigo-100) / `#eef2ff` (Indigo-50)
- **Primary Border Accent**: `#818cf8` / `#c7d2fe`

### 2.2 Semantic Status & Risk Palette
- **High Risk / Critical Exposure**:
  - Text & Icon: `#dc2626` / `#b91c1c`
  - Solid Fill: `#ef4444`
  - Background Tint: `#fee2e2` / `#fef2f2`
  - Border: `#fecaca`
  - Redline Deletion (`<del>`): Background `#fee2e2`, Text `#991b1b`, text-decoration: line-through
- **Medium Risk / Pending Attention**:
  - Text: `#b45309` / `#d97706`
  - Background Tint: `#fef3c7`
  - Border: `#fde68a`
- **Low Risk / Approved / Verified**:
  - Text & Icon: `#166534` / `#15803d`
  - Solid Fill: `#16a34a`
  - Background Tint: `#dcfce7` / `#f0fdf4`
  - Border: `#bbf7d0` / `#86efac`
  - Redline Addition (`<ins>`): Background `#dcfce7`, Text `#166534`, text-decoration: underline

### 2.3 Neutral Surface & Typography Grays
- **Primary Page Background**: `#f8fafc` (Slate-50)
- **Card & Pane Surface**: `#ffffff` (Pure White)
- **Subtle Row Hover**: `#f1f5f9` (Slate-100)
- **Borders & Dividers**: `#e2e8f0` (Slate-200) / `#cbd5e1` (Slate-300)
- **Primary Text**: `#0f172a` (Slate-900)
- **Secondary Text**: `#334155` (Slate-700) / `#475569` (Slate-600)
- **Muted Subtitles & Placeholders**: `#64748b` (Slate-500) / `#94a3b8` (Slate-400)

---

## 3. Typography Hierarchy

DocuNexa uses clean, high-legibility geometric sans-serif typefaces (`Inter`, `system-ui`, `-apple-system`, `Segoe UI`, `Roboto`).

| Style Level | Font Size | Weight | Line Height | Usage |
| :--- | :--- | :--- | :--- | :--- |
| **Page Title** | `1.25rem` (20px) | 800 (Bold) | `1.25` | Document Name, Studio Title |
| **Section Heading** | `1.15rem` (18.4px) | 800 (Bold) | `1.3` | Active Clause Title, Modal Headers |
| **Subheading / H3** | `1.10rem` (17.6px) | 700 (Semi-Bold) | `1.35` | Matrix Table Headers, Card Group Titles |
| **Body Primary** | `0.82rem` - `0.85rem` (13-13.6px) | 500 / 600 | `1.55` | Legal Redline Text, Plain English Summaries |
| **Secondary Metadata** | `0.75rem` - `0.78rem` (12-12.5px) | 600 | `1.4` | Table Cells, Stepper Counters, Tab Buttons |
| **Micro Labels & Tags** | `0.65rem` - `0.70rem` (10.4-11.2px) | 700 / 800 | `1.0` | Risk Badges, Category Pills, Checksums |
| **Monospace / Code** | `0.70rem` - `0.75rem` (11.2-12px) | 600 | `1.4` | Checksums, SHA-256 Hashes, Doc IDs, Line Numbers |

---

## 4. Layout Architecture & Spatial System

### 4.1 Master-Detail Two-Column Studio Layout
The flagship Comparison Studio features a synchronized Master-Detail layout:
- **Left Column: Clause Navigator (`310px` width)**:
  - Sticky positioning (`position: sticky; top: 1rem`) with vertical scrolling for long contract indexes.
  - Review progress meter displaying percentage and completion count (`2 of 4 Done · 50%`).
  - Search input box and quick filter pills (`All`, `High Risk`, `Commercial`, `Compliance`).
  - Clause directory cards with section badges, title, status checks, and before/after snippets.
- **Right Column: Comparison Stage (`minmax(0, 1fr)`)**:
  - Self-contained card containing the active clause's deep analysis.
  - Partitioned into structured vertical zones:
    1. Clause Identity Bar (Badge, Title, Category, Risk).
    2. Stepper & Decision Toolbar (Previous / Next stepper, Accept / Flag buttons).
    3. Executive Shift Summary Box (Before summary ➔ Delta ➔ After summary).
    4. AI Plain-English Impact & Counsel Advice.
    5. AI Recommended Counter-Proposal (Fallback Clause with one-click copy).
    6. Synchronized Redline Panes (Side-by-side or unified with line numbers).
    7. Footer Integrity Bar (Audit seals and direct document viewer citations).

### 4.2 Compact Metric Strip Architecture
To maximize vertical workspace, standard bulky 160px KPI cards are consolidated into a high-density **46px Metric Strip**:
- Single horizontal bar (`padding: 0.55rem 1.15rem; border-radius: 10px; background: #ffffff;`).
- Clean inline separators (`kpi-divider`).
- High-contrast indicator dots (`amber`, `indigo`, `red`, `emerald`) for visual category tagging.

### 4.3 Tab Navigation
- Single-line flex bar with `white-space: nowrap` and `overflow-x: auto`.
- Count badges indicating active metrics per view.
- Smooth transitions between Studio, Matrix, Fields, Manuscript, and Audit views.

---

## 5. UI Component Catalog & Specifications

### 5.1 Executive Shift Summary Card
Provides an instant comparative breakdown between source and target documents:
```
+-----------------------------------+     +------+     +-----------------------------------+
|  <- BASELINE (v1.0)               |     |      |     |  -> AMENDMENT (v2.0)              |
|  Delivery in 45 days standard     | ==> |  ->  | ==> |  Delivery in 30 days priority     |
|  [v1.0 Page 2, Para 4]            |     | MOD  |     |  [v2.0 Page 2, Para 3]            |
+-----------------------------------+     +------+     +-----------------------------------+
```
- **Baseline Card**: Light red left border (`border-left: 3.5px solid #f87171`).
- **Amendment Card**: Emerald left border (`border-left: 3.5px solid #34d399`).
- **Citation Buttons**: Clickable badges routing directly to the original document page viewer (`navigateToViewerCitation`).

### 5.2 AI Legal Intelligence & Fallback Box
- **Translation Card (`.ai-intelligence-card`)**:
  - Blue surface `#eff6ff`, border `#bfdbfe`.
  - Side-by-side layout for Business Impact and Legal Recommendation.
  - Turns soft red (`#fef2f2`) when High Risk exposure is detected.
- **Counter-Proposal Box (`.ai-fallback-box`)**:
  - Soft purple surface `#faf5ff`, dashed border `#d8b4fe`.
  - Includes a one-click `[Copy Fallback Clause]` button providing instant clipboard access.

### 5.3 Synchronized Redline Panes
- **Line Numbers**: Dedicated `32px` column with subtle gray background `#f8fafc` and centered monospace numbers.
- **Split Mode**: Side-by-side 50/50 division with synchronized scrolling.
- **Unified Mode**: Continuous manuscript format displaying additions and deletions inline.

---

## 6. Responsive Breakpoint Rules

| Breakpoint | Layout Adjustment |
| :--- | :--- |
| **> 1200px** | Full Master-Detail 2-Column layout (`310px` + `1fr`), Split pane comparison. |
| **900px - 1199px** | Clause Navigator compacts to `280px`. Split pane stacks into unified or responsive blocks. |
| **< 900px** | Studio Grid stacks vertically (Navigator on top, Stage below). Navigator becomes non-sticky. |
| **< 768px** | Header switches to vertical flex; Metric Strip enables horizontal swipe. |
