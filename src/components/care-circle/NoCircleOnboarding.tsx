import React, { useState } from 'react';
import { useCare } from '@/contexts/CareContext';
import { Heart, KeyRound, UserPlus, Sparkles, AlertCircle, CheckCircle2 } from 'lucide-react';
import { AssistanceLevel } from '@/types';

export const NoCircleOnboarding: React.FC = () => {
  const { currentUser, redeemInvitation, createCareProfile, setDemoMode } = useCare();

  const [activeTab, setActiveTab] = useState<'join' | 'create'>('join');

  // Join State
  const [passcode, setPasscode] = useState('');
  const [joinLoading, setJoinLoading] = useState(false);
  const [joinError, setJoinError] = useState<string | null>(null);
  const [joinSuccess, setJoinSuccess] = useState<string | null>(null);

  // Create State
  const defaultTz =
    typeof Intl !== 'undefined'
      ? Intl.DateTimeFormat().resolvedOptions().timeZone || 'America/Los_Angeles'
      : 'America/Los_Angeles';

  const [formData, setFormData] = useState({
    fullName: '',
    preferredName: '',
    dateOfBirth: '',
    bloodGroup: '',
    allergies: '',
    emergencyPhone: '',
    address: '',
    medicalNotes: '',
    assistanceLevel: 'independent' as AssistanceLevel,
    timezone: defaultTz,
  });
  const [createLoading, setCreateLoading] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);

  const handleJoin = async (e: React.FormEvent) => {
    e.preventDefault();
    setJoinError(null);
    setJoinSuccess(null);

    const cleanCode = passcode.trim().toUpperCase();
    if (cleanCode.length < 6) {
      setJoinError('Please enter a valid 6 to 8 character invitation passcode.');
      return;
    }

    setJoinLoading(true);
    try {
      const res = await redeemInvitation(cleanCode);
      if (!res.success) {
        setJoinError(res.error || 'Failed to redeem invitation passcode.');
      } else {
        setJoinSuccess('Successfully joined Care Circle! Loading profile...');
      }
    } catch (err: any) {
      setJoinError(err.message || 'An unexpected error occurred while redeeming passcode.');
    } finally {
      setJoinLoading(false);
    }
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreateError(null);

    if (!formData.fullName.trim()) {
      setCreateError('Senior full name is required.');
      return;
    }

    setCreateLoading(true);
    try {
      const allergiesList = formData.allergies
        ? formData.allergies
            .split(',')
            .map(s => s.trim())
            .filter(Boolean)
        : [];

      await createCareProfile({
        fullName: formData.fullName,
        preferredName: formData.preferredName || undefined,
        dateOfBirth: formData.dateOfBirth || undefined,
        bloodGroup: formData.bloodGroup || undefined,
        allergies: allergiesList,
        emergencyPhone: formData.emergencyPhone || undefined,
        address: formData.address || undefined,
        medicalNotes: formData.medicalNotes || undefined,
        assistanceLevel: formData.assistanceLevel,
        timezone: formData.timezone,
      });
    } catch (err: any) {
      setCreateError(err.message || 'Failed to create care profile.');
    } finally {
      setCreateLoading(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto py-8 px-4 animate-in fade-in duration-300">
      <div className="bg-white border-2 border-stone rounded-3xl shadow-warm overflow-hidden">
        {/* Header */}
        <div className="bg-forest text-ivory p-6 sm:p-8 text-center relative">
          <div className="w-16 h-16 rounded-2xl bg-ivory/10 border border-ivory/20 flex items-center justify-center mx-auto mb-4 text-sage-light">
            <Heart className="w-8 h-8 fill-current" />
          </div>
          <h1 className="font-serif text-3xl sm:text-4xl font-bold tracking-tight mb-2">
            Welcome to CareCircle
          </h1>
          <p className="text-sage-light text-sm sm:text-base max-w-md mx-auto">
            Hello, <span className="font-semibold text-ivory">{currentUser?.full_name || 'Member'}</span>.
            To begin connected care, join an existing circle with a passcode or create a new care profile.
          </p>
        </div>

        {/* Tab Toggle */}
        <div className="grid grid-cols-2 p-3 bg-stone-light border-b border-stone gap-2">
          <button
            type="button"
            onClick={() => setActiveTab('join')}
            className={`flex items-center justify-center gap-2 py-3 px-4 rounded-xl text-sm font-bold transition-all cursor-pointer min-h-[48px] ${
              activeTab === 'join'
                ? 'bg-white text-forest shadow-warm-sm border border-stone'
                : 'text-charcoal-muted hover:text-charcoal'
            }`}
          >
            <KeyRound className="w-4 h-4" />
            <span>Join with Passcode</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('create')}
            className={`flex items-center justify-center gap-2 py-3 px-4 rounded-xl text-sm font-bold transition-all cursor-pointer min-h-[48px] ${
              activeTab === 'create'
                ? 'bg-white text-forest shadow-warm-sm border border-stone'
                : 'text-charcoal-muted hover:text-charcoal'
            }`}
          >
            <UserPlus className="w-4 h-4" />
            <span>Create New Profile</span>
          </button>
        </div>

        {/* Tab Content */}
        <div className="p-6 sm:p-8">
          {activeTab === 'join' ? (
            <form onSubmit={handleJoin} className="space-y-6">
              <div className="space-y-2">
                <label
                  htmlFor="passcode-input"
                  className="block text-sm font-bold text-charcoal"
                >
                  Invitation Passcode
                </label>
                <p className="text-xs text-charcoal-muted">
                  Enter the secure 6 to 8 character passcode provided by your family administrator or care coordinator.
                </p>
                <input
                  id="passcode-input"
                  type="text"
                  value={passcode}
                  onChange={e => setPasscode(e.target.value.toUpperCase())}
                  placeholder="e.g. CC-7842"
                  maxLength={12}
                  className="w-full px-4 py-3 text-lg font-mono tracking-widest uppercase rounded-xl border-2 border-stone focus:border-forest focus:ring-2 focus:ring-forest/20 outline-none transition-all min-h-[52px]"
                  required
                />
              </div>

              {joinError && (
                <div className="p-3.5 rounded-xl bg-terracotta/10 border border-terracotta/30 flex items-start gap-3 text-terracotta text-sm">
                  <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" />
                  <span>{joinError}</span>
                </div>
              )}

              {joinSuccess && (
                <div className="p-3.5 rounded-xl bg-forest/10 border border-forest/30 flex items-start gap-3 text-forest text-sm font-semibold">
                  <CheckCircle2 className="w-5 h-5 shrink-0 mt-0.5" />
                  <span>{joinSuccess}</span>
                </div>
              )}

              <button
                type="submit"
                disabled={joinLoading}
                className="w-full py-3.5 px-6 rounded-xl bg-forest hover:bg-forest-light text-ivory font-bold text-base shadow-warm transition-all cursor-pointer disabled:opacity-50 min-h-[52px] flex items-center justify-center gap-2"
              >
                {joinLoading ? (
                  <>
                    <div className="w-5 h-5 border-2 border-ivory/30 border-t-ivory rounded-full animate-spin" />
                    <span>Verifying Passcode...</span>
                  </>
                ) : (
                  <>
                    <KeyRound className="w-5 h-5" />
                    <span>Join Care Circle</span>
                  </>
                )}
              </button>
            </form>
          ) : (
            <form onSubmit={handleCreate} className="space-y-4">
              <div className="space-y-1.5">
                <label className="block text-xs font-bold text-charcoal uppercase tracking-wider">
                  Senior Full Name *
                </label>
                <input
                  type="text"
                  value={formData.fullName}
                  onChange={e => setFormData({ ...formData, fullName: e.target.value })}
                  placeholder="e.g. Margaret Hayes"
                  className="w-full px-3.5 py-2.5 text-sm rounded-xl border-2 border-stone focus:border-forest focus:ring-2 focus:ring-forest/20 outline-none min-h-[48px]"
                  required
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <label className="block text-xs font-bold text-charcoal uppercase tracking-wider">
                    Preferred Name
                  </label>
                  <input
                    type="text"
                    value={formData.preferredName}
                    onChange={e => setFormData({ ...formData, preferredName: e.target.value })}
                    placeholder="e.g. Margaret"
                    className="w-full px-3.5 py-2.5 text-sm rounded-xl border-2 border-stone focus:border-forest focus:ring-2 focus:ring-forest/20 outline-none min-h-[48px]"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="block text-xs font-bold text-charcoal uppercase tracking-wider">
                    Date of Birth
                  </label>
                  <input
                    type="date"
                    value={formData.dateOfBirth}
                    onChange={e => setFormData({ ...formData, dateOfBirth: e.target.value })}
                    className="w-full px-3.5 py-2.5 text-sm rounded-xl border-2 border-stone focus:border-forest focus:ring-2 focus:ring-forest/20 outline-none min-h-[48px]"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <label className="block text-xs font-bold text-charcoal uppercase tracking-wider">
                    Emergency Phone
                  </label>
                  <input
                    type="tel"
                    value={formData.emergencyPhone}
                    onChange={e => setFormData({ ...formData, emergencyPhone: e.target.value })}
                    placeholder="(555) 876-5432"
                    className="w-full px-3.5 py-2.5 text-sm rounded-xl border-2 border-stone focus:border-forest focus:ring-2 focus:ring-forest/20 outline-none min-h-[48px]"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="block text-xs font-bold text-charcoal uppercase tracking-wider">
                    Assistance Level
                  </label>
                  <select
                    value={formData.assistanceLevel}
                    onChange={e =>
                      setFormData({
                        ...formData,
                        assistanceLevel: e.target.value as AssistanceLevel,
                      })
                    }
                    className="w-full px-3.5 py-2.5 text-sm rounded-xl border-2 border-stone focus:border-forest focus:ring-2 focus:ring-forest/20 outline-none min-h-[48px] bg-white"
                  >
                    <option value="independent">Independent (Self-managed)</option>
                    <option value="needs_assistance">Needs Assistance (Coordinated)</option>
                    <option value="full_care">Full Care (Direct assistance)</option>
                  </select>
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="block text-xs font-bold text-charcoal uppercase tracking-wider">
                  Allergies (comma-separated)
                </label>
                <input
                  type="text"
                  value={formData.allergies}
                  onChange={e => setFormData({ ...formData, allergies: e.target.value })}
                  placeholder="e.g. Penicillin, Sulfa Antibiotics"
                  className="w-full px-3.5 py-2.5 text-sm rounded-xl border-2 border-stone focus:border-forest focus:ring-2 focus:ring-forest/20 outline-none min-h-[48px]"
                />
              </div>

              <div className="space-y-1.5">
                <label className="block text-xs font-bold text-charcoal uppercase tracking-wider">
                  Care Profile Timezone (IANA)
                </label>
                <input
                  type="text"
                  value={formData.timezone}
                  onChange={e => setFormData({ ...formData, timezone: e.target.value })}
                  placeholder="America/Los_Angeles"
                  className="w-full px-3.5 py-2.5 text-sm rounded-xl border-2 border-stone focus:border-forest focus:ring-2 focus:ring-forest/20 outline-none min-h-[48px]"
                  required
                />
              </div>

              {createError && (
                <div className="p-3.5 rounded-xl bg-terracotta/10 border border-terracotta/30 flex items-start gap-3 text-terracotta text-sm">
                  <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" />
                  <span>{createError}</span>
                </div>
              )}

              <button
                type="submit"
                disabled={createLoading}
                className="w-full mt-2 py-3.5 px-6 rounded-xl bg-forest hover:bg-forest-light text-ivory font-bold text-base shadow-warm transition-all cursor-pointer disabled:opacity-50 min-h-[52px] flex items-center justify-center gap-2"
              >
                {createLoading ? (
                  <>
                    <div className="w-5 h-5 border-2 border-ivory/30 border-t-ivory rounded-full animate-spin" />
                    <span>Creating Care Profile...</span>
                  </>
                ) : (
                  <>
                    <UserPlus className="w-5 h-5" />
                    <span>Create Care Profile</span>
                  </>
                )}
              </button>
            </form>
          )}

          {/* Demo Mode Shortcut */}
          <div className="mt-8 pt-6 border-t border-stone/80 text-center">
            <button
              type="button"
              onClick={() => setDemoMode(true)}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold text-forest bg-forest/5 hover:bg-forest/10 border border-forest/20 transition-all cursor-pointer"
            >
              <Sparkles className="w-3.5 h-3.5 text-terracotta" />
              <span>Explore Demo Mode</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
