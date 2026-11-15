import { DoseLog, AdherenceAnalytics } from '@/types';
import { format, subDays, isBefore, isAfter, startOfDay, endOfDay } from 'date-fns';

/**
 * Calculates accurate adherence metrics excluding future doses.
 * Adherence % = Confirmed doses / Total eligible past/current doses * 100
 */
export function calculateAdherenceMetrics(
  doseLogs: DoseLog[],
  daysCount: number = 7
): AdherenceAnalytics {
  const now = new Date();
  const startDate = startOfDay(subDays(now, daysCount - 1));
  const endDate = endOfDay(now);

  // Filter only eligible doses up to right now (exclude future doses)
  const eligibleLogs = doseLogs.filter(log => {
    const logDate = new Date(`${log.scheduled_date}T${log.scheduled_time}`);
    return !isBefore(logDate, startDate) && !isAfter(logDate, now);
  });

  const totalScheduled = eligibleLogs.length;
  const confirmedCount = eligibleLogs.filter(l => l.status === 'taken').length;
  const skippedCount = eligibleLogs.filter(l => l.status === 'skipped').length;
  const unconfirmedCount = eligibleLogs.filter(l => l.status === 'unconfirmed' || l.status === 'due' || l.status === 'scheduled').length;

  const adherenceRate = totalScheduled > 0 ? Math.round((confirmedCount / totalScheduled) * 100) : 100;

  // Build daily breakdown
  const weeklyTrend: AdherenceAnalytics['weeklyTrend'] = [];
  for (let i = daysCount - 1; i >= 0; i--) {
    const dayDate = subDays(now, i);
    const dateStr = format(dayDate, 'yyyy-MM-dd');
    const dayLabel = format(dayDate, 'EEE');

    const dayLogs = eligibleLogs.filter(l => l.scheduled_date === dateStr);
    const dayTotal = dayLogs.length;
    const dayConfirmed = dayLogs.filter(l => l.status === 'taken').length;
    const dayRate = dayTotal > 0 ? Math.round((dayConfirmed / dayTotal) * 100) : 100;

    weeklyTrend.push({
      date: dateStr,
      dayLabel,
      total: dayTotal,
      confirmed: dayConfirmed,
      rate: dayRate,
    });
  }

  return {
    totalScheduled,
    confirmedCount,
    skippedCount,
    unconfirmedCount,
    adherenceRate,
    weeklyTrend,
  };
}
