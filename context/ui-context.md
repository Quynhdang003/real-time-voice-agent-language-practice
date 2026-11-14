# UI Context

## Theme

Light only. `app/globals.css` declares `@custom-variant dark`, but no dark
tokens exist and nothing uses `dark:`. The look is a calm learning app: a
light slate page background, white cards with soft shadows, indigo as the
primary and selection color, violet as a secondary accent, and green and red
only for state. All UI copy is English.

## Colors

Tokens are CSS custom properties in `:root` (`app/globals.css`), exposed to
Tailwind v4 through `@theme inline` as `--color-app-*`. That gives classes like
`bg-app-primary`, `text-app-muted` and `border-app-border`. Use these tokens
instead of hex values.

| Role                   | CSS Variable          | Value     | Tailwind class            |
| ---------------------- | --------------------- | --------- | ------------------------- |
| Page background        | `--app-background`    | `#f8fafc` | `bg-app-background`       |
| Surface (cards)        | `--app-card`          | `#ffffff` | `bg-app-card` / `bg-white` |
| Primary text           | `--app-text`          | `#0f172a` | `text-app-text`           |
| Muted text             | `--app-muted`         | `#64748b` | `text-app-muted`          |
| Primary accent         | `--app-primary`       | `#6366f1` | `bg-/text-/border-app-primary` |
| Primary tint           | `--app-primary-light` | `#eef2ff` | `bg-app-primary-light`    |
| Secondary accent       | `--app-accent`        | `#8b5cf6` | `text-app-accent`         |
| Border                 | `--app-border`        | `#e2e8f0` | `border-app-border`       |
| Error                  | `--app-error`         | `#ef4444` | `text-app-error`          |
| Success                | `--app-success`       | `#22c55e` | `bg-app-success`          |

- The shadcn semantic tokens map onto these: `--background`, `--foreground`,
  `--card`, `--primary` (`--primary-foreground` is `#ffffff`), `--border`,
  `--input`, `--ring` (= primary) and `--destructive` (= error).
  `--secondary`, `--muted` and `--accent` are `#f1f5f9`.
- Shadows:
  - `shadow-card`: `0 6px 24px rgba(15,23,42,.05)`
  - `shadow-highlight`: `0 10px 30px rgba(99,102,241,.08)`, used for the
    review hero
  - `shadow-active`: `0 10px 32px rgba(99,102,241,.1)`, defined but unused
- In practice, components also use raw palette tints for hover, focus and
  state, e.g. `bg-indigo-50`, `hover:bg-indigo-700`, `focus:ring-indigo-100/200`,
  `bg-red-50 text-red-600/800`, `bg-green-50 text-green-600`, `text-emerald-700`.

## Typography

| Role      | Font                                     | Variable                         |
| --------- | ---------------------------------------- | -------------------------------- |
| UI text   | Inter (`next/font/google`, latin subset) | `--font-inter` → `--font-sans`   |
| Headings  | Inter                                    | `--font-heading`                 |
| Code/mono | Tailwind default mono stack              | `font-mono` (call timer only)    |

- Eyebrow: `text-sm font-semibold uppercase tracking-[0.12em] text-app-primary`
- Page title: `text-3xl font-bold tracking-tight text-app-text sm:text-4xl`
  (home: `text-4xl sm:text-5xl`)
- Section title: `text-2xl font-bold tracking-tight`. Card title:
  `text-base`/`text-lg font-bold`.
- Body and secondary text: `text-sm leading-6`/`leading-7 text-app-muted`

## Border Radius

`--radius: 0.625rem`. `@theme inline` rescales the steps: `rounded-sm` 0.375rem,
`rounded-md` 0.5rem, `rounded-lg` 0.625rem, `rounded-xl` 0.875rem,
`rounded-2xl` 1.125rem.

| Context                                         | Class          |
| ----------------------------------------------- | -------------- |
| Inputs, buttons, topic tiles, small icon boxes  | `rounded-xl`   |
| Cards, panels, page sections, menus             | `rounded-2xl`  |
| Pills, badges, avatars, status dots, progress   | `rounded-full` |
| Icon buttons inside inputs                      | `rounded-lg`   |

## Component Library

- shadcn (`components.json`: style `base-nova`, base color neutral, icon
  library lucide) on top of `@base-ui/react` and Tailwind.
- Generated primitives live in `components/ui/`: avatar, badge, button, card,
  input, progress, separator. Only `Input` is used today. Buttons, cards and
  badges are hand-styled with Tailwind in `components/fluent/`.
- Add new primitives with the shadcn CLI, not by hand. Do not edit
  `components/ui/*`.

## Layout Patterns

- App shell:
  - Header: white, `border-b border-app-border`, `h-20`, with the logo on the
    left and the avatar menu on the right.
  - Content: `mx-auto max-w-[1280px] px-5 sm:px-8 lg:px-10`, with
    `py-8`–`py-12`. The review page uses `max-w-[1240px]`.
- Auth pages: `lg:grid-cols-[45%_55%]`. The left brand panel (`bg-indigo-50`)
  is hidden below `lg`. The form card on the right is `max-w-[440px]`,
  `rounded-2xl`, `p-6 sm:p-8`.
