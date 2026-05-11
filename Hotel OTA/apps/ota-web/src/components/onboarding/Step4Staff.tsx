'use client';

import { useState } from 'react';
import { OnboardingSession, StaffInvite } from '@/lib/onboarding/api';

interface Step4StaffProps {
  initialData: Partial<OnboardingSession>;
  onComplete: (data: Partial<OnboardingSession>) => void;
  onBack: () => void;
  loading: boolean;
}

const STAFF_ROLES = [
  { value: 'manager', label: 'Manager', description: 'Full access to all hotel settings and analytics', icon: '👔' },
  { value: 'front_desk', label: 'Front Desk', description: 'Handle check-ins, check-outs, and guest requests', icon: '🛎️' },
  { value: 'housekeeping', label: 'Housekeeping', description: 'Manage room cleaning and maintenance tasks', icon: '🧹' },
  { value: 'room_service', label: 'Room Service', description: 'Handle food and beverage orders', icon: '🍽️' },
];

export function Step4Staff({ initialData, onComplete, onBack, loading }: Step4StaffProps) {
  const [invites, setInvites] = useState<StaffInvite[]>(
    initialData.staffInvites?.length
      ? initialData.staffInvites
      : [
          { email: '', role: 'manager' },
        ]
  );
  const [sending, setSending] = useState(false);
  const [errors, setErrors] = useState<Record<number, string>>({});

  const addInvite = () => {
    setInvites([...invites, { email: '', role: 'manager' }]);
  };

  const removeInvite = (index: number) => {
    if (invites.length > 1) {
      setInvites(invites.filter((_, i) => i !== index));
      const newErrors = { ...errors };
      delete newErrors[index];
      setErrors(newErrors);
    }
  };

  const updateInvite = (index: number, field: keyof StaffInvite, value: string) => {
    const updated = [...invites];
    updated[index] = { ...updated[index], [field]: value };
    setInvites(updated);

    // Clear error on change
    if (errors[index]) {
      const newErrors = { ...errors };
      delete newErrors[index];
      setErrors(newErrors);
    }
  };

  const validateEmail = (email: string): boolean => {
    if (!email.trim()) return false;
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  };

  const validate = (): boolean => {
    const newErrors: Record<number, string> = {};

    invites.forEach((invite, index) => {
      if (invite.email.trim() && !validateEmail(invite.email)) {
        newErrors[index] = 'Invalid email address';
      }
    });

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSkip = () => {
    // Save with empty invites array (skip staff setup)
    onComplete({ staffInvites: [] });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Filter out empty invites
    const validInvites = invites.filter((invite) => invite.email.trim());

    if (validInvites.length === 0) {
      // No invites to send, just skip
      onComplete({ staffInvites: [] });
      return;
    }

    if (!validate()) return;

    setSending(true);

    // Simulate sending invites - in production this calls the API
    await new Promise((resolve) => setTimeout(resolve, 1000));

    setSending(false);
    onComplete({ staffInvites: validInvites });
  };

  const hasValidEmails = invites.some((invite) => invite.email.trim());

  return (
    <div className="max-w-2xl mx-auto">
      {/* Step Header */}
      <div className="text-center mb-8">
        <div className="w-16 h-16 bg-blue-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
          <span className="text-3xl">👥</span>
        </div>
        <h1 className="text-2xl font-bold text-gray-900 mb-2">Invite your team</h1>
        <p className="text-gray-600">
          Add your staff members so they can manage bookings and guest services
        </p>
      </div>

      {/* Info Box */}
      <div className="mb-6 p-4 bg-blue-50 border border-blue-200 rounded-xl">
        <div className="flex items-start gap-3">
          <span className="text-2xl">💡</span>
          <div>
            <p className="font-semibold text-blue-800">Tip</p>
            <p className="text-sm text-blue-700">
              You can always add more team members later from your hotel dashboard.
              Staff will receive an email with login instructions.
            </p>
          </div>
        </div>
      </div>

      {/* Invites Form */}
      <form onSubmit={handleSubmit}>
        <div className="bg-white rounded-2xl shadow-lg border border-gray-100 overflow-hidden">
          {/* Roles Reference */}
          <div className="p-4 bg-gray-50 border-b border-gray-100">
            <p className="text-xs font-semibold text-gray-500 uppercase mb-3">Available Roles</p>
            <div className="grid grid-cols-2 gap-2">
              {STAFF_ROLES.map((role) => (
                <div key={role.value} className="flex items-center gap-2 text-sm">
                  <span>{role.icon}</span>
                  <span className="font-medium text-gray-700">{role.label}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Invite Rows */}
          <div className="p-4 space-y-4">
            {invites.map((invite, index) => (
              <div key={index} className="flex gap-3 items-start">
                {/* Email Input */}
                <div className="flex-1">
                  <input
                    type="email"
                    value={invite.email}
                    onChange={(e) => updateInvite(index, 'email', e.target.value)}
                    placeholder="staff@yourhotel.com"
                    className={`w-full px-4 py-3 border rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition ${
                      errors[index] ? 'border-red-300 bg-red-50' : 'border-gray-200'
                    }`}
                  />
                  {errors[index] && (
                    <p className="text-red-500 text-xs mt-1">{errors[index]}</p>
                  )}
                </div>

                {/* Role Select */}
                <select
                  value={invite.role}
                  onChange={(e) => updateInvite(index, 'role', e.target.value)}
                  className="px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition bg-white min-w-[160px]"
                >
                  {STAFF_ROLES.map((role) => (
                    <option key={role.value} value={role.value}>
                      {role.icon} {role.label}
                    </option>
                  ))}
                </select>

                {/* Remove Button */}
                <button
                  type="button"
                  onClick={() => removeInvite(index)}
                  disabled={invites.length === 1}
                  className="p-3 text-gray-400 hover:text-red-500 disabled:opacity-30 disabled:cursor-not-allowed transition"
                  title="Remove"
                >
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                  </svg>
                </button>
              </div>
            ))}
          </div>

          {/* Add More Button */}
          <div className="px-4 pb-4">
            <button
              type="button"
              onClick={addInvite}
              className="w-full py-3 border-2 border-dashed border-gray-300 rounded-xl text-gray-600 hover:border-gray-400 hover:text-gray-700 transition flex items-center justify-center gap-2"
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              Add Another Team Member
            </button>
          </div>
        </div>

        {/* Preview */}
        {hasValidEmails && (
          <div className="mt-4 p-4 bg-gray-50 rounded-xl">
            <p className="text-sm font-medium text-gray-700 mb-2">Invites will be sent to:</p>
            <div className="flex flex-wrap gap-2">
              {invites
                .filter((invite) => invite.email.trim())
                .map((invite, index) => (
                  <span
                    key={index}
                    className="px-3 py-1 bg-white border border-gray-200 rounded-full text-sm text-gray-700 flex items-center gap-1"
                  >
                    {STAFF_ROLES.find((r) => r.value === invite.role)?.icon}
                    {invite.email}
                  </span>
                ))}
            </div>
          </div>
        )}

        {/* Actions */}
        <div className="mt-8 flex flex-col gap-4">
          <button
            type="submit"
            disabled={loading || sending}
            className="w-full py-4 bg-blue-600 text-white rounded-xl font-bold text-lg hover:bg-blue-700 disabled:opacity-50 transition shadow-lg flex items-center justify-center gap-2"
          >
            {sending || loading ? (
              <>
                <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white" />
                {sending ? 'Sending Invites...' : 'Saving...'}
              </>
            ) : hasValidEmails ? (
              <>
                Send Invites & Continue
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                </svg>
              </>
            ) : (
              <>
                Continue
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
                </svg>
              </>
            )}
          </button>

          <button
            type="button"
            onClick={handleSkip}
            disabled={loading || sending}
            className="py-3 text-gray-500 hover:text-gray-700 transition text-center"
          >
            Skip for now - I'll add team members later
          </button>

          <button
            type="button"
            onClick={onBack}
            disabled={loading || sending}
            className="py-3 border border-gray-200 text-gray-700 rounded-xl font-semibold hover:bg-gray-50 transition"
          >
            ← Back
          </button>
        </div>
      </form>
    </div>
  );
}
