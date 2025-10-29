'use client';

import React, { useCallback, useContext, useEffect, useMemo, useState } from 'react';
import clsx from 'clsx';
import {
  Loader2,
  Download,
  AlertTriangle,
  Sparkles,
  Image,
  Package,
  Smile,
  Minus,
  Frown,
  Layers,
  Clock,
  RotateCcw,
} from 'lucide-react';
import { stateManager } from '@src/client/statemanager';
import { callGetTrainingData } from '@src/client/responseratings';
import { MultiSelectDropdown } from '@src/client/components/standard/multiselectdropdown';

const requestTypeOptions = ['assistant', 'imagePrompt', 'compression'];
const sentimentOptions = [-1, 0, 1];
const DEFAULT_REQUEST_TYPES = ['assistant'];
const DEFAULT_SENTIMENTS = [...sentimentOptions];

const REQUEST_TYPE_META = {
  assistant: {
    label: 'Assistant',
    description: 'Conversational flows and story beats.',
    icon: Sparkles,
    accent: 'primary',
  },
  imagePrompt: {
    label: 'Image prompts',
    description: 'Visual generation requests and references.',
    icon: Image,
    accent: 'amber',
  },
  compression: {
    label: 'Compression',
    description: 'Automated summaries and compression jobs.',
    icon: Package,
    accent: 'slate',
  },
};

const SENTIMENT_META = {
  '-1': {
    label: 'Negative',
    description: 'Needs follow-up or learner support.',
    icon: Frown,
    accent: 'rose',
  },
  '0': {
    label: 'Neutral',
    description: 'Mixed or inconclusive reactions.',
    icon: Minus,
    accent: 'amber',
  },
  '1': {
    label: 'Positive',
    description: 'Delighted players and high praise.',
    icon: Smile,
    accent: 'emerald',
  },
};

const ACCENT_STYLES = {
  primary: {
    active:
      'border-primary/60 bg-primary/15 text-primary shadow-[0_18px_45px_-28px_rgba(99,102,241,0.65)]',
    iconActive: 'text-primary',
    badge: 'bg-primary/10 text-primary',
  },
  emerald: {
    active:
      'border-emerald-400/60 bg-emerald-400/15 text-emerald-400 shadow-[0_18px_45px_-28px_rgba(16,185,129,0.55)]',
    iconActive: 'text-emerald-400',
    badge: 'bg-emerald-400/10 text-emerald-400',
  },
  amber: {
    active:
      'border-amber-400/60 bg-amber-400/15 text-amber-400 shadow-[0_18px_45px_-28px_rgba(251,191,36,0.55)]',
    iconActive: 'text-amber-400',
    badge: 'bg-amber-400/10 text-amber-500',
  },
  rose: {
    active:
      'border-rose-400/60 bg-rose-400/15 text-rose-400 shadow-[0_18px_45px_-28px_rgba(244,114,182,0.55)]',
    iconActive: 'text-rose-400',
    badge: 'bg-rose-400/10 text-rose-400',
  },
  slate: {
    active: 'border-border bg-surface text-emphasis shadow-[0_16px_40px_-30px_rgba(148,163,184,0.6)]',
    iconActive: 'text-emphasis',
    badge: 'bg-border/20 text-muted',
  },
};

const INACTIVE_OPTION_CLASS =
  'border border-border/60 bg-surface/90 text-emphasis transition-all duration-150 hover:-translate-y-0.5 hover:border-primary/40 hover:bg-primary/5';

function PageContainer({ children }) {
  return (
    <div className="bg-background px-4 pt-28 pb-16 sm:px-6 lg:px-12">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-12">{children}</div>
    </div>
  );
}

function FullPageState({ icon, title, description, children }) {
  return (
    <div className="glass-panel mx-auto max-w-xl text-center">
      <div className="flex flex-col items-center gap-4">
        {icon ? <div className="rounded-2xl border border-border/40 bg-surface/80 p-3">{icon}</div> : null}
        <div className="space-y-2">
          <h2 className="text-xl font-semibold text-emphasis">{title}</h2>
          {description ? <p className="text-sm text-muted">{description}</p> : null}
        </div>
        {children}
      </div>
    </div>
  );
}

