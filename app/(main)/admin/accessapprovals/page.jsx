'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { RequireAuthentication } from '@src/client/components/standard/requireauthentication';
import { DefaultLayout } from '@src/client/components/standard/defaultlayout';
import { StandardContentArea } from '@src/client/components/standard/standardcontentarea';
import { stateManager } from '@src/client/statemanager';
import { useConfig } from '@src/client/configprovider';
import { callGetAccessRequests, callGenerateCode, callDenyCodeRequest } from '@src/client/codes';
import { getEmailTemplate, setEmailTemplate, sendAdminEmail } from '@src/client/adminemail';
import { CopyToClipboardIconButton } from '@src/client/components/standard/copytoclipboardiconbutton';
import { PrettyDate } from '@src/common/date';
import { nullUndefinedOrEmpty } from '@src/common/objects';
import { GlassCard } from '@src/client/components/ui/card';
import { PrimaryButton, SecondaryButton, DangerButton, GhostButton } from '@src/client/components/ui/button';
import { StatusPanel } from '@src/client/components/ui/statuspanel';
import { Toast, InlineAlert } from '@src/client/components/ui/feedback';
import { Modal } from '@src/client/components/ui/modal';
import {
  CheckCircle2,
  Cloud,
  Filter,
  Inbox,
  Loader2,
  Mail,
  ShieldCheck,
  ShieldX,
} from 'lucide-react';

const DEFAULT_SUBJECT = 'Your invitation to PlayDay.ai';
const DEFAULT_TEXT =
  "Welcome to PlayDay.ai!\r\n\r\nWe're excited to see the AI creations you'll make. Here is your access code:\r\n\r\n${codeUri}\r\n\r\nPlease let us know if you have any questions or need help with anything. Have a great day!\r\n\r\n- The PlayDay.ai team";
const DEFAULT_HTML =
  "<p>Welcome to PlayDay.ai!</p><p>We're excited to see the AI creations you'll make. Here is your access code:</p><p><strong>${codeUri}</strong></p><p>Please let us know if you have any questions or need help with anything. Have a great day!</p><p>- The PlayDay.ai team</p>";

const FILTER_OPTIONS = [
  { value: 'requested', label: 'Requested', indicator: Inbox },
  { value: 'approved', label: 'Approved', indicator: CheckCircle2 },
  { value: 'denied', label: 'Denied', indicator: ShieldX },
  { value: 'all', label: 'All', indicator: Filter },
];

