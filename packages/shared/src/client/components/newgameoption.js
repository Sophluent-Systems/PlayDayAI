"use client";

import React, { memo, useState } from "react";
import { Plus } from "lucide-react";
import { Modal } from "@src/client/components/ui/modal";
import { PrimaryButton, SecondaryButton } from "@src/client/components/ui/button";
import { callCreateNewGame } from "@src/client/gameplay";
import { useRouter } from "next/navigation";

function hasValidSlug(value) {
  return /^(?!.*\/\/)[a-zA-Z0-9-_]+$/.test(value ?? "");
}

function NewGameListOption() {
  const router = useRouter();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [slug, setSlug] = useState("");
  const [saving, setSaving] = useState(false);

  const openDialog = () => setDialogOpen(true);
  const closeDialog = () => {
    setDialogOpen(false);
    setTitle("");
    setSlug("");
    setSaving(false);
  };

  const canCreate = title.trim().length > 0 && hasValidSlug(slug);

  const handleCreate = async () => {
    if (!canCreate) {
      return;
    }
    setSaving(true);
    try {
      await callCreateNewGame(title.trim(), slug.trim());
      closeDialog();
      router.push(`/editgameversions/${slug.trim()}`);
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <button
        type="button"
        onClick={openDialog}
        className="flex w-full items-center gap-3 rounded-2xl border border-border/60 bg-surface px-4 py-3 text-sm font-medium text-emphasis transition hover:border-primary/40 hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
      >
        <span className="flex h-9 w-9 items-center justify-center rounded-full bg-primary/10 text-primary">
          <Plus className="h-4 w-4" aria-hidden="true" />
        </span>
        <span>Create a new experience</span>
      </button>

      <Modal
        open={dialogOpen}
        onClose={closeDialog}
        title="Create new experience"
        description="Choose a title and short URL. You can refine the details later."
        footer={[
          <SecondaryButton key="cancel" onClick={closeDialog} disabled={saving}>
            Cancel
          </SecondaryButton>,
          <PrimaryButton key="create" onClick={handleCreate} disabled={!canCreate || saving}>
            {saving ? "Creating…" : "Create"}
          </PrimaryButton>,
        ]}
      >
        <div className="space-y-4">
          <label className="flex flex-col gap-2 text-sm font-semibold text-emphasis">
            <span>Title</span>
            <input
              value={title}
              onChange={(event) => {
                const next = event.target.value;
                setTitle(next);
                if (!slug && next) {
                  setSlug(
                    next
                      .toLowerCase()
                      .replace(/[^a-z0-9-_]/g, '-')
                      .replace(/-+/g, '-')
                      .replace(/^-|-$/g, '')
                  );
                }
              }}
              placeholder="Neon City Heist"
              className="rounded-2xl border border-border/60 bg-surface px-4 py-3 text-sm text-emphasis shadow-inner focus:border-primary focus:outline-none"
            />
          </label>

          <label className="flex flex-col gap-2 text-sm font-semibold text-emphasis">
            <span>URL slug</span>
            <div className="flex items-center gap-2 rounded-2xl border border-border/60 bg-surface px-4 py-3">
              <span className="text-sm text-muted">playday.ai/</span>
              <input
                value={slug}
                onChange={(event) => setSlug(event.target.value)}
                placeholder="neon-heist"
                className="flex-1 bg-transparent text-sm text-emphasis focus:outline-none"
              />
            </div>
            {!hasValidSlug(slug) && slug ? (
              <span className="text-xs text-rose-400">Use letters, numbers, hyphens, or underscores only.</span>
            ) : null}
          </label>
        </div>
      </Modal>
    </>
  );
}

export default memo(NewGameListOption);
