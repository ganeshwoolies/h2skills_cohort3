import React, { useState, useEffect } from 'react';
import {
  X,
  Share2,
  ShieldCheck,
  UserCheck,
  Trash2,
  AlertCircle,
  CheckCircle2,
  Clock,
  ExternalLink,
} from 'lucide-react';
import type { ReflectionCompassReport, TrustedPerson, ShareGrant } from '../types';
import {
  apiListTrustedPeople,
  apiListReportShares,
  apiShareReport,
  apiRevokeReportShare,
} from '../lib/api';

interface ShareReportModalProps {
  isOpen: boolean;
  onClose: () => void;
  report: ReflectionCompassReport | null;
  onNavigateToTrustedPeople?: () => void;
}

export const ShareReportModal: React.FC<ShareReportModalProps> = ({
  isOpen,
  onClose,
  report,
  onNavigateToTrustedPeople,
}) => {
  const [trustedPeople, setTrustedPeople] = useState<TrustedPerson[]>([]);
  const [activeShares, setActiveShares] = useState<ShareGrant[]>([]);
  const [selectedPersonId, setSelectedPersonId] = useState<string>('');
  const [loading, setLoading] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen || !report) return;

    let isMounted = true;
    const loadData = async () => {
      setLoading(true);
      setError(null);
      setSuccessMessage(null);
      try {
        const [people, shares] = await Promise.all([
          apiListTrustedPeople(),
          apiListReportShares(report.id),
        ]);
        if (isMounted) {
          const activeOnly = people.filter((p) => p.status === 'active');
          setTrustedPeople(activeOnly);
          setActiveShares(shares.filter((s) => s.status === 'active'));
          if (activeOnly.length > 0) {
            setSelectedPersonId(activeOnly[0].id);
          }
        }
      } catch (err: any) {
        if (isMounted) {
          console.error('Failed to load sharing details:', err);
          setError(err?.message || 'Failed to load sharing details.');
        }
      } finally {
        if (isMounted) setLoading(false);
      }
    };

    loadData();
    return () => {
      isMounted = false;
    };
  }, [isOpen, report]);

  if (!isOpen || !report) return null;

  const handleShare = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedPersonId) return;

    setActionLoading(true);
    setError(null);
    setSuccessMessage(null);

    try {
      const grant = await apiShareReport(report.id, selectedPersonId);
      setActiveShares((prev) => [grant, ...prev]);
      const person = trustedPeople.find((p) => p.id === selectedPersonId);
      setSuccessMessage(
        `Granted read-only access to ${person ? person.displayName : 'trusted person'}.`
      );
    } catch (err: any) {
      console.error('Error sharing report:', err);
      setError(err?.message || 'Failed to share report.');
    } finally {
      setActionLoading(false);
    }
  };

  const handleRevoke = async (grantId: string) => {
    if (!confirm('Revoke access for this person? They will no longer be able to view this report.')) {
      return;
    }

    setActionLoading(true);
    setError(null);
    setSuccessMessage(null);

    try {
      await apiRevokeReportShare(report.id, grantId);
      setActiveShares((prev) => prev.filter((s) => s.id !== grantId));
      setSuccessMessage('Access revoked successfully.');
    } catch (err: any) {
      console.error('Error revoking share:', err);
      setError(err?.message || 'Failed to revoke access.');
    } finally {
      setActionLoading(false);
    }
  };

  // Filter out people who already have active grants for this report
  const availablePeople = trustedPeople.filter(
    (person) => !activeShares.some((grant) => grant.viewerEmail.toLowerCase() === person.email.toLowerCase())
  );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs">
      <div className="bg-white rounded-2xl border border-slate-200/90 shadow-xl max-w-lg w-full p-6 space-y-6 max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center">
              <Share2 className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900">
                Share Reflection Compass
              </h3>
              <p className="text-xs text-slate-500 line-clamp-1">
                {report.title}
              </p>
            </div>
          </div>
          <button
            id="share-modal-close-btn"
            onClick={onClose}
            className="p-1 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Privacy Invariant Banner */}
        <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200/80 text-xs text-slate-600 space-y-1.5">
          <div className="flex items-center gap-1.5 font-semibold text-slate-800">
            <ShieldCheck className="w-4 h-4 text-emerald-600" />
            <span>Privacy Guarded Sharing</span>
          </div>
          <p className="text-[11px] leading-relaxed text-slate-500">
            Trusted people receive strictly read-only access to this specific Compass synthesis. They will never see your raw chat sessions, private journal entries, or other reports.
          </p>
        </div>

        {/* Status Alerts */}
        {error && (
          <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-xs text-rose-700 flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0 text-rose-600" />
            <span>{error}</span>
          </div>
        )}

        {successMessage && (
          <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-xs text-emerald-800 flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-600" />
            <span>{successMessage}</span>
          </div>
        )}

        {/* Grant Access Section */}
        <div className="space-y-3 pt-1">
          <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider">
            Grant Access
          </h4>

          {loading ? (
            <div className="text-xs text-slate-400 py-3">Loading trusted contacts...</div>
          ) : trustedPeople.length === 0 ? (
            <div className="p-4 rounded-xl border border-dashed border-slate-200 text-center space-y-2">
              <p className="text-xs text-slate-500">
                You have not added any trusted people yet.
              </p>
              <button
                type="button"
                onClick={() => {
                  onClose();
                  onNavigateToTrustedPeople();
                }}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-indigo-600 bg-indigo-50 hover:bg-indigo-100 transition-colors cursor-pointer"
              >
                <UserCheck className="w-3.5 h-3.5" />
                <span>Manage Trusted People</span>
              </button>
            </div>
          ) : availablePeople.length === 0 ? (
            <p className="text-xs text-slate-500 italic">
              All of your active trusted contacts currently have access to this report.
            </p>
          ) : (
            <form onSubmit={handleShare} className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                  Select Trusted Person
                </label>
                <select
                  id="share-select-person"
                  value={selectedPersonId}
                  onChange={(e) => setSelectedPersonId(e.target.value)}
                  className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:ring-1 focus:ring-slate-900"
                  required
                >
                  {availablePeople.map((person) => (
                    <option key={person.id} value={person.id}>
                      {person.displayName} ({person.email})
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex justify-end">
                <button
                  type="submit"
                  id="submit-share-btn"
                  disabled={actionLoading || !selectedPersonId}
                  className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold text-white bg-slate-900 hover:bg-slate-800 disabled:opacity-50 transition-all cursor-pointer shadow-xs"
                >
                  <Share2 className="w-3.5 h-3.5" />
                  <span>{actionLoading ? 'Granting Access...' : 'Grant Read-Only Access'}</span>
                </button>
              </div>
            </form>
          )}
        </div>

        {/* Existing Active Shares */}
        <div className="space-y-3 pt-3 border-t border-slate-100">
          <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider">
            Active Grants for this Report ({activeShares.length})
          </h4>

          {activeShares.length === 0 ? (
            <p className="text-xs text-slate-400 italic">
              No one currently has access to this report.
            </p>
          ) : (
            <div className="space-y-2">
              {activeShares.map((grant) => (
                <div
                  key={grant.id}
                  className="p-3 rounded-xl bg-slate-50 border border-slate-200/80 flex items-center justify-between gap-3"
                >
                  <div className="min-w-0">
                    <p className="text-xs font-semibold text-slate-900 truncate">
                      {grant.viewerEmail}
                    </p>
                    <p className="text-[11px] text-slate-400 flex items-center gap-1 mt-0.5">
                      <Clock className="w-3 h-3 text-slate-400" />
                      <span>
                        Granted on {new Date(grant.grantedAt).toLocaleDateString()}
                      </span>
                    </p>
                  </div>

                  <button
                    onClick={() => handleRevoke(grant.id)}
                    disabled={actionLoading}
                    className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer"
                    title="Revoke access"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
