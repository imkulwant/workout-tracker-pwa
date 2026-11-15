import { Screen } from '../../ui/Screen'
import { BodyMap } from './BodyMap'
import { CalendarHeatmap } from './CalendarHeatmap'
import { MuscleWeekMatrix } from './MuscleWeekMatrix'
import { SummaryTiles } from './SummaryTiles'
import { useStatsData } from './useStatsData'
import { VolumeBars } from './VolumeBars'

/** `/stats`: this week's totals and the heatmaps. */
export function StatsScreen() {
  const data = useStatsData()
  if (data === undefined) return null
  return (
    <Screen title="Stats">
      <SummaryTiles data={data} />
      <CalendarHeatmap data={data} />
      <BodyMap data={data} />
      <MuscleWeekMatrix data={data} />
      <VolumeBars data={data} />
    </Screen>
  )
}
