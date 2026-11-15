import type { MuscleId } from '../../domain/types'

// Original line art, drawn here from simple shapes: a front and a back figure
// on a 100 x 200 grid. Each region is given for the left half of the body and
// mirrored for the right, so the two sides can never differ. Nothing here is
// traced or copied from an anatomy chart or a third-party body map.

export interface FigureRegion {
  muscle: MuscleId
  /** The path of the left half. A centre region is the whole shape. */
  d: string
  /** Also draw the mirror image on the right. */
  mirror: boolean
}

export const SILHOUETTE = {
  head: { cx: 50, cy: 12, r: 9 },
  /** Left half of body, arm and leg; mirrored. */
  halves: [
    'M50 22 L36 26 L30 32 L30 94 L40 98 L50 98 Z',
    'M30 32 L22 35 L17 48 L15 70 L13 94 L24 97 L28 76 L34 52 Z',
    'M50 98 L35 96 L33 126 L35 150 L34 190 L44 192 L47 152 L50 126 Z',
  ],
}

export const FRONT: readonly FigureRegion[] = [
  { muscle: 'traps', d: 'M49 23 L38 26 L32 31 L40 32 L49 29 Z', mirror: true },
  {
    muscle: 'front_delts',
    d: 'M32 32 L26 34 L23 43 L29 46 L34 38 Z',
    mirror: true,
  },
  {
    muscle: 'side_delts',
    d: 'M26 34 L21 37 L18 46 L23 45 L23 43 Z',
    mirror: true,
  },
  {
    muscle: 'chest',
    d: 'M49 31 L40 32 L35 38 L34 47 Q40 53 49 51 Z',
    mirror: true,
  },
  { muscle: 'biceps', d: 'M29 47 L23 46 L20 62 L26 64 L30 56 Z', mirror: true },
  {
    muscle: 'forearms',
    d: 'M26 66 L19 64 L16 88 L22 91 L25 78 Z',
    mirror: true,
  },
  { muscle: 'abs', d: 'M49 53 L41 54 L41 82 L49 85 Z', mirror: true },
  { muscle: 'obliques', d: 'M40 54 L35 50 L34 78 L40 82 Z', mirror: true },
  { muscle: 'adductors', d: 'M49 88 L46 88 L45 124 L49 120 Z', mirror: true },
  {
    muscle: 'quads',
    d: 'M45 88 L36 86 L34 124 L38 142 L44 142 L45 126 Z',
    mirror: true,
  },
  { muscle: 'calves', d: 'M43 150 L36 148 L36 184 L42 186 Z', mirror: true },
]

export const BACK: readonly FigureRegion[] = [
  { muscle: 'traps', d: 'M49 22 L38 26 L32 32 L38 46 L49 54 Z', mirror: true },
  {
    muscle: 'rear_delts',
    d: 'M32 32 L26 34 L23 43 L29 46 L34 38 Z',
    mirror: true,
  },
  {
    muscle: 'side_delts',
    d: 'M26 34 L21 37 L18 46 L23 45 L23 43 Z',
    mirror: true,
  },
  { muscle: 'upper_back', d: 'M49 44 L40 44 L38 54 L49 58 Z', mirror: true },
  { muscle: 'lats', d: 'M48 58 L38 56 L34 62 L38 78 L48 76 Z', mirror: true },
  { muscle: 'lower_back', d: 'M49 78 L40 80 L40 90 L49 92 Z', mirror: true },
  {
    muscle: 'triceps',
    d: 'M29 47 L23 46 L20 62 L26 64 L30 56 Z',
    mirror: true,
  },
  {
    muscle: 'forearms',
    d: 'M26 66 L19 64 L16 88 L22 91 L25 78 Z',
    mirror: true,
  },
  {
    muscle: 'glutes',
    d: 'M49 94 L36 92 L34 108 L48 114 L49 108 Z',
    mirror: true,
  },
  {
    muscle: 'hamstrings',
    d: 'M47 116 L35 112 L35 142 L45 144 Z',
    mirror: true,
  },
  { muscle: 'calves', d: 'M43 150 L36 148 L36 184 L42 186 Z', mirror: true },
]

/** The matrix that mirrors the left half onto the right, about x = 50. */
export const MIRROR = 'matrix(-1 0 0 1 100 0)'