- Home (SET-04, `components/fluent/home-practice-setup.tsx`): no language
  picker. The grid is `lg:grid-cols-[1fr_380px]`: the Session card on the
  left; the Learner profile card and the tutor/summary/Start card on the right.
  The placeholder "Recent practice" grid is still at the bottom (N-05). Shared
  controls:
  - `OptionPills` (`option-pills.tsx`): a single-choice pill group, `role=group`
    + `aria-pressed`
  - `ChipInput` (`chip-input.tsx`): Enter or comma adds; paste splits on
    `, ; \n`; Backspace removes the last item; duplicate/`;`/length hints in
    amber; errors in red
  Details:
  - **Learner profile** block: pre-filled; pills for accent, pace, correction
    style and Vietnamese use; a CEFR level pill row A1–C2. Edits apply to this
    session, and a secondary **Save as default** button saves them.
  - **Session** block:
    - topic input, plus a scenario textarea with a character counter (≤ 500)
    - session-mode pills
    - vocabulary chip inputs: Enter or comma adds a chip; the counter shows
      8–12 and 3–5; duplicates are rejected inline
    - grammar-focus input
    - weak-points chips, pre-filled and marked "from your last reviews"
    - duration pills 10/15/20
  - Reuse the existing selected/unselected pill and button styles. Field errors
    sit under the field (`text-xs text-red-600`, `aria-describedby`).
- Home access (ACC-02, `components/fluent/access-banner.tsx`):
  - The banner sits between the welcome header and "Start a new practice".
    It is hidden for full and admin accounts.
  - Trial: `border-indigo-100 bg-app-primary-light` with a `Sparkles` icon.
    Blocked (trial used): `border-amber-200 bg-amber-50` with a
    `TriangleAlert` icon.
  - It shows the pending date (indigo, `Clock`) or the decline date (red-700).
  - The request form has an optional message textarea (counter /300) and a
    primary **Request full access** button. Results show as a
    `role="status"` / `role="alert"` line.
  - Dates use `formatAccessDate` (en-GB, `Asia/Ho_Chi_Minh`), so the server
    and the browser render the same text.
  - In the Session card, a trial replaces the duration pills with a
    "1 minute" note. The summary says "1 min (trial)" and the button "Start
    1-minute trial".
  - A blocked account sees a disabled **Full access needed** button with a
    `Lock` icon.
- Daily limit (LIM-01), approved learners only:
  - The summary card adds a "Calls left today: N of M" row.
  - At 0, the button becomes a disabled **Daily limit reached** with a
    `Lock` icon. A muted `role="status"` line gives the reopening date at
    00:00 Vietnam time.
  - A 429 response sets the count to 0 and shows the server message as the
    form error.
- Admin (ACC-03):
  - Header: for the `ADMIN_UID` account only, an **Access requests** link
    (`ShieldCheck`, outlined `rounded-xl`) sits left of the avatar menu. It
    has a `rounded-full bg-app-primary` count badge when requests are
    pending. Below `sm`, the label is hidden and only the icon and badge
    show.
  - `/admin` (`components/fluent/admin-access-panel.tsx`): page header
    (eyebrow "Admin", title "Access requests"), then
    `lg:grid-cols-2`: **Pending requests** and **Approved accounts** cards.
  - Each row shows the name, email, request or approval date, a trial badge
    (`Trial used` slate / `Trial not used` indigo) and the quoted message.
  - Row actions are `h-10 rounded-xl` buttons: Approve (primary), Reject and
    Revoke (red outline). Revoke asks for `window.confirm`.
  - One decision at a time. Then `router.refresh()` updates the lists and
    the header badge. Errors show under the row (`role="alert"`).
- Review (planned RV-02):
  - a hero with the overall feedback
  - **Session goals**: a vocabulary table with status badges `used_correctly`
    (green) / `used_incorrectly` (red) / `not_used` (slate), evidence and
    correction; grammar-focus counts with examples; weak-point statuses; the
    scenario result
  - **Speaking skills**: four 1–5 cards with a level anchor label, evidence
    quotes and a comment
  - grammar errors, next weak points, the transcript
  - state banners: waiting for transcript / generating / failed + Try again
- Voice call: status banner → alert → two participant cards
  (`lg:grid-cols-2`, tutor card highlighted with `border-2 border-app-primary`)
  → tip → centered control bar (Start/End, timer, links).
- Review: hero with the score ring → four metric cards → a 2-column grid
  (strengths, corrections, vocabulary, feedback) → transcript → footer actions.
- Selected state: `border-2 border-app-primary bg-indigo-50`, with
  `aria-pressed`. Unselected: `border border-app-border bg-white
  hover:border-indigo-300`.
- Primary button: `h-12 rounded-xl bg-app-primary px-5 text-sm font-semibold
  text-white hover:bg-indigo-700 focus:ring-4 focus:ring-indigo-200
  disabled:opacity-60`.
- Feedback: errors use `role="alert"` (red-50 background); progress and status
  use `role="status"`. Buttons set `aria-busy` while working.
- The user menu is a simple absolute dropdown (`top-14 right-0 w-64
  rounded-2xl shadow-card`), with no overlay or modal.

## Icons

lucide-react, stroke icons only. Sizes: `h-4 w-4` inline and in badges,
`h-5 w-5` in buttons and inputs, `h-6 w-6` for card and metric icons.
Images go through `next/image`. Allowed remote hosts are `i.pravatar.cc`
(placeholder tutor and default avatars) and `firebasestorage.googleapis.com`
(profile photos).
