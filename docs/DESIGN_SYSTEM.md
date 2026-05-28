# Design System

> Live token system introduced in Sprints 12–18. Single source of truth for typography, color, spacing, and density across the reader app. Defined in [`src/app/globals.css`](../src/app/globals.css), exposed as CSS variables on the `<html>` element. Primitives that consume the system live in [`src/components/ui/`](../src/components/ui/).

## Quick reference

```html
<html class="dark|light" data-density="compact|standard|cozy">
```

Components read theme + density via CSS variables — no JS theme awareness, no `isDark` prop drilling.

```tsx
// Idiomatic Sprint 12+ component
<div style={{
  color: 'var(--ds-fg)',
  background: 'var(--ds-bg-card)',
  border: `1px solid var(--ds-border)`,
  padding: 'var(--ds-density-item-py) var(--ds-density-item-px)',
  fontSize: 'var(--ds-density-item-title)',
  fontFamily: 'var(--ds-font-sans)',
}}>
  ...
</div>
```

## Tokens

### Color — base palette

Refined zinc family. Auto-switches via the `.light` class on `<html>` (managed by `useTheme()`).

| Token | Dark mode | Light mode | Use |
|---|---|---|---|
| `--ds-bg-base` | `#0a0a0c` | `#fafaf9` | Page background |
| `--ds-bg-card` | `#101013` | `#ffffff` | Card / panel background |
| `--ds-bg-elev` | `#16161a` | `#f5f5f4` | Elevated surface (chip, hover, active filter) |
| `--ds-bg-subtle` | `#18181b` | `#efedea` | Subtle elevation for nested elements |
| `--ds-border` | `#27272a` | `#e7e5e4` | Default border |
| `--ds-border-subtle` | `#1a1a1f` | `#efedea` | Subtle divider inside cards |
| `--ds-fg` | `#fafafa` | `#18181b` | Primary text |
| `--ds-fg-muted` | `#a1a1aa` | `#52525b` | Secondary text, excerpts |
| `--ds-fg-dim` | `#71717a` | `#78716c` | Metadata, timestamps, counts |

### Color — per-vertical accents

Three accent families for category recognition at a glance.

| Vertical | Token group | Dark fg | Light fg (AA contrast) |
|---|---|---|---|
| Crypto | `--ds-ticker-crypto-{fg,bg,border}` | amber `#fbbf24` | dark amber `#92400e` |
| AI | `--ds-ticker-ai-{fg,bg,border}` | violet `#a78bfa` | dark violet `#5b21b6` |
| OSS | `--ds-ticker-oss-{fg,bg,border}` | cyan `#22d3ee` | dark cyan `#0e7490` |

Each `bg` is 12% alpha (dark) / 18% (light); each `border` is 30%/42% alpha. The `<TickerBadge vertical="crypto|ai|oss">` primitive resolves all three automatically.

### Color — semantic

Stable across themes.

| Token | Hex | Use |
|---|---|---|
| `--ds-success` | `#10b981` | Healthy state, score ≥ 60, "up" trend |
| `--ds-warn` | `#f59e0b` | Mid-tier, "hot" indicator, score 30–59 |
| `--ds-error` | `#ef4444` | Failure, score < 30, "down" trend |
| `--ds-info` | `#3b82f6` | Neutral signal, "active" indicator |

### Typography

Two families, six sizes. Geist Sans + Geist Mono are loaded in `layout.tsx`; `--ds-font-*` aliases them so future swaps to Inter / JetBrains Mono don't require touching consumers.

| Token | rem | px | Use |
|---|---|---|---|
| `--ds-text-xs` | 0.6875 | 11 | Meta, tickers, mono counts |
| `--ds-text-sm` | 0.8125 | 13 | Body, excerpts |
| `--ds-text-base` | 0.875 | 14 | Section headers, nav items |
| `--ds-text-md` | 0.9375 | 15 | Discussion titles (Standard density) |
| `--ds-text-lg` | 1.125 | 18 | Page section headers |
| `--ds-text-xl` | 1.375 | 22 | Page titles |
| `--ds-font-sans` | — | — | Geist Sans → Inter fallback |
| `--ds-font-mono` | — | — | Geist Mono → JetBrains Mono fallback |

### Spacing + radii

4px scale (Tailwind-aligned).

`--ds-space-1`..`--ds-space-16` = 0.25rem..4rem · `--ds-radius-{sm,md,lg,xl,full}` = 4, 6, 8, 12, 9999px.

### Density

Three modes, applied via `data-density="..."` on `<html>` and stored as a user preference (cross-device sync via `DataSyncProvider.syncDensity`).

| Density | item-py | item-px | item-title | excerpt-lines |
|---|---|---|---|---|
| `compact` | 8px | 12px | 13px | 0 (hidden) |
| `standard` (default) | 12px | 16px | 15px | 1 line |
| `cozy` | 24px | 24px | 15px | 2 lines |

Consumers reference `var(--ds-density-item-py)`, `var(--ds-density-item-px)`, `var(--ds-density-item-title)`, `var(--ds-density-item-excerpt-lines)`. CSS does the switching — no JS.

