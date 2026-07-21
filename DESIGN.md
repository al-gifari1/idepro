---
name: IDEpro Cyber-Control System
colors:
  primary: "#00dcff"
  primary-dim: "rgba(0, 220, 255, 0.08)"
  surface: "#05070d"
  card: "#0c101c"
  card-border: "rgba(0, 220, 255, 0.2)"
  success: "#10b981"
  success-dim: "rgba(16, 185, 129, 0.08)"
  purple: "#a78bfa"
  error: "#ff4455"
  text-primary: "#ffffff"
  text-muted: "#717a96"
  input-bg: "#080a12"
typography:
  display:
    fontFamily: Orbitron, sans-serif
    fontWeight: 900
    letterSpacing: 2px
  body:
    fontFamily: Outfit, sans-serif
    fontSize: 14px
  mono:
    fontFamily: JetBrains Mono, monospace
    fontSize: 12px
rounded:
  sm: 2px
  md: 4px
  lg: 8px
---

# Design System: IDEpro Control Core

## 1. Visual Theme & Atmosphere
The IDEpro interface is a high-density, kinetic developer cockpit. The atmosphere is crisp, surgical, and responsive — inspired by high-frequency developer terminals and glassmorphic telemetry dashboards. It maintains strict visual contrast with electric cyan accents against obsidian space surfaces.

- **Density:** Cockpit Dense (8/10) — High information density without visual noise.
- **Variance:** Offset Asymmetric (6/10) — Balanced grid layouts with highlighted focal cards.
- **Motion:** Kinetic Micro-interactions (6/10) — Spring-physics transitions and perpetual pulse indicators.

## 2. Color Palette & Roles
- **Electric Cyan** (`#00dcff`) — Primary accent, active focus rings, key call-to-actions, terminal headers.
- **Electric Cyan Dim** (`rgba(0, 220, 255, 0.08)`) — Interactive button fills, subtle highlight cards.
- **Deep Space Dark** (`#05070d`) — Main background canvas.
- **Glass Obsidian** (`#0c101c`) — Card containers with translucent background blur.
- **Vibrant Emerald** (`#10b981`) — Live system status, online indicators, successful auth triggers.
- **Deep Cyber Lavender** (`#a78bfa`) — Tier badges (Pro/Premium), administrative override controls.
- **Crimson Red** (`#ff4455`) — Kill-switch triggers, error states, slot limit warnings.
- **Steel Slate** (`#717a96`) — Secondary labels, timestamps, metadata text.

## 3. Typography Architecture
- **Display / Headers:** `Orbitron` — Uppercase, track-tight, weight 900, uppercase letter-spacing (2px).
- **Body Text:** `Outfit` / System Sans — Crisp legibility for developer tools.
- **Monospace Engine:** `JetBrains Mono` / `monospace` — Used exclusively for logs, API tokens, metrics, code snippets, and timestamp streams.

## 4. Component Specifications
- **Command Glass Panels:** Translucent `#0c101c` background, 1px border (`rgba(0, 220, 255, 0.2)`), subtle cyan drop-shadow glow.
- **Cyber Buttons:** Flat tactile feel. Active `-1px` translate feedback. Neon outline with low-opacity fill (`rgba(0, 220, 255, 0.08)`).
- **Slot Bars:** Dynamic 3px height slot indicators. Color transitions from Emerald (`#10b981`) to Amber (`#f59e0b`) to Crimson (`#ff4455`) based on capacity.
- **Status Indicators:** Pulsing live dot indicators (`● ONLINE`) with green glow effects.

## 5. Layout & Responsive Principles
- **Grid Architecture:** Auto-fit responsive grids (`minmax(210px, 1fr)`).
- **Spatial Separation:** Strict 16px to 24px section gaps. No overlapping content.
- **Mobile Collapse:** Below 768px, multi-column dashboard cards collapse cleanly to single-column vertical stacks.

## 6. Motion & Micro-Interactions
- **Spring Physics:** Smooth CSS transitions (`transition: all 0.2s cubic-bezier(0.16, 1, 0.3, 1)`).
- **Perpetual Loops:** Animated pulse effects on active Edge server indicators.
- **Low-Latency Feedback:** Instant visual feedback on button presses and tier toggles.

## 7. Anti-Patterns (Forbidden Standards)
- **No Pure Black:** Never use `#000000` as main canvas surface (use Deep Space Dark `#05070d`).
- **No Emojis:** Use clean vectors from `lucide-react`.
- **No Generic System Fonts:** Avoid plain browser default fonts for headlines.
- **No Excessive Outer Glows:** Restrain neon glows to subtle 20px diffused shadows.