function InlinePlaceholder({ icon, title, description, children }) {
  return (
    <div className="flex min-h-[280px] flex-col items-center justify-center gap-4 text-center">
      {icon ? <div className="rounded-2xl border border-border/50 bg-surface/80 p-3">{icon}</div> : null}
      <div className="space-y-2">
        <h3 className="text-lg font-semibold text-emphasis">{title}</h3>
        {description ? <p className="text-sm text-muted">{description}</p> : null}
      </div>
      {children}
    </div>
  );
}

function FiltersSummary({ items }) {
  if (!items?.length) {
    return null;
  }

  return (
    <div className="flex flex-wrap gap-2">
      {items.map((item) => {
        const Icon = item.icon;
        return (
          <span
            key={item.key ?? item.label}
            className={clsx(
              'inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs font-semibold transition',
              item.accent === 'primary'
                ? 'border-primary/40 bg-primary/10 text-primary'
                : 'border-border/60 bg-surface/90 text-muted'
            )}
          >
            {Icon ? <Icon className="h-3.5 w-3.5" aria-hidden="true" /> : null}
            {item.label}
          </span>
        );
      })}
    </div>
  );
}

function FilterSection({ title, subtitle, options, selected, onChange, optionLayout = 'grid' }) {
  const values = useMemo(() => options.map((option) => option.value ?? option), [options]);
  const allSelected = options.length > 0 && selected.length === options.length;

  const toggleAll = () => {
    onChange(allSelected ? [] : [...values]);
  };

  const toggleOption = (value) => {
    if (selected.includes(value)) {
      onChange(selected.filter((item) => item !== value));
    } else {
      onChange([...selected, value]);
    }
  };

  const optionContainerClass =
    optionLayout === 'stack'
      ? 'flex flex-col gap-2'
      : 'grid gap-2 sm:grid-cols-2 xl:grid-cols-3';

  return (
    <div className="rounded-3xl border border-border/60 bg-surface/80 p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="space-y-1">
          <p className="text-xs font-semibold uppercase tracking-[0.35em] text-muted">{title}</p>
          {subtitle ? <p className="text-xs text-muted">{subtitle}</p> : null}
        </div>
        {options.length > 0 ? (
          <button
            type="button"
            onClick={toggleAll}
            className="text-xs font-semibold uppercase tracking-wide text-primary transition hover:text-primary/80"
          >
            {allSelected ? 'Clear all' : 'Select all'}
          </button>
        ) : null}
      </div>
      <div className={clsx('mt-4', optionContainerClass)}>
        {options.length === 0 ? (
          <span className="text-xs text-muted">No options available yet.</span>
        ) : (
          options.map((option) => {
            const value = option.value ?? option;
            const label = option.label ?? value;
            const description = option.description;
            const isActive = selected.includes(value);
            const Icon = option.icon;
            const badge = option.badge;
            const accent = option.accent && ACCENT_STYLES[option.accent] ? option.accent : 'primary';
            const accentStyles = ACCENT_STYLES[accent];
            const iconClass = isActive ? accentStyles.iconActive : 'text-muted';

            return (
              <button
                key={value}
                type="button"
                onClick={() => toggleOption(value)}
                aria-pressed={isActive}
                className={clsx(
                  'group relative flex items-center justify-between gap-3 rounded-2xl px-4 py-3 text-left',
                  isActive ? accentStyles.active : INACTIVE_OPTION_CLASS
                )}
              >
                <div className="flex flex-1 items-center gap-3">
                  {Icon ? (
                    <span
                      className={clsx(
                        'flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-border/40 bg-surface/90 text-sm transition-colors',
                        iconClass
                      )}
                    >
                      <Icon className="h-4 w-4" aria-hidden="true" />
                    </span>
                  ) : null}
                  <div className="flex flex-1 flex-col">
                    <span className="text-sm font-semibold">{label}</span>
                    {description ? <span className="text-xs text-muted">{description}</span> : null}
                  </div>
                </div>
                {badge ? (
                  <span
                    className={clsx(
                      'rounded-full px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.2em]',
                      accentStyles.badge
                    )}
                  >
                    {badge}
                  </span>
                ) : null}
              </button>
            );
          })
        )}
      </div>
    </div>
  );
}

