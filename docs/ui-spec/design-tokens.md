# Design Tokens

## Scope

- Single source of truth: `app/globals.css`
- P1-6 only adds tokens and legacy aliases
- Existing components can keep using `--primary-500`, `--color-primary-light` and other old names without visual change

## Color Scale Matrix

Gray stays on the existing `50~950` scale. The seven brand/status palettes below are expanded to `1~10`, with old aliases mapped back to the same effective values.

| Scale | Primary | Success | Warning | Error | Info | Purple | Cyan |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `1` | `208 100% 97.1%` | `96 88% 98.4%` | `40 100% 98.2%` | `10 100% 98.2%` | `199 100% 98.2%` | `280 100% 98.4%` | `172 88% 97.5%` |
| `2` | `206.4 100% 95.1%` | `90 100% 96.5%` | `40.8 100% 95.1%` | `8 100% 97.1%` | `199.2 100% 95.1%` | `276 100% 97.1%` | `170.4 100% 95.1%` |
| `3` | `209.5 100% 89.8%` | `96 85% 89.4%` | `38 100% 88.6%` | `5 100% 92.2%` | `201 100% 89.4%` | `272 100% 91.8%` | `173 86% 88.6%` |
| `4` | `211.8 100% 77.2%` | `97 73% 66.3%` | `35.5 100% 74.7%` | `2.2 100% 79.6%` | `204 100% 76.5%` | `269 82% 73.3%` | `175.8 72% 68.2%` |
| `5` | `213 100% 62.5%` | `98.1 61.7% 52.9%` | `33 100% 62.5%` | `1.3 100% 72.9%` | `207 100% 62.5%` | `267 67.6% 60%` | `177.6 61.4% 51.2%` |
| `6` | `215 100% 54.3%` | `100.2 76.6% 43.5%` | `31.1 95.8% 53.3%` | `359.3 100% 65.1%` | `208.8 100% 54.7%` | `265 63.9% 50%` | `180 82.2% 41.8%` |
| `7` | `217.2 92% 44.3%` | `101.5 73% 35.1%` | `27.8 89% 45.1%` | `356 91% 56.1%` | `210.5 94% 45.5%` | `262 61% 41.2%` | `181 85% 33.7%` |
| `8` | `219 88% 35.1%` | `102 69% 27.5%` | `24.5 86% 37.3%` | `352 83% 46.7%` | `212 90% 36.1%` | `259 59% 33.3%` | `182 87% 26.7%` |
| `9` | `221 85% 25.9%` | `103 65% 20.4%` | `21.6 82% 28.4%` | `349 77% 36.1%` | `214 86% 27.1%` | `256 57% 25.9%` | `183 82% 20.8%` |
| `10` | `223 80% 16.7%` | `104 60% 14.5%` | `18.8 77% 20.8%` | `346 72% 25.5%` | `216 80% 18.4%` | `253 55% 18.8%` | `184 76% 15.7%` |

## Legacy Alias Mapping

| Legacy token | New scale token |
| --- | --- |
| `--primary-50` | `--primary-1` |
| `--primary-100` | `--primary-2` |
| `--primary-400` | `--primary-5` |
| `--primary-500` | `--primary-6` |
| `--primary-600` | `--primary-7` |
| `--purple-100` | `--purple-2` |
| `--purple-400` | `--purple-5` |
| `--purple-500` | `--purple-6` |
| `--cyan-100` | `--cyan-2` |
| `--cyan-400` | `--cyan-5` |
| `--cyan-500` | `--cyan-6` |
| `--success-100` | `--success-2` |
| `--success-400` | `--success-5` |
| `--success-500` | `--success-6` |
| `--warning-100` | `--warning-2` |
| `--warning-400` | `--warning-5` |
| `--warning-500` | `--warning-6` |
| `--error-100` | `--error-2` |
| `--error-400` | `--error-5` |
| `--error-500` | `--error-6` |
| `--info-100` | `--info-2` |
| `--info-400` | `--info-5` |
| `--info-500` | `--info-6` |

## Semantic Tokens

### Primary Interaction

| Token | Maps to | Purpose |
| --- | --- | --- |
| `--color-primary` | `--primary-6` | Default brand action color |
| `--color-primary-hover` | `--primary-5` | Hover state for primary controls |
| `--color-primary-active` | `--primary-7` | Pressed / active state |
| `--color-primary-selected` | `--primary-1` | Selected background in light mode |
| `--color-primary-disabled` | `--primary-3` | Disabled / muted primary tint |
| `--color-primary-border` | `--primary-5` | Accent border color |
| `--color-primary-bg` | `--primary-1` | Soft primary background |
| `--color-primary-bg-hover` | `--primary-2` | Hovered soft primary background |

### Link / Focus / Table

| Token | Maps to | Purpose |
| --- | --- | --- |
| `--color-link` | `--primary-6` | Default text link |
| `--color-link-hover` | `--primary-5` | Link hover |
| `--color-link-active` | `--primary-7` | Link active |
| `--color-link-visited` | `--purple-6` | Visited link |
| `--color-focus-ring` | `--primary-5` | Focus-visible ring color |
| `--color-focus-shadow` | `--primary-2` | Focus glow / halo color |
| `--color-table-row-hover` | `--gray-50` | Table row hover background |
| `--color-table-row-selected` | `--primary-1` | Table row selected background |
| `--color-table-row-striped` | `--gray-50` | Zebra stripe background |
| `--color-table-border` | `--color-border-primary` | Table border |
| `--color-table-header-bg` | `--gray-50` | Table header background |

### Status Badge Tokens

| Token | Maps to | Purpose |
| --- | --- | --- |
| `--color-status-processing-bg` | `--info-1` | Processing badge background |
| `--color-status-processing-fg` | `--info-7` | Processing badge foreground |
| `--color-status-success-bg` | `--success-1` | Success badge background |
| `--color-status-success-fg` | `--success-7` | Success badge foreground |
| `--color-status-warning-bg` | `--warning-1` | Warning badge background |
| `--color-status-warning-fg` | `--warning-7` | Warning badge foreground |
| `--color-status-error-bg` | `--error-1` | Error badge background |
| `--color-status-error-fg` | `--error-7` | Error badge foreground |
| `--color-status-default-bg` | `--gray-100` | Neutral badge background |
| `--color-status-default-fg` | `--gray-600` | Neutral badge foreground |

## Dark Mode Pairing

P1-6 keeps current business pages visually stable, so existing legacy tokens are not remapped for dark mode. Only the new additive semantic tokens receive dark counterparts:

- Primary soft backgrounds reverse to `9~10` (`--color-primary-bg`, `--color-primary-selected`)
- Table hover / stripe shift to deep gray surfaces
- Link / focus tokens move to lighter blue-purple steps for contrast on dark backgrounds
- Status badge background / foreground pairs reverse to `10 + 3`

## Preview Route

- Dev preview page: `/dev/tokens-preview`
- Purpose: visually validate `7 x 10` scales, semantic tokens, and legacy alias mapping before later P1 items consume them
