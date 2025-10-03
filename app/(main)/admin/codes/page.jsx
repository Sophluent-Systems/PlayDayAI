'use client';

import React, { useEffect, useMemo, useState } from 'react';
import clsx from 'clsx';
import { Plus, Ticket, Tags, NotebookPen, ClipboardCopy, Loader2 } from 'lucide-react';
import { RequireAuthentication } from '@src/client/components/standard/requireauthentication';
import { DefaultLayout } from '@src/client/components/standard/defaultlayout';
import { StandardContentArea } from '@src/client/components/standard/standardcontentarea';
import { CopyToClipboardIconButton } from '@src/client/components/standard/copytoclipboardiconbutton';
import { Toast } from '@src/client/components/ui/feedback';
import { callLookupCodes, callGenerateCode } from '@src/client/codes';
import { PrettyDate } from '@src/common/date';
import { stateManager } from '@src/client/statemanager';

function RedeemedBadge({ redeemed }) {
  if (!redeemed) {
    return (
      <span className="rounded-full bg-emerald-400/15 px-3 py-1 text-xs font-medium text-emerald-500">Unused</span>
    );
  }
  return (
    <span className="rounded-full bg-primary/15 px-3 py-1 text-xs font-medium text-primary">Redeemed</span>
  );
}

export default function Home() {
  const { loading, account, hasServicePerms } = React.useContext(stateManager);
  const [codes, setCodes] = useState([]);
  const [loadingCodes, setLoadingCodes] = useState(true);
  const [creating, setCreating] = useState(false);
  const [newCodePurpose, setNewCodePurpose] = useState('Creator access');
  const [newCodeNotes, setNewCodeNotes] = useState('');
  const [toast, setToast] = useState({ open: false, tone: 'info', message: '' });

  const showToast = (tone, message) => setToast({ open: true, tone, message });
  const closeToast = () => setToast((prev) => ({ ...prev, open: false }));

  const refreshCodes = async () => {
    setLoadingCodes(true);
    try {
      const response = await callLookupCodes(true);
      setCodes(response ?? []);
    } catch (error) {
      console.error('Failed to load access codes', error);
      showToast('error', 'Unable to load invite codes.');
    } finally {
      setLoadingCodes(false);
    }
  };

  useEffect(() => {
    if (!loading && account && hasServicePerms('service_modifyGlobalPermissions')) {
      refreshCodes();
    } else if (!loading && account && !hasServicePerms('service_modifyGlobalPermissions')) {
      showToast('error', 'You do not have permission to view this page.');
    }
  }, [loading, account, hasServicePerms]);

  const handleCreateCode = async () => {
    if (!newCodePurpose) {
      return;
    }
    setCreating(true);
    try {
      await callGenerateCode('access', newCodeNotes, null, null);
      await refreshCodes();
      showToast('success', 'New invite code generated.');
      setNewCodePurpose('Creator access');
      setNewCodeNotes('');
    } catch (error) {
      console.error('Failed to generate code', error);
      showToast('error', 'Code generation failed.');
    } finally {
      setCreating(false);
    }
  };

  const codeCount = useMemo(() => codes.length, [codes]);

  return (
    <RequireAuthentication>
      <DefaultLayout title="Invite Access Codes (ADMIN)">
        <StandardContentArea className="bg-transparent px-0">
          <div className="space-y-8">
            <div className="glass-panel rounded-3xl border border-border/60 bg-surface/95 p-8 shadow-soft backdrop-blur-xl">
              <div className="flex flex-col gap-6 sm:flex-row sm:items-start sm:justify-between">
                <div className="flex gap-4">
                  <span className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 text-primary">
                    <Ticket className="h-6 w-6" aria-hidden="true" />
                  </span>
                  <div className="space-y-3">
                    <p className="text-sm uppercase tracking-[0.35em] text-muted">Invitations</p>
                    <h1 className="text-2xl font-semibold text-emphasis">Manage access codes</h1>
                    <p className="text-sm text-muted">
                      Generate single-use codes for trusted collaborators and keep track of their redemption status.
                    </p>
                  </div>
                </div>
              </div>
            </div>

            <div className="glass-panel rounded-3xl border border-border/60 bg-surface/95 p-8 shadow-soft backdrop-blur-xl">
              <div className="space-y-6">
                <div className="space-y-2">
                  <h2 className="text-xl font-semibold text-emphasis">Create a new code</h2>
                  <p className="text-sm text-muted">
                    Add optional context so you know why the code was issued and who it was intended for.
                  </p>
                </div>

                <div className="grid gap-6 sm:grid-cols-2">
                  <label className="flex flex-col gap-2 text-sm font-semibold text-emphasis">
                    <span className="inline-flex items-center gap-2 text-muted">
                      <Tags className="h-4 w-4" aria-hidden="true" /> Purpose
                    </span>
                    <div className="flex items-center gap-3 rounded-2xl border border-border/60 bg-surface px-4 py-3">
                      <select
                        value={newCodePurpose}
                        onChange={(event) => setNewCodePurpose(event.target.value)}
                        className="w-full bg-transparent text-sm text-emphasis focus:outline-none"
                        disabled={creating}
                      >
                        <option value="Creator access">Creator access</option>
                        <option value="Internal testing">Internal testing</option>
                        <option value="Partner preview">Partner preview</option>
                      </select>
                    </div>
                  </label>

                  <label className="flex flex-col gap-2 text-sm font-semibold text-emphasis sm:col-span-2">
                    <span className="inline-flex items-center gap-2 text-muted">
                      <NotebookPen className="h-4 w-4" aria-hidden="true" /> Notes (optional)
                    </span>
                    <textarea
                      value={newCodeNotes}
                      onChange={(event) => setNewCodeNotes(event.target.value)}
                      rows={4}
                      placeholder="Add context or list the recipient."
                      className="rounded-2xl border border-border/60 bg-surface px-4 py-3 text-sm text-emphasis shadow-inner focus:border-primary focus:outline-none"
                      disabled={creating}
                    />
                  </label>
                </div>

                <div className="flex justify-end gap-3">
                  <button
                    type="button"
                    onClick={refreshCodes}
                    disabled={loadingCodes || creating}
                    className="inline-flex items-center gap-2 rounded-full border border-border/60 bg-surface px-4 py-2 text-sm font-medium text-emphasis transition hover:border-primary/40 hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 focus-visible:ring-offset-2 focus-visible:ring-offset-surface disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    Refresh
                  </button>
                  <button
                    type="button"
                    onClick={handleCreateCode}
                    disabled={creating}
                    className={clsx(
                      'inline-flex items-center gap-2 rounded-full px-5 py-3 text-sm font-semibold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 focus-visible:ring-offset-2 focus-visible:ring-offset-surface',
                      creating ? 'bg-border/70 text-muted' : 'bg-primary text-white hover:bg-primary/90'
                    )}
                  >
                    {creating ? 'Creating?' : 'Create code'}
                  </button>
                </div>
              </div>
            </div>

            {loadingCodes ? (
              <div className="glass-panel flex items-center justify-center rounded-3xl border border-border/60 bg-surface/95 p-8 shadow-soft backdrop-blur-xl">
                <Loader2 className="h-5 w-5 animate-spin text-primary" aria-hidden="true" />
              </div>
            ) : codeCount === 0 ? (
              <div className="glass-panel rounded-3xl border border-border/60 bg-surface/95 p-8 text-center text-sm text-muted shadow-soft backdrop-blur-xl">
                No codes yet. Create your first invite above to start sharing access.
              </div>
            ) : (
              <div className="glass-panel rounded-3xl border border-border/60 bg-surface/95 p-8 shadow-soft backdrop-blur-xl">
                <div className="mb-4 flex items-center justify-between">
                  <h2 className="text-xl font-semibold text-emphasis">Existing codes</h2>
                  <span className="text-sm text-muted">{codeCount} total</span>
                </div>
                <div className="overflow-hidden rounded-3xl border border-border/50">
                  <table className="min-w-full divide-y divide-border/40">
                    <thead className="bg-surface/60 text-xs uppercase tracking-[0.3em] text-muted">
                      <tr>
                        <th scope="col" className="px-4 py-3 text-left">
                          Code
                        </th>
                        <th scope="col" className="px-4 py-3 text-left">
                          Notes
                        </th>
                        <th scope="col" className="px-4 py-3 text-left">
                          Status
                        </th>
                        <th scope="col" className="px-4 py-3 text-left">
                          Created
                        </th>
                        <th scope="col" className="px-4 py-3 text-left">
                          Redeemed on
                        </th>
                        <th scope="col" className="px-4 py-3 text-left">
                          Grants
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border/30 bg-surface/50 text-sm">
                      {codes.map((code) => (
                        <tr key={`${code.code}-${code.creationDate}`}>
                          <td className="whitespace-nowrap px-4 py-4 font-mono text-sm text-emphasis">
                            <div className="flex items-center gap-2">
                              {code.code}
                              <CopyToClipboardIconButton
                                textToCopy={`https://playday.ai/account/redeemkey?code=${code.code}`}
                                icon={<ClipboardCopy className="h-4 w-4" aria-hidden="true" />}
                                label="Copy redeem link"
                              />
                            </div>
                          </td>
                          <td className="px-4 py-4 text-muted">{code.notes || '?'}</td>
                          <td className="px-4 py-4">
                            <RedeemedBadge redeemed={code.redeemed} />
                          </td>
                          <td className="px-4 py-4 text-muted">{PrettyDate(code.creationDate)}</td>
                          <td className="px-4 py-4 text-muted">
                            {code.redemptionDate ? PrettyDate(code.redemptionDate) : '?'}
                          </td>
                          <td className="px-4 py-4 text-muted">{code.grants ?? '?'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>

          <Toast open={toast.open} tone={toast.tone} message={toast.message} onClose={closeToast} />
        </StandardContentArea>
      </DefaultLayout>
    </RequireAuthentication>
  );
}
