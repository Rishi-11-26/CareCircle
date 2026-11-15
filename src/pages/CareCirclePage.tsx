import React, { useState } from 'react';
import { useCare } from '@/contexts/CareContext';
import { InviteModal } from '@/components/care-circle/InviteModal';
import { JoinCircleModal } from '@/components/care-circle/JoinCircleModal';
import {
  Users,
  ShieldCheck,
  KeyRound,
  UserCheck,
  Mail,
  Phone,
  Lock,
  Plus,
  Sparkles,
  CheckCircle2,
} from 'lucide-react';
import { format } from 'date-fns';

export const CareCirclePage: React.FC = () => {
  const { careMembers, careProfile, currentUser } = useCare();
  const [isInviteModalOpen, setIsInviteModalOpen] = useState(false);
  const [isJoinModalOpen, setIsJoinModalOpen] = useState(false);

  const isOwner = currentUser.role === 'elderly';

  return (
    <div className="space-y-8 animate-in fade-in duration-300">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-stone pb-5">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="font-serif text-3xl sm:text-4xl font-bold text-forest">
              Care Circle Roster
            </h1>
            <span className="text-xs px-2.5 py-0.5 rounded-full bg-forest text-ivory font-semibold">
              Passcode Protected
            </span>
          </div>
          <p className="text-sm text-charcoal-light mt-1 max-w-xl">
            Authorized family members and caretakers coordinating care for{' '}
            <strong>{careProfile?.full_name}</strong>. Access is controlled by cryptographically hashed passcodes.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setIsJoinModalOpen(true)}
            className="px-4 py-2.5 rounded-xl border border-stone bg-white text-charcoal text-xs font-semibold hover:bg-stone-light shadow-warm-sm"
          >
            Redeem Passcode
          </button>
          <button
            onClick={() => setIsInviteModalOpen(true)}
            className="inline-flex items-center gap-1.5 px-5 py-2.5 rounded-xl bg-forest text-ivory text-xs font-bold hover:bg-forest-light shadow-warm touch-target-elderly"
          >
            <KeyRound className="w-4 h-4" />
            <span>Generate Passcode</span>
          </button>
        </div>
      </div>

      {/* Member Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {careMembers.map(member => {
          const profile = member.profile;
          const isCurrent = member.user_id === currentUser.id;

          return (
            <div
              key={member.id}
              className={`bg-white border rounded-2xl p-6 shadow-warm-sm flex flex-col justify-between space-y-4 ${
                member.role === 'owner'
                  ? 'border-forest/40 ring-1 ring-forest/20'
                  : 'border-stone'
              }`}
            >
              <div className="space-y-3">
                <div className="flex items-start justify-between">
                  <div className="w-12 h-12 rounded-full bg-cream-light border border-stone flex items-center justify-center font-serif text-lg font-bold text-forest">
                    {profile?.full_name?.split(' ').map(n => n[0]).join('') || 'U'}
                  </div>
                  <span
                    className={`text-xs px-2.5 py-0.5 rounded-full font-bold uppercase tracking-wider ${
                      member.role === 'owner'
                        ? 'bg-forest text-ivory'
                        : member.role === 'caretaker'
                        ? 'bg-sage/40 text-forest'
                        : 'bg-stone text-charcoal'
                    }`}
                  >
                    {member.role === 'owner' ? 'Profile Owner' : member.role}
                  </span>
                </div>

                <div>
                  <h3 className="font-serif text-xl font-bold text-charcoal">
                    {profile?.full_name || 'Care Member'}
                    {isCurrent && (
                      <span className="text-xs font-sans font-normal text-forest ml-2">
                        (You)
                      </span>
                    )}
                  </h3>
                  <p className="text-xs text-charcoal-muted flex items-center gap-1.5 mt-0.5">
                    <Mail className="w-3.5 h-3.5" />
                    {profile?.email || 'user@circle.org'}
                  </p>
                  {profile?.phone && (
                    <p className="text-xs text-charcoal-muted flex items-center gap-1.5 mt-0.5">
                      <Phone className="w-3.5 h-3.5" />
                      {profile.phone}
                    </p>
                  )}
                </div>

                {/* Role Permissions List */}
                <div className="space-y-1.5 pt-2 border-t border-stone/50 text-xs text-charcoal-light">
                  <span className="text-[11px] font-semibold text-charcoal uppercase tracking-wider block">
                    Authorized Capabilities:
                  </span>
                  <div className="space-y-1">
                    <div className="flex items-center gap-1.5">
                      <CheckCircle2 className="w-3.5 h-3.5 text-forest" />
                      <span>View daily medication schedule & adherence</span>
                    </div>
                    {member.can_manage_medications && (
                      <div className="flex items-center gap-1.5">
                        <CheckCircle2 className="w-3.5 h-3.5 text-forest" />
                        <span>Add & modify medication prescriptions</span>
                      </div>
                    )}
                    {member.can_manage_appointments && (
                      <div className="flex items-center gap-1.5">
                        <CheckCircle2 className="w-3.5 h-3.5 text-forest" />
                        <span>Manage doctor consultations</span>
                      </div>
                    )}
                    {member.can_acknowledge_alerts && (
                      <div className="flex items-center gap-1.5">
                        <CheckCircle2 className="w-3.5 h-3.5 text-forest" />
                        <span>Acknowledge missed-dose alerts</span>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              <div className="pt-3 border-t border-stone/50 flex items-center justify-between text-[11px] text-charcoal-muted">
                <span>Joined {format(new Date(member.joined_at), 'MMM d, yyyy')}</span>
                <span className="text-forest font-semibold">Active Member</span>
              </div>
            </div>
          );
        })}
      </div>

      {/* Passcode Security Information Box */}
      <div className="bg-cream-light border border-stone p-6 rounded-2xl shadow-warm-sm space-y-3">
        <div className="flex items-center gap-2 text-forest font-bold text-sm">
          <Lock className="w-4 h-4" />
          <span>Zero-Knowledge Passcode Authorization Architecture</span>
        </div>
        <p className="text-xs text-charcoal-light leading-relaxed">
          CareCircle implements secure passcode access designed for high elderly usability. When generating an invitation, an 8-character random passcode (e.g. <span className="font-mono font-bold text-forest">CARE-8924</span>) is generated. The database strictly stores the computed SHA-256 cryptographic digest. Raw passcodes are never stored, preventing credential leak even in the event of an unauthorized database read.
        </p>
      </div>

      {isInviteModalOpen && (
        <InviteModal
          isOpen={isInviteModalOpen}
          onClose={() => setIsInviteModalOpen(false)}
        />
      )}

      {isJoinModalOpen && (
        <JoinCircleModal
          isOpen={isJoinModalOpen}
          onClose={() => setIsJoinModalOpen(false)}
        />
      )}
    </div>
  );
};
