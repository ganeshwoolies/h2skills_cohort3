import React, { useState, useEffect } from 'react';
import {
  Users,
  UserPlus,
  Trash2,
  ShieldCheck,
  Mail,
  User,
  Clock,
  ExternalLink,
  AlertCircle,
  CheckCircle2,
  Eye,
  Inbox,
  Lock,
} from 'lucide-react';
import type { TrustedPerson, ShareGrant, SharedReportView } from '../types';
import {
  apiListTrustedPeople,
  apiCreateTrustedPerson,
  apiRevokeTrustedPerson,
  apiListSharedWithMe,
  apiGetSharedReport,
} from '../lib/api';
import { SharedReportModal } from './SharedReportModal';

interface TrustedPeopleViewProps {
  onBackToDashboard?: () => void;
  onViewSharedReport?: (grantId: string) => void;
}

export const TrustedPeopleView: React.FC<TrustedPeopleViewProps> = ({
  onBackToDashboard,
  onViewSharedReport,
}) => {
  const [activeTab, setActiveTab] = useState<'trusted' | 'shared_with_me'>('trusted');

  // Trusted People state
  const [trustedPeople, setTrustedPeople] = useState<TrustedPerson[]>([]);
  const [loadingPeople, setLoadingPeople] = useState(false);
  const [newEmail, setNewEmail] = useState('');
  const [newName, setNewName] = useState('');
  const [isAdding, setIsAdding] = useState(false);

  // Shared With Me state
  const [sharedGrants, setSharedGrants] = useState<ShareGrant[]>([]);
  const [loadingShared, setLoadingShared] = useState(false);
  const [activeSharedView, setActiveSharedView] = useState<SharedReportView | null>(null);
  const [viewingGrantId, setViewingGrantId] = useState<string | null>(null);
  const [loadingReportView, setLoadingReportView] = useState(false);

  // Status feedback
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const loadTrustedPeople = async () => {
    setLoadingPeople(true);
    setError(null);
    try {
      const data = await apiListTrustedPeople();
      setTrustedPeople(data);
    } catch (err: any) {
      console.error('Failed to load trusted people:', err);
      setError(err?.message || 'Failed to load trusted people list.');
    } finally {
      setLoadingPeople(false);
    }
  };

  const loadSharedWithMe = async () => {
    setLoadingShared(true);
    setError(null);
    try {
      const data = await apiListSharedWithMe();
      setSharedGrants(data);
    } catch (err: any) {
      console.error('Failed to load shared reports:', err);
      setError(err?.message || 'Failed to load shared reports.');
    } finally {
      setLoadingShared(false);
    }
  };

  useEffect(() => {
    if (activeTab === 'trusted') {
      loadTrustedPeople();
    } else {
      loadSharedWithMe();
    }
  }, [activeTab]);

  const handleAddPerson = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newEmail.trim() || !newName.trim()) return;

    setIsAdding(true);
    setError(null);
    setSuccess(null);

    try {
      const person = await apiCreateTrustedPerson({
        email: newEmail.trim(),
        displayName: newName.trim(),
      });
      setTrustedPeople((prev) => [person, ...prev]);
      setNewEmail('');
      setNewName('');
      setSuccess(`Added ${person.displayName} (${person.email}) to your trusted people.`);
    } catch (err: any) {
      console.error('Error adding trusted person:', err);
      setError(err?.message || 'Failed to add trusted person.');
    } finally {
      setIsAdding(false);
    }
  };

  const handleRevokePerson = async (personId: string, name: string) => {
    if (
      !confirm(
        `Revoke trusted access for ${name}? This will immediately invalidate all Compass reports shared with them.`
      )
    ) {
      return;
    }

    setError(null);
    setSuccess(null);
    try {
      await apiRevokeTrustedPerson(personId);
      setTrustedPeople((prev) =>
        prev.map((p) => (p.id === personId ? { ...p, status: 'revoked' } : p))
      );
      setSuccess(`Revoked trusted access for ${name}.`);
    } catch (err: any) {
      console.error('Error revoking trusted person:', err);
      setError(err?.message || 'Failed to revoke trusted person.');
    }
  };

  const handleViewSharedReport = async (grantId: string) => {
    setLoadingReportView(true);
    setViewingGrantId(grantId);
    setError(null);
    try {
      const view = await apiGetSharedReport(grantId);
      setActiveSharedView(view);
    } catch (err: any) {
      console.error('Failed to open shared report:', err);
      setError(err?.message || 'Unable to open this shared report.');
    } finally {
      setLoadingReportView(false);
    }
  };

  const activePeople = trustedPeople.filter((p) => p.status === 'active');
  const revokedPeople = trustedPeople.filter((p) => p.status === 'revoked');

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 py-8 space-y-8">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-200/90">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-xl bg-slate-900 text-white flex items-center justify-center">
              <Users className="w-5 h-5 text-indigo-300" />
            </div>
            <div>
              <h1 className="text-xl font-bold tracking-tight text-slate-900">
                Trusted People &amp; Sharing
              </h1>
              <p className="text-xs text-slate-500">
                Manage read-only access to your Reflection Compass reports
              </p>
            </div>
          </div>
        </div>

        {/* Tab switchers */}
        <div className="flex items-center gap-1 bg-slate-100/90 p-1 rounded-xl border border-slate-200/80">
          <button
            id="tab-trusted-contacts"
            onClick={() => setActiveTab('trusted')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
              activeTab === 'trusted'
                ? 'bg-white text-slate-900 shadow-2xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Users className="w-3.5 h-3.5 text-indigo-600" />
            <span>My Trusted People ({activePeople.length})</span>
          </button>

          <button
            id="tab-shared-with-me"
            onClick={() => setActiveTab('shared_with_me')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
              activeTab === 'shared_with_me'
                ? 'bg-white text-slate-900 shadow-2xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Inbox className="w-3.5 h-3.5 text-blue-600" />
            <span>Shared With Me ({sharedGrants.length})</span>
          </button>
        </div>
      </div>

      {/* Status Alerts */}
      {error && (
        <div className="p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-xs text-rose-700 flex items-center gap-2.5">
          <AlertCircle className="w-4 h-4 shrink-0 text-rose-600" />
          <span>{error}</span>
        </div>
      )}

      {success && (
        <div className="p-3.5 rounded-xl bg-emerald-50 border border-emerald-200 text-xs text-emerald-800 flex items-center gap-2.5">
          <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-600" />
          <span>{success}</span>
        </div>
      )}

      {/* Privacy Guarantee Box */}
      <div className="p-4 rounded-2xl bg-white border border-slate-200/80 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-start gap-3">
          <div className="w-8 h-8 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0 mt-0.5">
            <ShieldCheck className="w-4 h-4" />
          </div>
          <div>
            <h4 className="text-xs font-bold text-slate-900">
              Zero-Exposure Privacy Model
            </h4>
            <p className="text-xs text-slate-500 mt-0.5 leading-relaxed">
              Trusted people can only view Reflection Compass reports you explicitly share. They have zero access to your raw session messages, private journal notes, or identity credentials.
            </p>
          </div>
        </div>
      </div>

      {activeTab === 'trusted' ? (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Add Trusted Person Form */}
          <div className="lg:col-span-1">
            <div className="p-6 rounded-2xl bg-white border border-slate-200/90 shadow-xs space-y-4">
              <div className="flex items-center gap-2 text-sm font-bold text-slate-900">
                <UserPlus className="w-4 h-4 text-indigo-600" />
                <span>Add Trusted Person</span>
              </div>

              <form onSubmit={handleAddPerson} className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Display Name
                  </label>
                  <div className="relative">
                    <User className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-3" />
                    <input
                      id="input-trusted-name"
                      type="text"
                      placeholder="e.g. Maya Chen"
                      value={newName}
                      onChange={(e) => setNewName(e.target.value)}
                      className="w-full pl-9 pr-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:ring-1 focus:ring-slate-900"
                      required
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Google / Email Address
                  </label>
                  <div className="relative">
                    <Mail className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-3" />
                    <input
                      id="input-trusted-email"
                      type="email"
                      placeholder="maya@example.com"
                      value={newEmail}
                      onChange={(e) => setNewEmail(e.target.value)}
                      className="w-full pl-9 pr-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:ring-1 focus:ring-slate-900"
                      required
                    />
                  </div>
                </div>

                <button
                  type="submit"
                  id="btn-add-trusted-person"
                  disabled={isAdding || !newEmail || !newName}
                  className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-xs font-semibold text-white bg-slate-900 hover:bg-slate-800 disabled:opacity-50 transition-all cursor-pointer shadow-xs"
                >
                  <UserPlus className="w-3.5 h-3.5" />
                  <span>{isAdding ? 'Adding Contact...' : 'Add Trusted Contact'}</span>
                </button>
              </form>
            </div>
          </div>

          {/* Trusted People List */}
          <div className="lg:col-span-2 space-y-4">
            <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider">
              Active Trusted People ({activePeople.length})
            </h3>

            {loadingPeople ? (
              <div className="p-8 text-center text-xs text-slate-400 bg-white rounded-2xl border border-slate-200">
                Loading contacts...
              </div>
            ) : activePeople.length === 0 ? (
              <div className="p-12 text-center bg-white rounded-2xl border border-dashed border-slate-200 space-y-2">
                <Users className="w-8 h-8 text-slate-300 mx-auto" />
                <h4 className="text-xs font-bold text-slate-700">No Trusted People Added Yet</h4>
                <p className="text-xs text-slate-400 max-w-sm mx-auto">
                  Add mentors, partners, or peers you wish to grant read-only access to selected Reflection Compass reports.
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {activePeople.map((person) => (
                  <div
                    key={person.id}
                    id={`trusted-person-${person.id}`}
                    className="p-4 rounded-2xl bg-white border border-slate-200/90 shadow-xs flex items-center justify-between gap-4"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-10 h-10 rounded-xl bg-slate-100 text-slate-700 flex items-center justify-center font-bold text-xs shrink-0">
                        {person.displayName.charAt(0).toUpperCase()}
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <p className="text-xs font-bold text-slate-900 truncate">
                            {person.displayName}
                          </p>
                          <span className="text-[10px] font-medium text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full">
                            Active
                          </span>
                        </div>
                        <p className="text-xs text-slate-400 truncate">{person.email}</p>
                        <p className="text-[10px] text-slate-400 flex items-center gap-1 mt-1">
                          <Clock className="w-3 h-3 text-slate-400" />
                          <span>Added {new Date(person.createdAt).toLocaleDateString()}</span>
                        </p>
                      </div>
                    </div>

                    <button
                      id={`revoke-person-${person.id}`}
                      onClick={() => handleRevokePerson(person.id, person.displayName)}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold text-rose-600 bg-rose-50 hover:bg-rose-100 border border-rose-200 transition-all cursor-pointer"
                      title="Revoke all report access"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      <span className="hidden sm:inline">Revoke Access</span>
                    </button>
                  </div>
                ))}
              </div>
            )}

            {/* Revoked history if any */}
            {revokedPeople.length > 0 && (
              <div className="pt-4 border-t border-slate-200 space-y-2">
                <h4 className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
                  Previously Revoked Contacts ({revokedPeople.length})
                </h4>
                <div className="space-y-2">
                  {revokedPeople.map((person) => (
                    <div
                      key={person.id}
                      className="p-3 rounded-xl bg-slate-50/80 border border-slate-200/60 flex items-center justify-between text-xs text-slate-400"
                    >
                      <span>{person.displayName} ({person.email})</span>
                      <span className="text-[10px] italic">Revoked</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      ) : (
        /* Shared With Me Tab */
        <div className="space-y-4">
          <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider">
            Reports Shared With You ({sharedGrants.length})
          </h3>

          {loadingShared ? (
            <div className="p-8 text-center text-xs text-slate-400 bg-white rounded-2xl border border-slate-200">
              Loading shared reports...
            </div>
          ) : sharedGrants.length === 0 ? (
            <div className="p-12 text-center bg-white rounded-2xl border border-dashed border-slate-200 space-y-2">
              <Inbox className="w-8 h-8 text-slate-300 mx-auto" />
              <h4 className="text-xs font-bold text-slate-700">No Reports Shared With You Yet</h4>
              <p className="text-xs text-slate-400 max-w-sm mx-auto">
                When friends, teammates, or colleagues share a Reflection Compass report with your email, it will appear here.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {sharedGrants.map((grant) => (
                <div
                  key={grant.id}
                  id={`shared-grant-${grant.id}`}
                  className="p-5 rounded-2xl bg-white border border-slate-200/90 shadow-xs flex flex-col justify-between space-y-4"
                >
                  <div className="space-y-2">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-[11px] font-semibold text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded-full">
                        Reflection Compass
                      </span>
                      <span className="text-[10px] text-slate-400">
                        {new Date(grant.grantedAt).toLocaleDateString()}
                      </span>
                    </div>

                    <h4 className="text-sm font-bold text-slate-900 line-clamp-1">
                      {grant.reportTitle}
                    </h4>

                    <p className="text-xs text-slate-500 flex items-center gap-1.5">
                      <User className="w-3.5 h-3.5 text-slate-400" />
                      <span>Shared by <strong>{grant.ownerDisplayName}</strong></span>
                    </p>
                  </div>

                  <button
                    onClick={() => handleViewSharedReport(grant.id)}
                    disabled={loadingReportView && viewingGrantId === grant.id}
                    className="w-full inline-flex items-center justify-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold text-slate-900 bg-slate-100 hover:bg-slate-200 transition-all cursor-pointer"
                  >
                    <Eye className="w-3.5 h-3.5 text-indigo-600" />
                    <span>
                      {loadingReportView && viewingGrantId === grant.id
                        ? 'Loading Report...'
                        : 'View Shared Report'}
                    </span>
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Read-only shared report modal */}
      <SharedReportModal
        isOpen={!!activeSharedView}
        onClose={() => setActiveSharedView(null)}
        report={activeSharedView}
      />
    </div>
  );
};