function StatCard({ icon: Icon, label, value, caption, tone = 'primary' }) {
  const accent = ACCENT_STYLES[tone] ?? ACCENT_STYLES.primary;

  return (
    <div className="rounded-3xl border border-border/60 bg-surface/85 p-5">
      <div className="flex items-center gap-4">
        {Icon ? (
          <span
            className={clsx(
              'flex h-11 w-11 items-center justify-center rounded-2xl border border-border/50 bg-surface/95 text-primary',
              accent.iconActive
            )}
          >
            <Icon className="h-5 w-5" aria-hidden="true" />
          </span>
        ) : null}
        <div className="flex flex-col">
          <span className="text-xs font-semibold uppercase tracking-[0.35em] text-muted">{label}</span>
          <span className="text-2xl font-semibold text-emphasis">{value}</span>
          {caption ? <span className="text-xs text-muted">{caption}</span> : null}
        </div>
      </div>
    </div>
  );
}

function calculateOverallRating(rating) {
  let overallRating;
  if (typeof rating?.playerRating === 'number') {
    overallRating = rating.playerRating;
  }
  if (typeof rating?.automationRating === 'number') {
    overallRating = rating.automationRating;
  }
  if (typeof rating?.adminRating === 'number') {
    overallRating = rating.adminRating;
  }

  if (typeof overallRating === 'undefined') {
    return 0.0;
  }

  return overallRating;
}

