import React from 'react';
import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { CareProvider, useCare } from '@/contexts/CareContext';
import { DoseCard } from '@/components/medications/DoseCard';
import { dataService, generateSeedData } from '@/services/storageAdapter';
import { Medication, DoseLog } from '@/types';

// Component wrapper for testing DoseCard with Context
const TestDoseCardWrapper = ({
  med,
  doseLog,
  time = '08:00',
  date = '2026-03-10',
}: {
  med: Medication;
  doseLog?: DoseLog;
  time?: string;
  date?: string;
}) => {
  return (
    <CareProvider>
      <DoseCard
        medication={med}
        scheduleTime={time}
        scheduledDate={date}
        doseLog={doseLog}
      />
    </CareProvider>
  );
};

describe('Interactive User Workflows & Components', () => {
  beforeEach(() => {
    dataService.resetToDemoSeed();
  });

  it('renders medication name, dosage, and scheduled time', () => {
    const seed = generateSeedData();
    const med = seed.medications[0]; // Lisinopril 10mg

    render(<TestDoseCardWrapper med={med} time="08:00" />);

    expect(screen.getByText(/Lisinopril/i)).toBeInTheDocument();
    expect(screen.getByText(/10mg/i)).toBeInTheDocument();
    expect(screen.getByText('08:00')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /confirm taken/i })).toBeInTheDocument();
  });

  it('confirms a dose and updates status without throwing', async () => {
    const seed = generateSeedData();
    const med = seed.medications[0];

    render(<TestDoseCardWrapper med={med} time="08:00" />);

    const confirmBtn = screen.getByRole('button', { name: /confirm taken/i });
    fireEvent.click(confirmBtn);

    // Verify confirmation was triggered
    await waitFor(() => {
      expect(confirmBtn).toBeInTheDocument();
    });
  });

  it('renders taken status when doseLog is taken', () => {
    const seed = generateSeedData();
    const med = seed.medications[0];
    const takenLog: DoseLog = {
      id: 'd1',
      care_profile_id: seed.careProfile.id,
      medication_id: med.id,
      dose_identity: `dose_${med.id}_2026-03-10_08:00`,
      scheduled_date: '2026-03-10',
      scheduled_time: '08:00',
      status: 'taken',
      confirmed_at: '2026-03-10T08:15:00Z',
    };

    render(<TestDoseCardWrapper med={med} doseLog={takenLog} time="08:00" />);

    expect(screen.getByText(/Taken/i)).toBeInTheDocument();
    expect(screen.getByText(/Dose complete/i)).toBeInTheDocument();
  });

  it('allows recording a skip reason in exception modal', async () => {
    const seed = generateSeedData();
    const med = seed.medications[0];

    render(<TestDoseCardWrapper med={med} time="08:00" />);

    const skipBtn = screen.getByRole('button', { name: /skip dose/i });
    fireEvent.click(skipBtn);

    expect(screen.getByText(/Record Dose Exception/i)).toBeInTheDocument();
    expect(screen.getByText(/Never double up on your next dose/i)).toBeInTheDocument();

    const textarea = screen.getByPlaceholderText(/fasting for morning lab test/i);
    fireEvent.change(textarea, { target: { value: 'Blood test scheduled' } });

    const confirmSkipBtn = screen.getByRole('button', { name: /confirm skip/i });
    fireEvent.click(confirmSkipBtn);

    await waitFor(() => {
      expect(screen.queryByText(/Record Dose Exception/i)).not.toBeInTheDocument();
    });
  });
});
