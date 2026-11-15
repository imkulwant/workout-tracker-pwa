# Workout Tracker PWA: Implementation Plan

Nov 9, 2026 · @Kul

## Overview and decisions

Build a single-user, offline-first web app that installs to the iPhone Home Screen and stores every workout on the device. It is a static site with no backend, so it needs no account and still works in a gym with no signal. An agent should execute this document top to bottom, starting at [Phased task list](#phased-task-list).

| Area | Decision | Reason |
| --- | --- | --- |
| Users | One person, no accounts | Removes auth, servers and multi-tenancy from v1 |
| Data location | IndexedDB on the iPhone, through Dexie | Logging must never wait on the network |
| Data safety | JSON backup to Files, with an overdue reminder | The device copy is the only copy in v1 |
| Delivery | Static PWA on GitHub Pages over HTTPS (changed 2026-11-15, `DECISIONS.md` row 23; was Cloudflare Pages) | Service workers need HTTPS, and the host only ever sees code |
| Target device | iPhone on iOS 18.4 or later, portrait, Home Screen mode | Screen Wake Lock works in Home Screen apps from 18.4 |
| Units | Kilograms only, stored as `weightKg` | You train in Sweden; pounds can be added as a display option later |
| Calendar | Weeks start Monday; a workout belongs to the local date it started | Matches Swedish calendars and late sessions past midnight |
| Language and theme | English UI, dark theme only | Keeps v1 small |
| Heatmaps | Training calendar, body map, and muscle-by-week matrix | Covers when you trained, what you trained, and how balance changed |

**Open decision for Kul:** do you need the data on a second device? This plan assumes no, and keeps sync as a later phase. Every record already has the fields sync would need, so adding it later needs no data migration.

## Client and server responsibilities

The server only delivers files; the iPhone stores and computes everything. After the first visit, the app runs fully without the server until a new version is deployed.

| Responsibility | Where it runs | How |
| --- | --- | --- |
| Serving HTML, JavaScript, CSS, icons, manifest | Server (GitHub Pages static hosting) | Plain files over HTTPS, with no application code on the server |
| App code execution and screen rendering | Client | React in the browser engine of the Home Screen app |
| Offline availability | Client | Service worker precaches every build file on first visit |
| Workout, exercise, template and settings storage | Client | IndexedDB through Dexie, on the device only |
| Validation, metrics, records, heatmaps, charts | Client | Pure TypeScript in `src/domain`, SVG rendering in the browser |
| Backup, restore, CSV export | Client | Files built in the browser and handed to iOS Files through the share sheet |
| Updates | Server publishes, client decides | New build is downloaded in the background and applied only after you tap Update |

**Rules that keep it this way**

- The server has no database, API, server functions, login or logs of workout data.
- The app makes no runtime `fetch` calls except the service worker loading its own files from the same origin.
- Any feature that would need a server, such as sync or push notifications, belongs to Phase 10 and needs an explicit decision first.
- A static host is interchangeable: Cloudflare Pages, GitHub Pages or any HTTPS file host works, but changing the URL moves the app to a new storage origin, so restore from backup after a move.

## Scope

Version 1 is complete when you can run a full gym session offline, review it afterwards, see all three heatmaps, and restore everything from a backup.

**In v1**

- Log workouts by exercise, set, weight, reps and set type, resuming automatically after iOS kills the app.
- Exercise library with seeded and custom exercises, each mapped to primary and secondary muscles.
- Workout history by day, with full editing of past sessions.
- Workout templates and starting a session from one.
- Rest timer that survives backgrounding.
- Stats: calendar heatmap, body-map heatmap, muscle-by-week matrix, weekly volume, exercise progress and personal records.
- JSON backup and restore, plus CSV export of all sets.
- Installable Home Screen app with offline launch and controlled updates.

**Not in v1**

- Accounts, sync, or any server-side storage.
- Native App Store packaging, Apple Health, or watch apps.
- Background notifications, because Web Push needs a server to send them.
- Cardio tracking, programme generation, photos, body measurements and social features.
- Pounds, light theme and localisation.

## Agent operating rules

The agent works autonomously through the phases and stops only at tasks marked **\[HUMAN\]**.

1. Export this document as Markdown, commit it as `docs/PLAN.md`, and tick tasks there as they finish.
2. Complete phases in order. Do not start a phase until the previous phase's acceptance criteria pass.
3. Make one commit per task, in the form `feat(phase-4): complete set logging`.
4. Before every commit, run `npm run verify`, which runs lint, typecheck, unit tests and build.
5. Treat the data model and metric definitions in this document as the specification. Do not change them silently.
6. When the plan is ambiguous, pick the smallest option that meets the acceptance criteria and record it in `docs/DECISIONS.md`.
7. Add no runtime dependency outside the stack table without a line in `docs/DECISIONS.md` explaining why.
8. Make no runtime network calls: no analytics, CDN assets, remote fonts or error-reporting services.
9. UI code must access data only through `src/data/repositories`. It must never touch Dexie tables directly.
10. Keep `src/domain` pure, with no React or Dexie imports, and cover it with unit tests.
11. Any schema change needs a new Dexie version, an upgrade function and a migration test.
12. Never store a workout only in component state. Every committed user input is written to IndexedDB immediately.
13. Keep a running handover in `docs/PROGRESS.md`: current phase, last verified commit and known issues.
14. At a **\[HUMAN\]** task, finish all other work in the phase, then give exact instructions and wait.

## Technology stack

Use React and TypeScript on Vite, with Dexie as the only state store for workout data. At Phase 0, install the current stable release of each package and commit the lockfile. If two latest versions conflict on peer dependencies, use the newest compatible pair and record it.

| Concern | Choice | Why this one |
| --- | --- | --- |
| Language | TypeScript, `strict: true` | The schema and metric rules benefit from compile-time checks |
| UI | React, function components | Mature ecosystem and reliable live-query bindings |
| Build | Vite | Fast builds and first-class PWA plugin |
| PWA | `vite-plugin-pwa`, `generateSW` strategy, `registerType: 'prompt'` | Precaches the app and never swaps code during a workout |
| Storage | `dexie` and `dexie-react-hooks` | Compound indexes, migrations and reactive queries over IndexedDB |
| Routing | `react-router` in declarative mode | Deep links and a working back gesture stack |
| Styling | Tailwind CSS with CSS variables for tokens | Small output and no runtime cost |
| Validation | `zod` | Validates backup files before any write |
| IDs | `crypto.randomUUID()` | Built in, and safe for later sync |
| Charts and heatmaps | Hand-written SVG components | Three simple chart shapes do not justify a chart library |
| Fonts and icons | System font stack, inline SVG icons | Offline by default, with no external requests |
| Unit tests | Vitest with `fake-indexeddb` | Tests repositories and migrations in Node |
| End-to-end tests | Playwright, WebKit project with iPhone device profile | Closest automated approximation of Safari |
| Hosting | ~~Cloudflare Pages~~ GitHub Pages (changed 2026-11-15, `DECISIONS.md` row 23) | HTTPS and free hosting from the repository. It has no custom headers (the CSP is a `<meta>` tag), a fixed 10 minute cache, and unknown paths need a `404.html` fallback |

Do not add a separate global state library. Durable state lives in Dexie, and UI-only state stays in React. Expected data is about 4,000 sets a year at 20 sets per session and four sessions a week. Compute stats on read, and add no aggregate tables.

## iOS Home Screen requirements

~~The app must be installed from Safari and used only from the Home Screen icon.~~ **Changed 2026-11-15 (`DECISIONS.md` row 22): the app runs directly in any browser tab, and a Home Screen shortcut opens it like an app.** The storage split still holds, because [Safari and installed apps do not share storage](https://firt.dev/notes/pwa-ios/). Data entered in a Safari tab will not appear in the installed app, so use backup and restore to move it. Platform facts below were checked on 9 November 2026.

| Topic | Platform behaviour | Required implementation |
| --- | --- | --- |
| Install | iOS has no install prompt event. Since iOS 26, [Home Screen additions open as web apps by default](https://webkit.org/?p=16993). | ~~Detect `(display-mode: standalone)`. In a Safari tab, show a full-screen install guide and block workout logging.~~ Dropped 2026-11-15 (`DECISIONS.md` row 22): the app runs in any tab and shows no install prompt. |
| EU availability | Apple [kept Home Screen web apps in the EU](https://9to5mac.com/?p=936361) after its iOS 17.4 beta removal. | No workaround needed. Ignore older articles that say otherwise. |
| Manifest | [iOS honours](https://firt.dev/notes/pwa-ios/) `name`, `short_name`, `scope`, `icons`, `display`, `start_url`, `id` and `theme_color`. It ignores `background_color`, `orientation` and `shortcuts`. | Set `display: standalone`, `start_url: /`, `scope: /`, `id: /`. Do not build features on the ignored fields. |
| Icon | Maskable icons are ignored, and an `apple-touch-icon` link overrides manifest icons. | Provide a 180 px opaque `apple-touch-icon`, plus 192 and 512 px PNGs in the manifest. |
| Splash | Startup images are the only splash option, and they need the `apple-mobile-web-app-capable` meta tag. | Add that meta tag and generate `apple-touch-startup-image` links for current iPhone portrait sizes. |
| Status bar | `black-translucent` is the only way to draw under the status bar. | Use it, and pad layouts with `env(safe-area-inset-*)`. |
| Storage lifetime | [WebKit says](https://bugs.webkit.org/show_bug.cgi?id=237350) HTML storage should not be deleted for a Home Screen app's main domain under the seven-day rule. Eviction can still occur under [storage pressure](https://webkit.org/blog/14403/updates-to-storage-policy/). | Call `navigator.storage.persist()` at launch and show the result in Settings. Keep backups regardless. |
| Origin | Storage belongs to the exact origin. | Choose the final URL before real use. Changing it strands existing data until a backup is restored. |
| Background work | [Background Sync, Periodic Sync, Background Fetch and Vibration are unsupported](https://firt.dev/notes/pwa-ios/). | Do not use them. Run the rest timer from a stored end timestamp. |
| Screen awake | [Wake Lock works in Home Screen apps from iOS 18.4](https://bugs.webkit.org/show_bug.cgi?id=254545). | Hold a lock during active workouts when enabled, and re-acquire it on `visibilitychange`. |
| File export | [Web Share 2.0 is supported](https://firt.dev/notes/pwa-ios/). | Use `navigator.share({ files })`, falling back to an anchor download. |

**Required `index.html` head**

```html
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<meta name="theme-color" content="#0B0D10">
<meta name="apple-mobile-web-app-capable" content="yes">
<meta name="mobile-web-app-capable" content="yes">
<meta name="apple-mobile-web-app-status-bar-style" content="black-translucent">
<meta name="apple-mobile-web-app-title" content="Workout Tracker">
<link rel="apple-touch-icon" href="/icons/apple-touch-icon-180.png">
<link rel="manifest" href="/manifest.webmanifest">
```

**Required native-feel behaviour**

- Set every text input to at least 16 px, so iOS does not zoom on focus.
- Use `type="text"` with `inputmode="decimal"` for weight. Swedish keyboards produce a comma, so accept both `82,5` and `82.5`.
- Use `inputmode="numeric"` for reps.
- Use `100dvh` for app height, and `overscroll-behavior: none` on the root.
- Set `-webkit-tap-highlight-color: transparent`, and disable text selection and `-webkit-touch-callout` on controls.
- Keep tap targets at least 44 by 44 px.
- Keep the tab bar above the keyboard-safe area, and scroll the focused set row into view.
- Provide a visible back control on every pushed screen. Standalone mode has no browser toolbar.

## Repository structure

Dependencies flow one way: `features` call `data` and `domain`, `data` may use `domain`, and `domain` depends on nothing.

```text
workout-tracker/
  docs/            PLAN.md, DECISIONS.md, PROGRESS.md
  public/
    icons/         app icons and startup images
    _headers       (removed 2026-11-15: GitHub Pages cannot send custom headers, row 23)
  e2e/             Playwright specs and fixtures
  src/
    app/           App.tsx, routes.tsx, AppShell, TabBar, UpdatePrompt
    ui/            Button, Sheet, Dialog, NumberField, Chip, Toast, EmptyState
    features/
      home/
      workout/     ActiveWorkoutScreen, ExerciseCard, SetRow, RestTimer, FinishDialog
      history/     HistoryScreen, WorkoutDetailScreen
      exercises/   LibraryScreen, ExerciseDetailScreen, ExerciseForm, ExercisePicker
      templates/   TemplateListScreen, TemplateEditScreen
      stats/       StatsScreen, CalendarHeatmap, BodyMap, MuscleWeekMatrix, TrendChart
      settings/    SettingsScreen, BackupSection, StorageStatus
    data/
      db.ts        Dexie class, versions and migrations
      seed.ts      seed exercise library
      repositories/ exercises.ts, workouts.ts, sets.ts, templates.ts, settings.ts
      backup/      export.ts, import.ts, schema.ts, csv.ts
    domain/
      types.ts     entity and enum types
      muscles.ts   muscle ids, labels, body-part mapping
      dates.ts     local-date and ISO-week helpers
      numbers.ts   decimal parsing and display rounding
      metrics.ts   volume, e1RM, streaks
      heatmaps.ts  calendar, muscle and matrix calculations
      records.ts   personal-record detection
    platform/      storage.ts, wakeLock.ts, share.ts, sound.ts
    styles/        tokens.css, global.css
```

Required npm scripts: `dev`, `build`, `preview`, `lint`, `typecheck`, `test`, `test:e2e` and `verify`.

## Data model

Six tables hold everything, and every synced entity uses a UUID, timestamps and a soft-delete marker. A set stores its `exerciseId` and `date` directly, so progress and heatmap queries need no joins.

```ts
type Id = string;          // crypto.randomUUID()
type LocalDate = string;   // YYYY-MM-DD in the device's local time zone
type EpochMs = number;

interface Entity {
  id: Id;
  createdAt: EpochMs;
  updatedAt: EpochMs;
  deletedAt: EpochMs | null;
}

type MuscleId =
  | 'chest' | 'front_delts' | 'side_delts' | 'rear_delts'
  | 'biceps' | 'triceps' | 'forearms'
  | 'lats' | 'upper_back' | 'traps' | 'lower_back'
  | 'abs' | 'obliques'
  | 'glutes' | 'quads' | 'hamstrings' | 'adductors' | 'calves';

type BodyPart = 'chest' | 'back' | 'shoulders' | 'arms' | 'legs' | 'core';
type Equipment = 'barbell' | 'dumbbell' | 'machine' | 'cable' | 'bodyweight' | 'kettlebell' | 'band' | 'other';
type LoadType = 'weight_reps' | 'bodyweight_reps';
type SetType = 'working' | 'warmup' | 'drop' | 'failure';

interface Exercise extends Entity {
  name: string;
  nameKey: string;             // lower-case, trimmed, for search and uniqueness
  equipment: Equipment;
  loadType: LoadType;
  primaryMuscles: MuscleId[];  // at least one
  secondaryMuscles: MuscleId[];
  isCustom: boolean;
  notes: string;
  defaultRestSec: number | null;
  incrementKg: number;         // default 2.5
  archivedAt: EpochMs | null;
}

interface Workout extends Entity {
  date: LocalDate;             // local date of startedAt
  startedAt: EpochMs;
  endedAt: EpochMs | null;
  status: 'active' | 'completed';
  title: string;
  notes: string;
  templateId: Id | null;
}

interface WorkoutExercise extends Entity {
  workoutId: Id;
  exerciseId: Id;
  position: number;
  notes: string;
}

interface WorkoutSet extends Entity {
  workoutId: Id;
  workoutExerciseId: Id;
  exerciseId: Id;              // denormalised
  date: LocalDate;             // denormalised from Workout.date
  position: number;
  type: SetType;
  weightKg: number | null;     // added load for bodyweight exercises
  reps: number | null;
  completedAt: EpochMs | null; // null until ticked
}

interface TemplateItem {
  exerciseId: Id;
  targetSets: number;
  targetReps: number | null;
  restSec: number | null;
}

interface Template extends Entity {
  name: string;
  notes: string;
  items: TemplateItem[];
}

interface Setting {
  key: string;
  value: unknown;
  updatedAt: EpochMs;
}
```

**Dexie schema, version 1**

```ts
this.version(1).stores({
  exercises: 'id, nameKey, updatedAt',
  workouts: 'id, date, status, startedAt, updatedAt',
  workoutExercises: 'id, workoutId, exerciseId, updatedAt',
  sets: 'id, workoutId, workoutExerciseId, exerciseId, date, [exerciseId+date], updatedAt',
  templates: 'id, name, updatedAt',
  settings: 'key',
});
```

**Settings keys:** `defaultRestSec` (default 120), `wakeLockEnabled` (true), `restSoundEnabled` (true), `calendarMetric` (`sets`), `lastBackupAt`, `activeRestTimer`, `seedVersion`.

**Invariants, enforced in repositories and tested**

- At most one workout has `status: 'active'`. Creating a second one must return the existing one.
- Every multi-table write runs in one Dexie transaction.
- Every write sets `updatedAt`, and repository reads exclude rows with `deletedAt` set.
- Deleting a workout soft-deletes its workout exercises and sets in the same transaction.
- Changing `Workout.date` updates `date` on all its sets in the same transaction.
- Exercises in use can be archived but not deleted. Archived exercises stay visible in history and leave the picker.
- A muscle cannot be both primary and secondary on one exercise.
- `position` values are contiguous from 0 after every reorder or delete.
- Only sets with `completedAt` set count towards any metric.
- `reps` is a whole number from 1 to 999. `weightKg` is from 0 to 1000, rounded to two decimals.

**Backup file format**

```json
{
  "format": "workout-tracker-backup",
  "schemaVersion": 1,
  "exportedAt": 1794268800000,
  "appVersion": "1.0.0",
  "data": {
    "exercises": [], "workouts": [], "workoutExercises": [],
    "sets": [], "templates": [], "settings": []
  }
}
```

Export includes soft-deleted rows and excludes `activeRestTimer`. Name files `workout-tracker-YYYY-MM-DD.json`.

## Metric and heatmap definitions

A countable set is one with `completedAt` set whose workout is `completed` and not soft-deleted. Warm-up sets are excluded from every metric unless a row below says otherwise. All thresholds live in `src/domain/heatmaps.ts` as named constants, so they can be tuned without touching components.

| Metric | Exact definition |
| --- | --- |
| Set count | Number of countable sets |
| Volume, kg | Sum of `weightKg × reps` over countable sets. A null weight counts as 0. Bodyweight sets count only added load. |
| Workout duration | `endedAt − startedAt`; pauses are not tracked |
| Estimated 1RM | `weightKg` when reps are 1. Otherwise `weightKg × (1 + reps / 30)` for reps 2 to 12. Above 12 reps there is no estimate. |
| Muscle sets | Per countable set: +1.0 to each primary muscle and +0.5 to each secondary muscle |
| Body-part sets | Per countable set, the highest contribution among that part's muscles, so one set never counts twice in a part |
| Weekly streak | Consecutive Monday-to-Sunday weeks with at least one completed workout, ending at the current or previous week |
| Display rounding | Weights to at most 2 decimals, e1RM to the nearest 0.5 kg, volume to whole kg with thousands separators |

**Body-part mapping:** chest = `chest`; back = `lats`, `upper_back`, `traps`, `lower_back`; shoulders = `front_delts`, `side_delts`, `rear_delts`; arms = `biceps`, `triceps`, `forearms`; legs = `glutes`, `quads`, `hamstrings`, `adductors`, `calves`; core = `abs`, `obliques`.

**Personal records.** Compute on finishing a workout, and recompute after editing or deleting one. Compare only against earlier countable sets of the same exercise. A first-ever performance sets a baseline and is not celebrated.

| Record | Rule |
| --- | --- |
| Heaviest weight | Highest `weightKg` |
| Best estimated 1RM | Highest e1RM |
| Best set volume | Highest single-set `weightKg × reps` |
| Most reps | Highest reps in a single set; tracked for bodyweight\_reps exercises only |

**Heatmap 1: training calendar.** One cell per local date, seven rows from Monday to Sunday, one column per week, covering the last 53 weeks.

- Metric toggle: sets (default), volume or duration.
- Body-part chips: All, Chest, Back, Shoulders, Arms, Legs, Core. A filter counts only sets whose primary muscles include that part.
- Level 0 means no value that day. Non-zero values are ranked against other non-zero days in the visible range: up to the 25th percentile is level 1, up to the 50th is level 2, up to the 75th is level 3, and above that is level 4.
- With fewer than four non-zero days, every non-zero day is level 2.
- The grid scrolls horizontally and opens scrolled to the current week. Tapping a day opens that day's workouts in a sheet.

**Heatmap 2: body map.** Original front and back figures made of SVG regions, each carrying `data-muscle="<MuscleId>"`.

- Range chips: 7, 30 or 90 days, where the range includes today.
- Weekly rate for a muscle is `muscleSets / (rangeDays / 7)`.
- Levels: 0 for none; 1 for below 4; 2 for 4 to below 8; 3 for 8 to below 14; 4 for 14 or more.
- Tapping a region opens its name, weekly rate, last-trained date, and top three exercises in the range.
- Provide the same data as a sorted text list below the figures, for accessibility.
- Draw the figures from scratch. Do not trace or copy anatomy charts or third-party body maps.

**Heatmap 3: muscle-by-week matrix.** Rows are the six body parts, expandable to their muscles, and columns are the last 12 calendar weeks. Cell values are that week's body-part or muscle sets, using the body-map level thresholds.

**Other charts**

- Weekly volume: bars for the last 12 weeks.
- Exercise progress: line of the best e1RM per session, switchable to heaviest weight or session volume, with 3-month, 6-month, 1-year and all-time ranges.
- Summary tiles for the current week: workouts, sets, volume and streak.

## Screens and interactions

The app has four tabs plus a full-screen workout view, and logging a completed set should take no more than two taps when the prefilled values are right.

| Route | Screen | Contents |
| --- | --- | --- |
| `/` | Today | Start empty workout, resume banner, templates, this week's tiles, backup-overdue banner |
| `/workout` | Active workout | Full-screen logger, outside the tab bar |
| `/history` | History | Reverse-chronological list grouped by week |
| `/history/:id` | Workout detail | Exercises, sets, totals, records, edit and delete |
| `/stats` | Stats | Summary tiles, calendar, body map, matrix, weekly volume |
| `/exercises` | Library | Search, muscle filter, add custom exercise |
| `/exercises/new`, `/exercises/:id/edit` | Exercise form | Name, equipment, load type, muscles, rest, increment |
| `/exercises/:id` | Exercise detail | Progress chart, records, past sessions |
| `/templates`, `/templates/:id` | Templates | List and editor, reached from Today |
| `/settings` | Settings | Backup, storage status, rest defaults, app version and update, reached from Today |

Tabs, left to right: Today, History, Stats, Exercises.

**Active workout behaviour**

- Header: title, elapsed time derived from `startedAt`, and Finish.
- Each exercise is a card with a muscle label, notes and a table of set rows.
- Set row columns: number or set-type badge, previous performance, kg, reps, complete tick.
- New rows prefill from the same position in the last completed session of that exercise, then from the previous row.
- Field values persist on blur, and the tick sets `completedAt`. Unticking clears it.
- Tick with an empty weight on a `weight_reps` exercise, or empty reps on any exercise, shows inline validation and does not complete the set.
- Add Set copies the previous row. Swipe or a menu action deletes a set, with a five-second Undo toast.
- Exercise menu: reorder, replace, remove, add note, view history.
- Finish with no completed sets offers Discard. Finish with incomplete rows offers Discard Incomplete and Keep Editing.
- Finishing shows a summary: duration, sets, volume, muscles worked and records.

**Resume behaviour**

- On every launch, if an active workout exists, route to `/workout`.
- If the active workout started more than 12 hours ago, ask whether to continue, finish at the last completed set's time, or discard.
- If that workout has no completed sets, finish is not offered.

**Rest timer**

- Completing a working set starts a timer using the template item's rest, then the exercise's rest, then the global default.
- Persist `activeRestTimer` as `{ endsAt, durationSec, workoutExerciseId }`.
- Derive remaining time from `endsAt − Date.now()`, and recalculate on `visibilitychange`.
- Show a persistent bar with −15 s, +15 s and Skip.
- At zero, play a short WebAudio tone if the app is visible and sound is enabled. Create the `AudioContext` during a tap, so iOS allows playback.
- State in the UI that alerts do not fire while the app is in the background.

**Update behaviour**

- Never activate a waiting service worker while a workout is active.
- When an update is ready and no workout is active, show Update on Today and Settings. Reload only after a tap.

**Data-safety behaviour**

- Backup overdue banner appears when completed workouts exist and `lastBackupAt` is more than 14 days old or absent.
- Store a `workout.hadData` marker in `localStorage` after the first completed workout.
- If the marker exists and the database has no workouts, show a restore screen before seeding or anything else.
- Before import, validate with Zod and show counts of records and the date range. Nothing is written until confirmed.
- Merge keeps the row with the newer `updatedAt`. Replace first offers a fresh backup, then swaps all data in one transaction.
- Catch `QuotaExceededError` and failed transactions globally, and show a blocking error with Export Backup. Never show a false saved state.

## Seed exercise library

Seed these 46 exercises on first launch, once only, using `seedVersion`. Muscle mappings drive every heatmap, so implement them exactly and let custom exercises cover anything missing.

| Exercise | Equipment | Load type | Primary | Secondary |
| --- | --- | --- | --- | --- |
| Barbell Bench Press | barbell | weight\_reps | chest | front\_delts, triceps |
| Incline Barbell Bench Press | barbell | weight\_reps | chest | front\_delts, triceps |
| Dumbbell Bench Press | dumbbell | weight\_reps | chest | front\_delts, triceps |
| Incline Dumbbell Press | dumbbell | weight\_reps | chest | front\_delts, triceps |
| Machine Chest Press | machine | weight\_reps | chest | front\_delts, triceps |
| Cable Fly | cable | weight\_reps | chest | front\_delts |
| Pec Deck | machine | weight\_reps | chest | front\_delts |
| Push-Up | bodyweight | bodyweight\_reps | chest | front\_delts, triceps, abs |
| Dip | bodyweight | bodyweight\_reps | chest, triceps | front\_delts |
| Pull-Up | bodyweight | bodyweight\_reps | lats | biceps, upper\_back |
| Chin-Up | bodyweight | bodyweight\_reps | lats, biceps | upper\_back |
| Lat Pulldown | cable | weight\_reps | lats | biceps, upper\_back |
| Barbell Row | barbell | weight\_reps | upper\_back, lats | biceps, rear\_delts, lower\_back |
| Dumbbell Row | dumbbell | weight\_reps | lats, upper\_back | biceps, rear\_delts |
| Seated Cable Row | cable | weight\_reps | upper\_back, lats | biceps, rear\_delts |
| T-Bar Row | machine | weight\_reps | upper\_back, lats | biceps, rear\_delts |
| Deadlift | barbell | weight\_reps | glutes, hamstrings, lower\_back | traps, lats, quads, forearms |
| Romanian Deadlift | barbell | weight\_reps | hamstrings, glutes | lower\_back, forearms |
| Back Extension | bodyweight | bodyweight\_reps | lower\_back | glutes, hamstrings |
| Barbell Shrug | barbell | weight\_reps | traps | forearms |
| Overhead Press | barbell | weight\_reps | front\_delts | side\_delts, triceps |
| Seated Dumbbell Press | dumbbell | weight\_reps | front\_delts | side\_delts, triceps |
| Machine Shoulder Press | machine | weight\_reps | front\_delts | side\_delts, triceps |
| Dumbbell Lateral Raise | dumbbell | weight\_reps | side\_delts | traps |
| Cable Lateral Raise | cable | weight\_reps | side\_delts | traps |
| Reverse Pec Deck | machine | weight\_reps | rear\_delts | upper\_back |
| Face Pull | cable | weight\_reps | rear\_delts | upper\_back, traps |
| Barbell Curl | barbell | weight\_reps | biceps | forearms |
| Dumbbell Curl | dumbbell | weight\_reps | biceps | forearms |
| Hammer Curl | dumbbell | weight\_reps | biceps, forearms |  |
| Cable Curl | cable | weight\_reps | biceps | forearms |
| Triceps Pushdown | cable | weight\_reps | triceps |  |
| Overhead Triceps Extension | cable | weight\_reps | triceps |  |
| Skull Crusher | barbell | weight\_reps | triceps |  |
| Back Squat | barbell | weight\_reps | quads, glutes | adductors, lower\_back, abs |
| Front Squat | barbell | weight\_reps | quads | glutes, abs, upper\_back |
| Leg Press | machine | weight\_reps | quads, glutes | adductors, hamstrings |
| Bulgarian Split Squat | dumbbell | weight\_reps | quads, glutes | adductors, hamstrings |
| Walking Lunge | dumbbell | weight\_reps | quads, glutes | adductors, hamstrings |
| Leg Extension | machine | weight\_reps | quads |  |
| Lying Leg Curl | machine | weight\_reps | hamstrings | calves |
| Hip Thrust | barbell | weight\_reps | glutes | hamstrings |
| Standing Calf Raise | machine | weight\_reps | calves |  |
| Hanging Leg Raise | bodyweight | bodyweight\_reps | abs | obliques |
| Cable Crunch | cable | weight\_reps | abs | obliques |
| Russian Twist | bodyweight | bodyweight\_reps | obliques | abs |

Use deterministic IDs of the form `seed-<slug>` so backups merge cleanly after reinstalling. Seed `defaultRestSec` as null, so the global default applies until you set one per exercise.

## Phased task list

The app reaches a real iPhone in Phase 2 and is usable for training at the end of Phase 6. Phases 0 to 9 complete v1, and Phase 10 is optional.

### Phase 0: Project foundation

- [x] Initialise a Git repository and a Vite React TypeScript project named `workout-tracker`.
- [x] Commit this plan as `docs/PLAN.md`, and create `docs/DECISIONS.md` and `docs/PROGRESS.md`.
- [x] Install the packages in the Technology stack section and commit the lockfile.
- [x] Enable TypeScript strict mode, plus `noUncheckedIndexedAccess`.
- [x] Configure ESLint, Prettier and import restrictions that enforce the `domain`, `data` and `features` boundaries.
- [x] Configure Vitest with `fake-indexeddb`.
- [x] Configure Playwright with a WebKit project using an iPhone device profile.
- [x] Add all required npm scripts, including `verify`.
- [x] Create the directories listed in the Repository structure section.
- [x] Add GitHub Actions running `npm run verify` on every push.

**Acceptance:** `npm run verify` passes on a clean clone, and a boundary-violating import fails lint.

### Phase 1: Domain and data layer

- [x] Implement `domain/types.ts` and `domain/muscles.ts` from the data model.
- [x] Implement `domain/dates.ts`: local-date formatting, ISO week starts, and week and range iteration.
- [x] Implement `domain/numbers.ts`: parse comma or point decimals, clamp and round.
- [x] Implement `data/db.ts` with schema version 1.
- [x] Implement `data/seed.ts` with the full seed table.
- [x] Implement exercise, workout, set, template and settings repositories, enforcing every invariant.
- [x] Implement `getPreviousPerformance(exerciseId, beforeWorkoutId)`.
- [x] Write unit tests for every invariant, for seeding only once, and for date behaviour across daylight-saving changes in `Europe/Stockholm`.

**Acceptance:** All listed invariants have passing tests, and a set write followed by reopening the database reads back unchanged.

### Phase 2: App shell and iPhone deployment

- [x] Build design tokens and base UI components in `src/ui`.
- [x] Build `AppShell`, `TabBar`, the routes table, placeholder screens and screen transitions under 200 ms.
- [x] Add the required `index.html` head and all native-feel CSS rules.
- [x] Create an original app icon and generate 180, 192 and 512 px PNGs plus portrait startup images.
- [x] Configure `vite-plugin-pwa`: manifest, precache of all build assets, SPA navigation fallback and `registerType: 'prompt'`.
- [x] ~~Implement `InstallGate` with step-by-step Share, Add to Home Screen instructions.~~ Built, then removed 2026-11-15 (`DECISIONS.md` row 22).
- [x] Implement `platform/storage.ts`, calling `persist()` at launch. (`platform/standalone.ts` was removed with the gate.)
- [x] ~~Add `public/_headers`: `no-cache` for `/`, `/index.html`, `/sw.js` and the manifest; one-year immutable for `/assets/*`.~~ Built, then removed 2026-11-15: GitHub Pages cannot send custom headers (`DECISIONS.md` row 23).
- [x] Add a strict Content Security Policy allowing only same-origin scripts, styles, images and connections. (Now a `<meta>` tag injected at build, row 23.)
- [x] **\[HUMAN\]** Enable GitHub Pages (repository Settings, Pages, Source: GitHub Actions) and confirm the production URL `https://imkulwant.github.io/workout-tracker-pwa/`. (Was: create a Cloudflare Pages project, row 23.)
- [x] **\[HUMAN\]** Install the deployed app on the iPhone from Safari and confirm items 2 to 5 of the iPhone acceptance checklist (item 1 was dropped).

**Acceptance:** With Airplane Mode on, the installed app launches from the Home Screen, with no browser UI and correct safe areas.

### Phase 3: Exercise library

- [x] Build the library list with search by `nameKey` and muscle-filter chips.
- [x] Build the create and edit form with muscle multi-select and overlap validation.
- [x] Enforce unique active exercise names, case-insensitively.
- [x] Implement archive and unarchive.
- [x] Build `ExercisePicker` as a sheet with recent exercises first and multi-select.
- [x] Write an end-to-end test for creating a custom exercise and finding it in the picker.

**Acceptance:** Search returns results within 100 ms on seed data, and archived exercises leave the picker but stay in history.

### Phase 4: Workout logging

- [x] Implement start, resume, finish and discard for workouts.
- [x] Build `ActiveWorkoutScreen`, `ExerciseCard` and `SetRow` to the interaction spec.
- [x] Implement persistence on blur and on tick, with no in-memory draft of committed values.
- [x] Implement prefill and previous-performance display.
- [x] Implement set types, add and delete set, Undo, and exercise reorder, replace and remove.
- [x] Implement the rest timer, its persistent bar and the foreground tone.
- [x] Implement `platform/wakeLock.ts` with re-acquire and a Settings toggle.
- [x] Implement launch routing and the 12-hour stale-workout prompt.
- [x] Build the Finish flow and summary, with record detection added in Phase 7.
- [x] Write an end-to-end test: start, log three sets, reload mid-workout, resume, finish.
- [x] Write an end-to-end test confirming `82,5` and `82.5` store the same value.

**Acceptance:** Reloading at any point loses no ticked set or blurred value, and a prefilled set completes with one tap on its tick.

### Phase 5: History and editing

- [ ] Build history grouped by Monday-start week, with date, title, duration, sets, volume and body parts.
- [ ] Virtualise or paginate so 500 workouts scroll smoothly.
- [ ] Build workout detail.
- [ ] Implement editing of sets, exercises, title, notes, date and times.
- [ ] Implement delete with confirmation and Undo.
- [ ] Write repository tests covering date changes and cascading deletes.

**Acceptance:** Changing a workout's date moves it in history and updates every one of its sets.

### Phase 6: Backup and data safety

- [ ] Implement versioned JSON export and `platform/share.ts`.
- [ ] Implement CSV export with one row per set: date, workout, exercise, set, type, kg, reps.
- [ ] Implement Zod backup validation and the import preview.
- [ ] Implement transactional Merge and Replace.
- [ ] Implement the overdue banner, `workout.hadData` marker and restore screen.
- [ ] Show storage persistence, usage and quota, and last backup date in Settings.
- [ ] Add global handling for `QuotaExceededError` and failed transactions.
- [ ] Write a round-trip test: export, clear, import, deep-equal.
- [ ] Write tests rejecting malformed files with no data written.
- [ ] **\[HUMAN\]** Save a backup to Files on the iPhone, restore it, and confirm the data matches.

**Acceptance:** A corrupt file changes nothing, and a round trip preserves every record. You can now start training with the app.

### Phase 7: Stats and heatmaps

- [ ] Implement `domain/metrics.ts`, `domain/heatmaps.ts` and `domain/records.ts` exactly to the definitions.
- [ ] Add table-driven unit tests with hand-calculated expected values for each definition and threshold boundary.
- [ ] Add a development-only seeded data generator producing two years of realistic training.
- [ ] Build `CalendarHeatmap` with metric toggle, body-part filter, horizontal scroll and day sheet.
- [ ] Draw original front and back SVG figures covering all 18 muscle IDs.
- [ ] Build `BodyMap` with range chips, tap details and text alternative.
- [ ] Build `MuscleWeekMatrix` with expandable body parts.
- [ ] Build weekly volume bars, summary tiles and exercise progress charts.
- [ ] Add records to the workout summary and exercise detail, recomputing after edits.
- [ ] Use an accessible sequential colour scale with a visible legend on every heatmap.
- [ ] Write Playwright screenshot tests for each heatmap at iPhone width using fixed data.

**Acceptance:** With two years of generated data, the Stats tab renders in under 500 ms on the deployed app, and every metric test passes.

### Phase 8: Templates

- [ ] Build template list and editor with drag or menu reorder.
- [ ] Implement starting a workout from a template, prefilled with target set counts.
- [ ] Implement saving a completed workout as a template.
- [ ] Show templates on Today, sorted by last used.
- [ ] Write an end-to-end test from template to completed workout.

**Acceptance:** A template starts a correctly ordered workout, and editing the template never changes past workouts.

### Phase 9: Hardening and release

- [ ] Implement `UpdatePrompt`, guarded so it cannot reload during an active workout.
- [ ] Add empty, loading and error states to every screen.
- [ ] Run an accessibility pass: labels on icon buttons, contrast, large-text resilience and focus order.
- [ ] Confirm no request leaves the origin at runtime, using a Playwright network assertion.
- [ ] Measure and record production bundle size, with a target below 250 KB of gzipped JavaScript.
- [ ] Write a README covering development, deployment, installation, backup and restore.
- [ ] Tag `v1.0.0` and deploy to production.
- [ ] **\[HUMAN\]** Complete the full iPhone acceptance checklist.
- [ ] **\[HUMAN\]** Log one real gym session and report defects.

**Acceptance:** All automated tests pass, every checklist item passes on the iPhone, and a real session completes without data loss.

### Phase 10: Optional sync

Start this only if a second device or automatic off-device backup becomes necessary.

- [ ] Choose a backend and write the decision in `docs/DECISIONS.md`.
- [ ] Add authentication that survives iOS web app relaunches, using an HttpOnly server-set cookie.
- [ ] Implement foreground sync on launch, on finish and on visibility change, using `updatedAt` and tombstones.
- [ ] Keep the app fully usable offline, with conflicts resolved per record by newest `updatedAt`.

**Acceptance:** Two devices converge after offline edits on both, with no duplicated workouts.

## Test plan and iPhone checklist

Automated tests cover logic and flows, but only a real iPhone can prove Home Screen behaviour. Playwright's WebKit engine does not reproduce standalone mode, the iOS keyboard or storage policy.

| Layer | Tool | Must cover |
| --- | --- | --- |
| Domain | Vitest | All metrics, heatmap thresholds, records, dates and number parsing |
| Repositories | Vitest, `fake-indexeddb` | Invariants, transactions, migrations and backup round trip |
| Flows | Playwright WebKit | Logging, resume, history edit, template start, import and export |
| Visual | Playwright screenshots | Three heatmaps and the active workout at iPhone width |
| Network | Playwright | No third-party requests, and a full offline reload after the first visit |

**iPhone acceptance checklist.** Run on the production URL.

1. ~~Safari shows the install guide instead of the logger.~~ Dropped (`DECISIONS.md` row 22): the app opens directly in a Safari tab.
2. Add to Home Screen shows the correct icon and name, with Open as Web App on.
3. The icon launches with no Safari interface, and content clears the status bar and home indicator.
4. `persist()` reports granted in Settings.
5. With Airplane Mode on, a force-quit app relaunches and opens fully.
6. Weight and reps show the right numeric keyboards, and focus does not zoom the page.
7. A comma decimal saves correctly.
8. During a logged set, switching apps and returning keeps all values and the correct rest time.
9. Force-quitting during a workout resumes it on the next launch.
10. The screen stays on during a workout with Wake Lock enabled.
11. The rest tone plays while the app is open.
12. The calendar opens at the current week, and tapping a day opens the right workouts.
13. The body map highlights the expected muscles after a known workout.
14. A deployed update waits during a workout, then appears on Today after finishing.
15. Backup saves to Files, and restoring it reproduces the same history.
16. After seven days without opening the app, all data is still present.

## Risks and sources

Data loss is the main risk, because the iPhone holds the only live copy until Phase 10 exists.

| Risk | Effect | Mitigation |
| --- | --- | --- |
| Removing the Home Screen app or clearing website data | History deleted | Backup reminder, restore screen, off-device copy in Files |
| iOS evicts storage under severe pressure | History deleted | `persist()`, loss detection, regular backups |
| Production URL changes | App appears empty on the new origin | Fix the URL in Phase 2, and restore from backup if it ever moves |
| Service worker serves a broken release | App fails offline | Prompted updates, preview deployments, cached previous version until accepted |
| iOS suspends the app between sets | Timer drift or lost input | Timestamp-derived timer, immediate writes, resume on launch |
| Rest alert missed in the background | You over-rest | Stated limitation; keep the app open with Wake Lock on |
| Heatmap thresholds do not suit your training | Misleading colours | Named constants, tuned after a few weeks of real data |

**Sources**

- [iOS PWA Compatibility](https://firt.dev/notes/pwa-ios/), updated 13 October 2026
- [WebKit: Updates to Storage Policy](https://webkit.org/blog/14403/updates-to-storage-policy/)
- [WebKit bug 237350: Home Screen app storage](https://bugs.webkit.org/show_bug.cgi?id=237350)
- [WebKit bug 254545: Wake Lock in Home Screen apps](https://bugs.webkit.org/show_bug.cgi?id=254545)
- [WebKit: News from WWDC25](https://webkit.org/?p=16993)
- [9to5Mac: Home Screen web apps stay in the EU](https://9to5mac.com/?p=936361)