function escapeCSV(value) {
  if (typeof value !== 'string') {
    value = value ?? '';
  }
  return String(value).replace(/"/g, '""').replace(/'/g, "''");
}

function formatRelativeTime(date) {
  if (!date) {
    return null;
  }

  const deltaMs = Date.now() - date.getTime();
  const minutes = Math.round(deltaMs / 60000);

  if (minutes <= 1) {
    return 'Just now';
  }
  if (minutes < 60) {
    return `${minutes} minute${minutes === 1 ? '' : 's'} ago`;
  }

  const hours = Math.round(minutes / 60);
  if (hours < 24) {
    return `${hours} hour${hours === 1 ? '' : 's'} ago`;
  }

  const days = Math.round(hours / 24);
  return `${days} day${days === 1 ? '' : 's'} ago`;
}

function formatNumber(value) {
  return new Intl.NumberFormat('en-US').format(value ?? 0);
}

export default function TrainingDataPage() {
  const { loading, account, game, versionList, gamePermissions } = useContext(stateManager);
  const [versionNames, setVersionNames] = useState([]);
  const [selectedVersions, setSelectedVersions] = useState([]);
  const [selectedRequestTypes, setSelectedRequestTypes] = useState([...DEFAULT_REQUEST_TYPES]);
  const [selectedSentiments, setSelectedSentiments] = useState([...DEFAULT_SENTIMENTS]);
  const [trainingData, setTrainingData] = useState([]);
  const [isLoadingTrainingData, setIsLoadingTrainingData] = useState(false);
  const [fetchError, setFetchError] = useState(null);
  const [reloadToken, setReloadToken] = useState(0);
  const [lastLoadedAt, setLastLoadedAt] = useState(null);
  const [hasBootstrappedVersions, setHasBootstrappedVersions] = useState(false);
  const gameID = game?.gameID ?? null;

  useEffect(() => {
    const names = Array.isArray(versionList) ? versionList.map((version) => version.versionName) : [];
    setVersionNames(names);
    setSelectedVersions((current) => {
      const filtered = current.filter((name) => names.includes(name));
      if (!hasBootstrappedVersions && filtered.length === 0 && names.length > 0) {
        return names;
      }
      return filtered;
    });
    if (!hasBootstrappedVersions && names.length > 0) {
      setHasBootstrappedVersions(true);
    }
  }, [versionList, hasBootstrappedVersions]);

  const versionLookup = useMemo(() => {
    const map = new Map();
    if (Array.isArray(versionList)) {
      for (const entry of versionList) {
        map.set(entry.versionName, entry.versionID);
      }
    }
    return map;
  }, [versionList]);


  const requestTypeFilterOptions = useMemo(
    () =>
      requestTypeOptions.map((value) => {
        const meta = REQUEST_TYPE_META[value] ?? {};
        return {
          value,
          label: meta.label ?? value,
          description: meta.description ?? '',
          icon: meta.icon,
          accent: meta.accent ?? 'primary',
        };
      }),
    []
  );

  const sentimentFilterOptions = useMemo(
    () =>
      sentimentOptions.map((value) => {
        const key = String(value);
        const meta = SENTIMENT_META[key] ?? {};
        return {
          value,
          label: meta.label ?? key,
          description: meta.description ?? '',
          icon: meta.icon,
          accent: meta.accent ?? 'primary',
        };
      }),
    []
  );

  useEffect(() => {
    if (!gameID) {
      return;
    }

    const versionsToSend = selectedVersions
      .map((name) => versionLookup.get(name))
      .filter((value) => value);

    if (selectedVersions.length === 0 || versionsToSend.length === 0) {
      setTrainingData([]);
      setFetchError(null);
      setIsLoadingTrainingData(false);
      setLastLoadedAt(null);
      return;
    }

    let isCancelled = false;

    const fetchData = async () => {
      setIsLoadingTrainingData(true);
      setFetchError(null);

      try {
        const filters = {
          versionID: versionsToSend,
          requestType: selectedRequestTypes,
        };

        let result = await callGetTrainingData(gameID, filters);
        if (isCancelled) {
          return;
        }

        const normalized = Array.isArray(result) ? result : [];
        const filtered = normalized.filter((rating) => selectedSentiments.includes(calculateOverallRating(rating)));
        setTrainingData(filtered);
        setLastLoadedAt(new Date());
      } catch (error) {
        if (isCancelled) {
          return;
        }
        console.error('Error fetching training data:', error);
        setTrainingData([]);
        setFetchError("We couldn't load training data right now. Try again in a moment.");
      } finally {
        if (!isCancelled) {
          setIsLoadingTrainingData(false);
        }
      }
    };

    fetchData();

    return () => {
      isCancelled = true;
    };
  }, [
    gameID,
    versionLookup,
    selectedVersions,
    selectedRequestTypes,
    selectedSentiments,
    reloadToken,
  ]);

  const hasVersionSelection = selectedVersions.length > 0;
  const hasResults = trainingData.length > 0;
  const previewRows = trainingData.slice(0, 20);
  const displayCount = previewRows.length;

  const sentimentTotals = useMemo(() => {
    return trainingData.reduce(
      (totals, rating) => {
        const score = String(calculateOverallRating(rating));
        if (score in totals) {
          totals[score] += 1;
        }
        return totals;
      },
      { '-1': 0, '0': 0, '1': 0 }
    );
  }, [trainingData]);

  const totalTranscripts = trainingData.length;
  const positiveShare = totalTranscripts
    ? Math.round((sentimentTotals['1'] / totalTranscripts) * 100)
    : 0;
  const negativeShare = totalTranscripts
    ? Math.round((sentimentTotals['-1'] / totalTranscripts) * 100)
    : 0;

  const handleRetry = useCallback(() => {
    setReloadToken((value) => value + 1);
  }, []);

  const handleResetFilters = useCallback(() => {
    setSelectedVersions([...versionNames]);
    setSelectedRequestTypes([...DEFAULT_REQUEST_TYPES]);
    setSelectedSentiments([...DEFAULT_SENTIMENTS]);
    setReloadToken((value) => value + 1);
  }, [versionNames]);

  const handleDownloadJSON = useCallback(() => {
    if (!hasResults) {
      return;
    }
    const formattedData = trainingData.map((rating) => ({
      instruction: '',
      input: rating.prompt,
      output: rating.responseText,
      sentiment: calculateOverallRating(rating),
    }));
    const jsonData = JSON.stringify(formattedData, null, 2);
    const blob = new Blob([jsonData], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.style.display = 'none';
    anchor.href = url;
    anchor.download = 'training-data.json';
    document.body.appendChild(anchor);
    anchor.click();
    document.body.removeChild(anchor);
    URL.revokeObjectURL(url);
  }, [hasResults, trainingData]);

  const handleDownloadCSV = useCallback(() => {
    if (!hasResults) {
      return;
    }
    let csv = 'Input,Output,Sentiment\n';
    trainingData.forEach((rating) => {
      csv += `"${escapeCSV(rating.prompt)}","${escapeCSV(rating.responseText)}",${calculateOverallRating(
        rating
      )}\n`;
    });
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.style.display = 'none';
    anchor.href = url;
    anchor.download = 'training-data.csv';
    document.body.appendChild(anchor);
    anchor.click();
    document.body.removeChild(anchor);
    URL.revokeObjectURL(url);
  }, [hasResults, trainingData]);

  if (loading) {
    return (
      <PageContainer>
        <FullPageState
          icon={<Loader2 className="h-6 w-6 animate-spin text-primary" />}
          title="Loading training data"
          description="We're getting everything ready."
        />
      </PageContainer>
    );
  }

  if (!account) {
    return (
      <PageContainer>
        <FullPageState
          title="Sign in required"
          description="You need to be signed in to review or export training data."
        />
      </PageContainer>
    );
  }

  if (!game) {
    return (
      <PageContainer>
        <FullPageState
          title="Project unavailable"
          description="We couldn't find this experience. Double-check the URL or your access."
        />
      </PageContainer>
    );
  }

  if (!gamePermissions?.includes('game_viewTrainingData')) {
    return (
      <PageContainer>
        <FullPageState
          title="You don't have access"
          description="Ask an editor to share this project or adjust your permissions to view its training data."
        />
      </PageContainer>
    );
  }

  const filtersSummaryItems = [
    {
      key: 'versions',
      label: selectedVersions.length
        ? `${selectedVersions.length} version${selectedVersions.length === 1 ? '' : 's'}`
        : 'No versions selected',
      accent: 'primary',
    },
    {
      key: 'requests',
      label: `${selectedRequestTypes.length} request type${selectedRequestTypes.length === 1 ? '' : 's'}`,
    },
    {
      key: 'sentiments',
      label: `${selectedSentiments.length} sentiment${selectedSentiments.length === 1 ? '' : 's'}`,
    },
  ];

  if (lastLoadedAt) {
    filtersSummaryItems.push({
      key: 'refreshed',
      label: `Refreshed ${formatRelativeTime(lastLoadedAt)}`,
      icon: Clock,
    });
  }

  const projectTitle = game?.title ?? 'this experience';

  return (
    <PageContainer>
      <header className="space-y-6">
        <div className="space-y-3">
          <span className="inline-flex items-center gap-2 rounded-full border border-primary/30 bg-primary/5 px-4 py-1 text-xs font-semibold uppercase tracking-[0.35em] text-primary">
            Training data
          </span>
          <div className="space-y-2">
            <h1 className="text-4xl font-semibold text-emphasis">Conversation logs & feedback</h1>
            <p className="max-w-2xl text-sm text-muted">
              Filter and export transcripts from {projectTitle} so you can fine-tune prompts, evaluate responses, and coach your AI.
            </p>
          </div>
        </div>
      </header>

      <div className="flex flex-col gap-10">
        <section className="glass-panel space-y-6">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <h2 className="text-lg font-semibold text-emphasis">Filters</h2>
              <p className="text-xs text-muted">Focus on the versions, request types, and sentiment that matter right now.</p>
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <FiltersSummary items={filtersSummaryItems} />
              <button
                type="button"
                onClick={handleResetFilters}
                className="inline-flex items-center gap-2 rounded-full border border-border/60 px-3 py-1.5 text-xs font-semibold text-muted transition hover:border-primary/50 hover:text-primary"
              >
                Reset filters
              </button>
              <button
                type="button"
                onClick={handleRetry}
                className={clsx(
                  'inline-flex items-center gap-2 rounded-full border border-border/60 px-3 py-1.5 text-xs font-semibold text-emphasis transition hover:border-primary/50 hover:text-primary',
                  isLoadingTrainingData && 'pointer-events-none opacity-60'
                )}
              >
                {isLoadingTrainingData ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
                ) : (
                  <RotateCcw className="h-3.5 w-3.5" aria-hidden="true" />
                )}
                Refresh
              </button>
            </div>
          </div>

          <div className="grid gap-4 xl:grid-cols-12">
            <div className="xl:col-span-12">
              <MultiSelectDropdown
                className="rounded-3xl border border-border/60 bg-surface/80 p-5"
                label="Versions"
                description="Choose which builds are included in the data pull."
                options={versionNames}
                selected={selectedVersions}
                onChange={setSelectedVersions}
              />
            </div>
            <div className="xl:col-span-6">
              <FilterSection
                title="Request types"
                subtitle="Zero in on the moments you're reviewing."
                options={requestTypeFilterOptions}
                selected={selectedRequestTypes}
                onChange={setSelectedRequestTypes}
                optionLayout="grid"
              />
            </div>
            <div className="xl:col-span-6">
              <FilterSection
                title="Sentiment"
                subtitle="Flag the feedback that needs your attention."
                options={sentimentFilterOptions}
                selected={selectedSentiments}
                onChange={setSelectedSentiments}
                optionLayout="grid"
              />
            </div>
          </div>
        </section>

        <section className="glass-panel space-y-6">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="space-y-1">
              <h2 className="text-lg font-semibold text-emphasis">Training data preview</h2>
              <p className="text-xs text-muted">
                {isLoadingTrainingData
                  ? 'Loading the latest transcripts...'
                  : hasResults
                  ? `Showing ${displayCount} of ${trainingData.length} results.`
                  : 'Choose filters to pull a snapshot of your training data.'}
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={handleDownloadJSON}
                className={clsx(
                  'button-secondary',
                  (!hasResults || isLoadingTrainingData) && 'pointer-events-none opacity-60'
                )}
              >
                <Download className="h-4 w-4" aria-hidden="true" />
                JSON
              </button>
              <button
                type="button"
                onClick={handleDownloadCSV}
                className={clsx(
                  'button-secondary',
                  (!hasResults || isLoadingTrainingData) && 'pointer-events-none opacity-60'
                )}
              >
                <Download className="h-4 w-4" aria-hidden="true" />
                CSV
              </button>
            </div>
          </div>

          {hasResults ? (
            <div className="space-y-5">
              <div className="grid gap-3 md:grid-cols-3">
                <StatCard
                  icon={Layers}
                  label="Previewed transcripts"
                  value={formatNumber(displayCount)}
                  caption={`Out of ${formatNumber(trainingData.length)} filtered results.`}
                  tone="primary"
                />
                <StatCard
                  icon={Smile}
                  label="Positive sentiment"
                  value={`${formatNumber(sentimentTotals['1'])}`}
                  caption={totalTranscripts ? `${positiveShare}% of this preview.` : 'No transcripts yet.'}
                  tone="emerald"
                />
                <StatCard
                  icon={Frown}
                  label="Needs attention"
                  value={`${formatNumber(sentimentTotals['-1'])}`}
                  caption={totalTranscripts ? `${negativeShare}% of this preview.` : 'No transcripts yet.'}
                  tone="rose"
                />
              </div>
              <div className="overflow-hidden rounded-3xl border border-border/60 bg-surface/85">
                <div className="max-h-[540px] overflow-auto">
                  <table className="min-w-full divide-y divide-border/60 text-left">
                    <thead className="sticky top-0 bg-surface/95 backdrop-blur">
                      <tr>
                        <th className="px-5 py-3 text-xs font-semibold uppercase tracking-[0.2em] text-muted">Prompt</th>
                        <th className="px-5 py-3 text-xs font-semibold uppercase tracking-[0.2em] text-muted">Response</th>
                        <th className="px-5 py-3 text-xs font-semibold uppercase tracking-[0.2em] text-muted">Sentiment</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border/60">
                      {previewRows.map((rating, index) => (
                        <tr key={index} className="align-top">
                          <td className="px-5 py-4 text-sm text-muted">
                            <pre className="whitespace-pre-wrap font-sans text-sm text-muted">
                              {rating.prompt || '-'}
                            </pre>
                          </td>
                          <td className="px-5 py-4 text-sm text-emphasis">
                            <pre className="whitespace-pre-wrap font-sans text-sm text-emphasis">
                              {rating.responseText || '-'}
                            </pre>
                          </td>
                          <td className="px-5 py-4 text-sm font-semibold text-emphasis">
                            {SENTIMENT_META[String(calculateOverallRating(rating))]?.label ??
                              calculateOverallRating(rating)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          ) : !hasVersionSelection ? (
            <InlinePlaceholder
              title="Select at least one version"
              description="Choose which versions you want to include. We'll pull their transcripts and ratings here."
            />
          ) : fetchError ? (
            <InlinePlaceholder
              icon={<AlertTriangle className="h-6 w-6 text-amber-400" />}
              title="Couldn't load training data"
              description={fetchError}
            >
              <button type="button" onClick={handleRetry} className="button-secondary">
                Try again
              </button>
            </InlinePlaceholder>
          ) : isLoadingTrainingData ? (
            <InlinePlaceholder
              icon={<Loader2 className="h-6 w-6 animate-spin text-primary" />}
              title="Loading training data"
              description="Crunching through transcripts and ratings for your selected filters."
            />
          ) : (
            <InlinePlaceholder
              title="No matching data yet"
              description="Adjust your filters or capture more feedback to see transcripts here."
            />
          )}
        </section>
      </div>
    </PageContainer>
  );
}