function StatusBadge({ status }) {
  const config = {
    requested: 'bg-amber-400/15 text-amber-500 dark:text-amber-200',
    approved: 'bg-emerald-400/15 text-emerald-500 dark:text-emerald-200',
    denied: 'bg-rose-500/15 text-rose-500 dark:text-rose-200',
  }[status] ?? 'bg-slate-200/20 text-muted';

  return (
    <span className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-medium ${config}`}>
      {status}
    </span>
  );
}

export default function Home() {
  const router = useRouter();
  const { Constants } = useConfig();
  const { loading, account, hasServicePerms } = React.useContext(stateManager);

  const [subject, setSubject] = useState(null);
  const [textContent, setTextContent] = useState(null);
  const [htmlContent, setHtmlContent] = useState(null);
  const [templateLocal, setTemplateLocal] = useState(null);
  const [filter, setFilter] = useState('requested');
  const [accessRequests, setAccessRequests] = useState([]);
  const [notes, setNotes] = useState({});
  const [requestsLoading, setRequestsLoading] = useState(false);
  const [bulkProcessing, setBulkProcessing] = useState(false);
  const [confirmApproveDialogOpen, setConfirmApproveDialogOpen] = useState(false);
  const [toast, setToast] = useState({ open: false, tone: 'info', message: '' });

  useEffect(() => {
    if (!loading && !hasServicePerms('service_modifyGlobalPermissions')) {
      router.replace('/');
    }
  }, [loading, hasServicePerms, router]);

  useEffect(() => {
    const fetchTemplate = async () => {
      try {
        let template = await getEmailTemplate('welcomeemail');
        if (!template) {
          template = {};
        }

        let mutated = false;
        if (nullUndefinedOrEmpty(template.subject)) {
          template.subject = DEFAULT_SUBJECT;
          mutated = true;
        }
        if (nullUndefinedOrEmpty(template.text)) {
          template.text = DEFAULT_TEXT;
          mutated = true;
        }
        if (nullUndefinedOrEmpty(template.html)) {
          template.html = DEFAULT_HTML;
          mutated = true;
        }

        if (mutated) {
          await setEmailTemplate('welcomeemail', template);
        }

        setTemplateLocal(template);
        setSubject(template.subject);
        setTextContent(template.text);
        setHtmlContent(template.html);
      } catch (error) {
        console.error('Failed to load email template', error);
        setToast({ open: true, tone: 'error', message: 'Unable to load invitation template.' });
      }
    };

    fetchTemplate();
  }, []);

  useEffect(() => {
    const fetchAccessRequests = async () => {
      setRequestsLoading(true);
      try {
        const requests = await callGetAccessRequests(filter === 'all' ? null : filter);
        setAccessRequests(requests ?? []);
      } catch (error) {
        console.error('Failed to load access requests', error);
        setToast({ open: true, tone: 'error', message: 'Unable to load access requests.' });
      } finally {
        setRequestsLoading(false);
      }
    };

    fetchAccessRequests();
  }, [filter]);

  useEffect(() => {
    if (!templateLocal) {
      return;
    }

    if (
      subject === null ||
      textContent === null ||
      htmlContent === null ||
      (subject === templateLocal.subject &&
        textContent === templateLocal.text &&
        htmlContent === templateLocal.html)
    ) {
      return;
    }

    const commitTemplate = async () => {
      try {
        await setEmailTemplate('welcomeemail', {
          subject,
          text: textContent,
          html: htmlContent,
        });
        setTemplateLocal({ subject, text: textContent, html: htmlContent });
        setToast({ open: true, tone: 'success', message: 'Template saved.' });
      } catch (error) {
        console.error('Failed to update email template', error);
        setToast({ open: true, tone: 'error', message: 'Template save failed. Try again.' });
      }
    };

    const timeout = window.setTimeout(commitTemplate, 600);
    return () => window.clearTimeout(timeout);
  }, [subject, textContent, htmlContent, templateLocal]);

  const stripHtml = (html) => {
    const withLineBreaks = html
      .replaceAll('<p>', '\n\n')
      .replaceAll('<br>', '\n')
      .replaceAll('&nbsp;', ' ');
    const withoutTags = withLineBreaks.replace(/<[^>]*>?/gm, '');
    return withoutTags.replace(/^\s+/, '');
  };

  const updateEmailContent = (html) => {
    setHtmlContent(html);
    const plain = stripHtml(html);
    if (nullUndefinedOrEmpty(plain)) {
      console.warn('HTML content produced empty plaintext version.');
    } else {
      setTextContent(plain);
    }
  };

  const replaceTokens = (template, uri, code) => {
    if (!template) {
      return template;
    }
    return template.replaceAll('${codeUri}', uri).replaceAll('${code}', code ?? '');
  };

  const approveRequest = async (index) => {
    const request = accessRequests[index];
    if (!request) {
      return;
    }

    const note = notes[request.email];
    const newCodeNotes = `${request.email}${note ? `: ${note}` : ''}`;

    try {
      const code = await callGenerateCode('access', newCodeNotes, request.accountID, null);
      const uri = `https://playday.ai/account/redeemkey?code=${code.code}`;

      setAccessRequests((current) => {
        const next = [...current];
        next[index] = {
          ...next[index],
          accessCode: code.code,
          preferences: {
            ...next[index].preferences,
            accessRequestStatus: 'approved',
          },
        };
        return next;
      });

      await sendAdminEmail({
        to: request.email,
        subject,
        text: replaceTokens(textContent, uri, code.code),
        html: replaceTokens(htmlContent, `<a href="${uri}">${code.code}</a>`, code.code),
      });
      setToast({ open: true, tone: 'success', message: `Approved ${request.email}` });
    } catch (error) {
      console.error('Failed to approve request', error);
      setToast({ open: true, tone: 'error', message: `Unable to approve ${request?.email ?? 'request'}.` });
    }
  };

  const denyRequest = async (index) => {
    const request = accessRequests[index];
    if (!request) {
      return;
    }

    try {
      await callDenyCodeRequest(request.accountID);
      setAccessRequests((current) => {
        const next = [...current];
        next[index] = {
          ...next[index],
          preferences: {
            ...next[index].preferences,
            accessRequestStatus: 'denied',
          },
        };
        return next;
      });
      setToast({ open: true, tone: 'warning', message: `Denied ${request.email}` });
    } catch (error) {
      console.error('Failed to deny request', error);
      setToast({ open: true, tone: 'error', message: `Unable to deny ${request?.email ?? 'request'}.` });
    }
  };

  const approveAll = async () => {
    setConfirmApproveDialogOpen(false);
    setBulkProcessing(true);
    try {
      for (let index = 0; index < accessRequests.length; index += 1) {
        const request = accessRequests[index];
        if (request?.preferences?.accessRequestStatus !== 'approved') {
          await approveRequest(index);
        }
      }
      setToast({ open: true, tone: 'success', message: 'Approved all pending requests.' });
    } finally {
      setBulkProcessing(false);
    }
  };

  const denyAll = async () => {
    setBulkProcessing(true);
    try {
      for (let index = 0; index < accessRequests.length; index += 1) {
        const request = accessRequests[index];
        if (request?.preferences?.accessRequestStatus === 'requested') {
          await denyRequest(index);
        }
      }
      setToast({ open: true, tone: 'warning', message: 'Denied all pending requests.' });
    } finally {
      setBulkProcessing(false);
    }
  };

  const handleNotesChange = (emailKey, value) => {
    setNotes((current) => ({ ...current, [emailKey]: value }));
  };

  const closeToast = () => setToast((prev) => ({ ...prev, open: false }));

  const filteredEmpty = useMemo(
    () => !requestsLoading && accessRequests.length === 0,
    [requestsLoading, accessRequests.length],
  );

  if (subject === null || textContent === null || htmlContent === null) {
    return (
      <RequireAuthentication>
        <DefaultLayout title="Access Request Approvals (ADMIN)">
          <StandardContentArea className="bg-transparent px-0">
            <StatusPanel
              icon={Loader2}
              iconClassName="animate-spin"
              title="Loading approval console"
              description="Fetching templates and recent requests."
            />
          </StandardContentArea>
        </DefaultLayout>
      </RequireAuthentication>
    );
  }

  return (
    <RequireAuthentication>
      <DefaultLayout title="Access Request Approvals (ADMIN)">
        <StandardContentArea className="bg-transparent px-0">
          <div className="space-y-8">
            <GlassCard>
              <div className="flex flex-col gap-6">
                <div className="flex items-start gap-4">
                  <span className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 text-primary">
                    <Mail className="h-6 w-6" aria-hidden="true" />
                  </span>
                  <div className="space-y-3">
                    <p className="text-sm uppercase tracking-[0.35em] text-muted">Invite template</p>
                    <h1 className="text-2xl font-semibold text-emphasis">Customize the welcome email</h1>
                    <p className="text-sm text-muted">
                      Update the message new creators receive when you approve their access. The template saves
                      automatically a moment after you stop typing.
                    </p>
                  </div>
                </div>

                <label className="flex flex-col gap-2 text-sm font-semibold text-emphasis">
                  <span>Email subject</span>
                  <input
                    type="text"
                    value={subject ?? ''}
                    onChange={(event) => setSubject(event.target.value)}
                    placeholder="Your invitation to PlayDay.ai"
                    className="rounded-2xl border border-border/60 bg-surface px-4 py-3 text-sm text-emphasis shadow-inner focus:border-primary focus:outline-none"
                  />
                </label>

                <div className="space-y-2">
                  <p className="text-sm font-semibold text-emphasis">HTML content</p>
                  <div className="rounded-3xl border border-border/50 bg-surface/80">
                    <textarea
                      value={htmlContent ?? ''}
                      onChange={(event) => updateEmailContent(event.target.value)}
                      placeholder="Compose the welcome email..."
                      rows={10}
                      className="min-h-[320px] w-full resize-y rounded-3xl border-none bg-transparent px-4 py-3 text-sm text-emphasis focus:outline-none"
                    />
                  </div>
                  <InlineAlert
                    tone="info"
                    title="Tip"
                    description="Use ${codeUri} anywhere inside the message to automatically embed the recipient's unique link."
                  />
                </div>
              </div>
            </GlassCard>

            <GlassCard>
              <div className="flex flex-col gap-6">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div className="space-y-2">
                    <h2 className="text-xl font-semibold text-emphasis">Access requests</h2>
                    <p className="text-sm text-muted">
                      Review pending invitations, approve to send codes instantly, or deny with a note.
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {FILTER_OPTIONS.map(({ value, label, indicator: Icon }) => {
                      const isActive = filter === value;
                      const baseClasses =
                        'inline-flex items-center gap-2 rounded-full border px-4 py-2 text-sm transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40';
                      const activeClasses = 'border-primary/60 bg-primary/10 text-primary shadow-soft';
                      const inactiveClasses = 'border-border/60 bg-surface text-muted hover:border-primary/40 hover:text-primary';
                      return (
                        <button
                          key={value}
                          type="button"
                          onClick={() => setFilter(value)}
                          className={`${baseClasses} ${isActive ? activeClasses : inactiveClasses}`}
                        >
                          <Icon className="h-4 w-4" aria-hidden="true" />
                          {label}
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div className="flex flex-wrap justify-end gap-3">
                  <SecondaryButton
                    icon={ShieldCheck}
                    onClick={() => setConfirmApproveDialogOpen(true)}
                    disabled={bulkProcessing || requestsLoading || filteredEmpty}
                  >
                    Approve all
                  </SecondaryButton>
                  <DangerButton
                    icon={ShieldX}
                    onClick={denyAll}
                    disabled={bulkProcessing || requestsLoading || filteredEmpty}
                  >
                    Deny all pending
                  </DangerButton>
                </div>

                {requestsLoading ? (
                  <StatusPanel
                    icon={Loader2}
                    iconClassName="animate-spin"
                    title="Loading access requests"
                    description="Pulling the latest submissions from the queue."
                  />
                ) : filteredEmpty ? (
                  <StatusPanel
                    icon={Inbox}
                    title="No requests found"
                    description="Adjust the filters or check back later to review new access submissions."
                  />
                ) : (
                  <div className="overflow-hidden rounded-3xl border border-border/50">
                    <table className="min-w-full divide-y divide-border/40">
                      <thead className="bg-surface/60 text-xs uppercase tracking-[0.3em] text-muted">
                        <tr>
                          <th scope="col" className="px-4 py-3 text-left">
                            Email
                          </th>
                          <th scope="col" className="px-4 py-3 text-left">
                            Status
                          </th>
                          <th scope="col" className="px-4 py-3 text-left">
                            Requested
                          </th>
                          <th scope="col" className="px-4 py-3 text-left">
                            Actions
                          </th>
                          <th scope="col" className="px-4 py-3 text-left">
                            Notes
                          </th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-border/30 bg-surface/50">
                        {accessRequests.map((request, index) => {
                          const status = request.preferences?.accessRequestStatus ?? 'requested';
                          const dateLabel = request.preferences?.accessRequestDate
                            ? PrettyDate(request.preferences.accessRequestDate)
                            : '-';
                          const noteValue = notes[request.email] ?? '';
                          return (
                            <tr key={`${request.accountID}-${request.email}`} className="text-sm text-emphasis">
                              <td className="whitespace-nowrap px-4 py-4 font-medium">
                                {request.email}
                              </td>
                              <td className="px-4 py-4">
                                <StatusBadge status={status} />
                              </td>
                              <td className="whitespace-nowrap px-4 py-4 text-muted">
                                {dateLabel}
                              </td>
                              <td className="px-4 py-4">
                                {status === 'approved' ? (
                                  <CopyToClipboardIconButton
                                    textToCopy={`https://playday.ai/account/redeemkey?code=${request.accessCode}`}
                                    icon={<Cloud className="h-4 w-4" aria-hidden="true" />}
                                    label="Copy redeem link"
                                  />
                                ) : (
                                  <div className="flex flex-wrap gap-2">
                                    <PrimaryButton
                                      size="sm"
                                      onClick={() => approveRequest(index)}
                                      disabled={bulkProcessing}
                                    >
                                      Approve
                                    </PrimaryButton>
                                    {status !== 'denied' ? (
                                      <DangerButton
                                        size="sm"
                                        onClick={() => denyRequest(index)}
                                        disabled={bulkProcessing}
                                      >
                                        Deny
                                      </DangerButton>
                                    ) : (
                                      <GhostButton
                                        size="sm"
                                        onClick={() => approveRequest(index)}
                                        disabled={bulkProcessing}
                                      >
                                        Re-approve
                                      </GhostButton>
                                    )}
                                  </div>
                                )}
                              </td>
                              <td className="px-4 py-4">
                                {status !== 'approved' ? (
                                  <input
                                    value={noteValue}
                                    onChange={(event) => handleNotesChange(request.email, event.target.value)}
                                    placeholder="Optional notes"
                                    className="w-full rounded-2xl border border-border/50 bg-surface px-3 py-2 text-sm text-emphasis focus:border-primary focus:outline-none"
                                  />
                                ) : (
                                  <span className="text-xs text-muted">-</span>
                                )}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </GlassCard>
          </div>
        </StandardContentArea>

        <Modal
          open={confirmApproveDialogOpen}
          onClose={() => setConfirmApproveDialogOpen(false)}
          title="Approve all pending requests?"
          description="Each pending request will receive a unique access code and welcome email."
          footer={[
            <SecondaryButton key="cancel" onClick={() => setConfirmApproveDialogOpen(false)}>
              Cancel
            </SecondaryButton>,
            <PrimaryButton key="approve" onClick={approveAll} disabled={bulkProcessing}>
              Approve all
            </PrimaryButton>,
          ]}
        >
          <p className="text-sm text-muted">
            This action sends emails immediately and cannot be undone. Be sure your template content is ready.
          </p>
        </Modal>

        <Toast open={toast.open} tone={toast.tone} message={toast.message} onClose={closeToast} />
      </DefaultLayout>
    </RequireAuthentication>
  );
}





