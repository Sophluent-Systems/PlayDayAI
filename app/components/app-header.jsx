'use client';

import { memo } from 'react';
import dynamic from 'next/dynamic';

const UserProfileMenu = dynamic(() => import('@src/client/components/userprofilemenu'), {
  ssr: false,
  loading: () => (
    <div className="h-10 w-10 rounded-full border border-slate-200 bg-slate-100" aria-hidden="true" />
  ),
});

const ProjectMenuLauncher = dynamic(() => import('@src/client/components/projectmenulauncher').then(mod => ({ default: mod.ProjectMenuLauncher })), {
  ssr: false,
  loading: () => (
    <div className="h-10 w-40 rounded-full border border-slate-200 bg-slate-100" aria-hidden="true" />
  ),
});

function AppHeaderComponent() {
  return (
    <header className="pointer-events-none fixed inset-x-0 top-0 z-50">
      <div className="pointer-events-none mx-auto flex w-full max-w-7xl items-center justify-between px-4 py-4 sm:px-8 lg:px-12">
        <div className="pointer-events-none ">
          <ProjectMenuLauncher placement="inline" allowEditOptions includePlayOption />
        </div>
        <div className="pointer-events-auto">
          <UserProfileMenu variant="bug" />
        </div>
      </div>
    </header>
  );
}

const AppHeader = memo(AppHeaderComponent);

export default AppHeader;
