import { describe, it, expect } from 'vitest';
import { calculateAdherenceMetrics } from '@/lib/analytics';
import { DoseLog } from '@/types';
import { format, subDays, addDays } from 'date-fns';

describe('Adherence Analytics Engine', () => {
  const today = format(new Date(), 'yyyy-MM-dd');
  const yesterday = format(subDays(new Date(), 1), 'yyyy-MM-dd');
  const futureDate = format(addDays(new Date(), 2), 'yyyy-MM-dd');

  it('calculates adherence rate strictly on eligible non-future doses', () => {
    const mockLogs: DoseLog[] = [
      {
        id: '1',
        care_profile_id: 'cp1',
        medication_id: 'm1',
        dose_identity: 'd1',
        scheduled_date: yesterday,
        scheduled_time: '08:00',
        status: 'taken',
      },
      {
        id: '2',
        care_profile_id: 'cp1',
        medication_id: 'm1',
        dose_identity: 'd2',
        scheduled_date: yesterday,
        scheduled_time: '20:00',
        status: 'skipped',
      },
      {
        id: '3',
        care_profile_id: 'cp1',
        medication_id: 'm1',
        dose_identity: 'd3',
        scheduled_date: today,
        scheduled_time: '08:00',
        status: 'taken',
      },
      // Future dose should be strictly excluded from the adherence calculation denominator!
      {
        id: '4',
        care_profile_id: 'cp1',
        medication_id: 'm1',
        dose_identity: 'd4',
        scheduled_date: futureDate,
        scheduled_time: '08:00',
        status: 'scheduled',
      },
    ];

    const metrics = calculateAdherenceMetrics(mockLogs, 7);

    // 3 eligible doses: 2 taken, 1 skipped. Adherence = 2/3 = 67%
    expect(metrics.totalScheduled).toBe(3);
    expect(metrics.confirmedCount).toBe(2);
    expect(metrics.skippedCount).toBe(1);
    expect(metrics.adherenceRate).toBe(67);
  });

  it('returns 100% when there are zero scheduled doses (graceful empty state)', () => {
    const metrics = calculateAdherenceMetrics([], 7);
    expect(metrics.totalScheduled).toBe(0);
    expect(metrics.adherenceRate).toBe(100);
    expect(metrics.weeklyTrend.length).toBe(7);
  });
});
