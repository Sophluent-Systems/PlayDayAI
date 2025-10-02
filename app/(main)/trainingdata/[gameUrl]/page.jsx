'use client';

import React, { useCallback, useContext, useEffect, useMemo, useState } from 'react';
import clsx from 'clsx';
import { Loader2, Download, AlertTriangle } from 'lucide-react';
import { stateManager } from '@src/client/statemanager';
import { callGetTrainingData } from '@src/client/responseratings';

const requestTypeOptions = ['assistant', 'imagePrompt', 'compression'];
const requestTypeLabels = {
  assistant: 'Assistant',
  imagePrompt: 'Image prompts',
  compression: 'Compression',
};
const sentimentOptions = [-1, 0, 1];
const sentimentLabels = {
  '-1': 'Negative',
  '0': 'Neutral',
  '1': 'Positive',
};

function PageContainer({ children }) {
  return (
    <div className="px-4 pt-28 pb-16 sm:px-6 lg:px-12">
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

function FilterGroup({ label, options, selected, onChange, renderOptionLabel }) {
  const allSelected = options.length > 0 && selected.length === options.length;

  const toggleAll = () => {
    if (allSelected) {
      onChange([]);
    } else {
      onChange([...options]);
    }
  };

  const toggleOption = (value) => {
    if (selected.includes(value)) {
      onChange(selected.filter((item) => item !== value));
    } else {
      onChange([...selected, value]);
    }
  };

  return (
    <div className="rounded-3xl border border-border/60 bg-surface/80 p-5">
      <div className="flex items-center justify-between gap-3">
        <p className="text-xs font-semibold uppercase tracking-[0.35em] text-muted">{label}</p>
        {options.length > 0 ? (
          <button
            type="button"
            className="text-xs font-semibold uppercase tracking-wide text-primary transition hover:text-primary/80"
            onClick={toggleAll}
          >
            {allSelected ? 'Clear all' : 'Select all'}
          </button>
        ) : null}
      </div>
      <div className="mt-4 flex flex-wrap gap-2">
        {options.length === 0 ? (
          <span className="text-xs text-muted">No options available yet.</span>
        ) : (
          options.map((option) => {
            const isActive = selected.includes(option);
            const labelContent = renderOptionLabel ? renderOptionLabel(option) : option;
            const key = typeof option === 'string' ? option : String(option);
            return (
              <label
                key={key}
                className={clsx(
                  'cursor-pointer select-none rounded-2xl border px-4 py-2 text-sm font-medium transition-all duration-150',
                  isActive
                    ? 'border-primary/50 bg-primary/10 text-primary shadow-[0_15px_40px_-30px_rgba(79,70,229,0.65)]'
                    : 'border-border/60 bg-surface/90 text-emphasis hover:-translate-y-0.5 hover:border-primary/40 hover:bg-primary/5'
                )}
              >
                <input
                  type="checkbox"
                  className="sr-only"
                  checked={isActive}
                  onChange={() => toggleOption(option)}
                />
                {labelContent}
              </label>
            );
          })
        )}
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

export default function TrainingDataPage() {
  const { loading, account, game, versionList, gamePermissions } = useContext(stateManager);
  const [versionNames, setVersionNames] = useState([]);
  const [selectedVersions, setSelectedVersions] = useState([]);
  const [selectedRequestTypes, setSelectedRequestTypes] = useState(['assistant']);
  const [selectedSentiments, setSelectedSentiments] = useState([...sentimentOptions]);
  const [trainingData, setTrainingData] = useState([]);
  const [isLoadingTrainingData, setIsLoadingTrainingData] = useState(false);
  const [fetchError, setFetchError] = useState(null);
  const [reloadToken, setReloadToken] = useState(0);

  useEffect(() => {
    const names = Array.isArray(versionList) ? versionList.map((version) => version.versionName) : [];
    setVersionNames(names);
    setSelectedVersions((current) => current.filter((name) => names.includes(name)));
  }, [versionList]);

  const versionLookup = useMemo(() => {
    const map = new Map();
    if (Array.isArray(versionList)) {
      for (const entry of versionList) {
        map.set(entry.versionName, entry.versionID);
      }
    }
    return map;
  }, [versionList]);

  useEffect(() => {
    if (!game) {
      return;
    }

    const versionsToSend = selectedVersions
      .map((name) => versionLookup.get(name))
      .filter((value) => value);

    if (selectedVersions.length === 0 || versionsToSend.length === 0) {
      setTrainingData([]);
      setFetchError(null);
      setIsLoadingTrainingData(false);
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

        let result = await callGetTrainingData(game.gameID, filters);
        if (isCancelled) {
          return;
        }

        const normalized = Array.isArray(result) ? result : [];
        const filtered = normalized.filter((rating) =>
          selectedSentiments.includes(calculateOverallRating(rating))
        );
        setTrainingData(filtered);
      } catch (error) {
        if (isCancelled) {
          return;
        }
        console.error('Error fetching training data:', error);
        setTrainingData([]);
        setFetchError('We couldn\'t load training data right now. Try again in a moment.');
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
    game?.gameID,
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

  const handleRetry = useCallback(() => {
    setReloadToken((value) => value + 1);
  }, []);

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

  const filtersSummary = (
    <div className="flex flex-wrap gap-2 text-xs text-muted">
      <span className="tag bg-primary/5 text-primary">
        {selectedVersions.length
          ? `${selectedVersions.length} version${selectedVersions.length === 1 ? '' : 's'}`
          : 'No versions selected'}
      </span>
      <span className="tag">
        {selectedRequestTypes.length} request type{selectedRequestTypes.length === 1 ? '' : 's'}
      </span>
      <span className="tag">
        {selectedSentiments.length} sentiment{selectedSentiments.length === 1 ? '' : 's'}
      </span>
    </div>
  );

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
              Filter and export transcripts from {projectTitle} so you can fine-tune prompts, evaluate
              responses, and coach your AI.
            </p>
          </div>
        </div>
      </header>

      <div className="flex flex-col gap-10">
        <section className="glass-panel space-y-6">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <h2 className="text-lg font-semibold text-emphasis">Filters</h2>
              <p className="text-xs text-muted">
                Focus on the versions, request types, and sentiment that matter right now.
              </p>
            </div>
            {filtersSummary}
          </div>

          <div className="grid gap-4 lg:grid-cols-3">
            <FilterGroup
              label="Versions"
              options={versionNames}
              selected={selectedVersions}
              onChange={setSelectedVersions}
            />
            <FilterGroup
              label="Request types"
              options={requestTypeOptions}
              selected={selectedRequestTypes}
              onChange={setSelectedRequestTypes}
              renderOptionLabel={(value) => requestTypeLabels[value] ?? value}
            />
            <FilterGroup
              label="Sentiment"
              options={sentimentOptions}
              selected={selectedSentiments}
              onChange={setSelectedSentiments}
              renderOptionLabel={(value) => sentimentLabels[String(value)] ?? value}
            />
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

          {!hasVersionSelection ? (
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
          ) : isLoadingTrainingData && !hasResults ? (
            <InlinePlaceholder
              icon={<Loader2 className="h-6 w-6 animate-spin text-primary" />}
              title="Loading training data"
              description="Crunching through transcripts and ratings for your selected filters."
            />
          ) : hasResults ? (
            <div className="overflow-hidden rounded-3xl border border-border/60 bg-surface/80">
              <div className="max-h-[540px] overflow-auto">
                <table className="min-w-full divide-y divide-border/60 text-left">
                  <thead className="sticky top-0 bg-surface/90 backdrop-blur">
                    <tr>
                      <th className="px-5 py-3 text-xs font-semibold uppercase tracking-[0.2em] text-muted">
                        Prompt
                      </th>
                      <th className="px-5 py-3 text-xs font-semibold uppercase tracking-[0.2em] text-muted">
                        Response
                      </th>
                      <th className="px-5 py-3 text-xs font-semibold uppercase tracking-[0.2em] text-muted">
                        Sentiment
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/60">
                    {previewRows.map((rating, index) => (
                      <tr key={index}>
                        <td className="align-top px-5 py-4 text-sm text-muted">
                          <pre className="whitespace-pre-wrap font-sans text-sm text-muted">
                            {rating.prompt || '—'}
                          </pre>
                        </td>
                        <td className="align-top px-5 py-4 text-sm text-emphasis">
                          <pre className="whitespace-pre-wrap font-sans text-sm text-emphasis">
                            {rating.responseText || '—'}
                          </pre>
                        </td>
                        <td className="align-top px-5 py-4 text-sm font-semibold text-emphasis">
                          {sentimentLabels[String(calculateOverallRating(rating))] ??
                            calculateOverallRating(rating)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
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


