import { Screen } from '../../ui/Screen'
import { CalendarHeatmap } from './CalendarHeatmap'
import { SummaryTiles } from './SummaryTiles'
import { useStatsData } from './useStatsData'

/** `/stats`: this week's totals and the heatmaps. */
export function StatsScreen() {
  const data = useStatsData()
  if (data === undefined) return null
  return (
    <Screen title="Stats">
      <SummaryTiles data={data} />
      <CalendarHeatmap data={data} />
    </Screen>
  )
}