## UI primitives

Eight components in [`src/components/ui/`](../src/components/ui/). Each is pure presentational, reads tokens directly, accepts no `isDark` prop. Import from `@/components/ui`:

| Primitive | Job | Key props |
|---|---|---|
| `TickerBadge` | Per-vertical colored ticker pill | `vertical: 'crypto'\|'ai'\|'oss'\|'neutral'`, `size: 'sm'\|'md'` |
| `ScorePill` | Auto-colored 0–100 governance score | `score: number`, `size?: 'sm'\|'md'` |
| `MetricBox` | Boxed stat tile | `label`, `value`, `sub?`, `color?: 'success'\|'warn'\|'error'\|'info'\|'fg'` |
| `Button` | 4-variant button | `variant: 'primary'\|'secondary'\|'ghost'\|'danger'`, `size?: 'sm'\|'md'` |
| `SectionHeader` | Small uppercase 11px header | `children`, `meta?`, `rightSlot?` |
| `EmptyState` | Icon + title + body + action | `icon?`, `title`, `body?`, `action?`, `compact?` |
| `Chip` | Filter chip | `active?`, `variant: 'solid'\|'outline'\|'dashed'\|'accent'`, `vertical?` |
| `DiscussionListItem` | Density-aware feed row | `ticker`, `vertical`, `title`, `excerpt?`, `stats?`, `isRead?`, `onClick?`, `rightSlot?` |

`DiscussionListItem` is the most complex: it reads `--ds-density-*` so the same JSX renders compact/standard/cozy. The legacy `DiscussionItem` in `src/components/DiscussionItem.tsx` still handles the main feed (bookmark, keyword highlighting, tag click); migration to the primitive is opportunistic.

## Migration: legacy `c()` helper → CSS variables

Sprints 12–18 migrated all "reader workflow" surfaces (Feed, Saved, Briefs, Settings, Inline Reader, FeedFilters, Sidebar, AlertsStrip, BriefsStrip) off [`src/lib/theme.ts`](../src/lib/theme.ts)'s `c()` helper.

**Recipe for migrating a touched file:**

1. Delete `import { c } from '@/lib/theme'`.
2. Delete `const t = c(isDark)`.
3. Replace `t.foo` with the equivalent CSS var:

| Legacy `t.foo` | New CSS var |
|---|---|
| `t.bg` | `'var(--ds-bg-base)'` |
| `t.bgCard` | `'var(--ds-bg-card)'` |
| `t.bgElev` / `t.bgActive` | `'var(--ds-bg-elev)'` |
| `t.bgSubtle` | `'var(--ds-bg-subtle)'` |
| `t.bgBadge` | `'var(--ds-bg-elev)'` |
| `t.border` | `'var(--ds-border)'` |
| `t.borderSubtle` | `'var(--ds-border-subtle)'` |
| `t.fg` / `t.fgSecondary` | `'var(--ds-fg)'` |
| `t.fgMuted` | `'var(--ds-fg-muted)'` |
| `t.fgDim` | `'var(--ds-fg-dim)'` |
| Tailwind `text-zinc-400` etc. on new components | use CSS vars instead |

4. Drop the now-unused `isDark` prop from the function signature.

**Remaining `c()` consumers** as of Sprint 18: `ForumManager.tsx` (~600 LOC, deferred), `app/admin/page.tsx` (~1700 LOC, internal tool), `OnboardingWizard.tsx`, `Toast.tsx`, `ConfirmDialog.tsx`, `ConfigExportImport.tsx`, `ErrorBoundary.tsx`, the marketing landing page, and the `[tenant]/*` dashboard tree. None of these are on the daily reader path; they'll migrate when touched.

## Hooks

| Hook | Source | What it owns |
|---|---|---|
| `useTheme()` | `src/hooks/useTheme.ts` | `'dark'\|'light'`, applies `.light` class to `<html>`, syncs cross-device |
| `useDensity()` | `src/hooks/useDensity.ts` | `'compact'\|'standard'\|'cozy'`, applies `data-density` to `<html>`, syncs cross-device |

Both hooks hydrate from `serverData.preferences` via `DataSyncProvider` after login and write through to `/api/user/preferences` on changes.

## Adding a new token

1. Add the variable(s) to the appropriate block in `globals.css`:
   - Cross-theme stable → `:root` (or the unscoped block)
   - Theme-dependent → both `html, html.dark { ... }` and `html.light { ... }`
2. Use it via `var(--ds-your-token)` in component inline styles or primitive defaults.
3. Document it in the appropriate table above.

## Anti-patterns

- ❌ Adding new tokens outside the `--ds-*` namespace.
- ❌ Hardcoding hex values in components when an existing `--ds-*` token applies.
- ❌ Reading the theme via JS to branch styles (`isDark ? '#fafafa' : '#18181b'`). Use a CSS variable instead.
- ❌ Reinventing a primitive that already exists in `src/components/ui/`.
- ❌ Using the legacy `c()` helper in newly written components.
