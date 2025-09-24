"use client";

import React, { useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import clsx from 'clsx';
import { useRouter, usePathname, useSearchParams } from 'next/navigation';
import {
  ChevronDown,
  Home,
  LogOut,
  LogIn,
  Settings,
  ShieldCheck,
  Sparkles,
  Users,
  Wrench,
} from 'lucide-react';
import { stateManager } from '@src/client/statemanager';

const baseButtonClasses =
  'group relative inline-flex items-center gap-2 rounded-full border border-border/70 bg-surface/80 px-4 py-2 text-sm font-semibold text-emphasis shadow-soft transition-all duration-200 hover:-translate-y-0.5 hover:border-primary/50 hover:text-primary';

function AvatarBubble({ account }) {
  const displayName = account?.profile?.displayName || account?.email || '';
  const fallback = displayName ? displayName.charAt(0).toUpperCase() : '?';
  const picture = account?.profile?.profilePictureUrl;

  if (picture) {
    return (
      <span className="relative block h-9 w-9 overflow-hidden rounded-full border border-border/60">
        <img src={picture} alt={displayName} className="h-full w-full object-cover" />
      </span>
    );
  }

  return (
    <span className="flex h-9 w-9 items-center justify-center rounded-full border border-border/70 bg-primary/10 text-sm font-semibold text-primary">
      {fallback}
    </span>
  );
}

function MenuSection({ title, children }) {
  return (
    <div className="space-y-2 border-t border-border/60 pt-4 first:border-t-0 first:pt-0">
      {title ? <p className="text-xs font-semibold uppercase tracking-wide text-muted">{title}</p> : null}
      <div className="space-y-1">{children}</div>
    </div>
  );
}

function MenuButton({ icon: Icon, label, description, onClick, href, target, className }) {
  const content = (
    <div className={clsx('flex w-full items-start gap-2 rounded-2xl px-3 py-2 text-left transition-colors', className)}>
      <span className="mt-0.5 flex h-8 w-8 items-center justify-center rounded-xl border border-border/60 bg-surface/80 text-muted">
        <Icon className="h-4 w-4" aria-hidden="true" />
      </span>
      <span className="flex-1">
        <span className="block text-sm font-semibold text-emphasis">{label}</span>
        {description ? <span className="block text-xs text-muted">{description}</span> : null}
      </span>
    </div>
  );

  if (href) {
    return (
      <Link href={href} target={target} className="block" onClick={onClick}>
        {content}
      </Link>
    );
  }

  return (
    <button type="button" onClick={onClick} className="block w-full">
      {content}
    </button>
  );
}

function ToggleRow({ checked, onToggle, label, description }) {
  return (
    <button
      type="button"
      onClick={() => onToggle(!checked)}
      className={clsx(
        'flex w-full items-center justify-between rounded-2xl border border-border/60 bg-surface/80 px-4 py-3 text-left transition-colors',
        checked ? 'border-primary/60 bg-primary/10 text-primary' : 'hover:border-primary/40'
      )}
    >
      <div>
        <p className="text-sm font-semibold text-emphasis">{label}</p>
        {description ? <p className="text-xs text-muted">{description}</p> : null}
      </div>
      <span
        className={clsx(
          'relative inline-flex h-5 w-9 items-center rounded-full border border-border/60 bg-border/60 transition-colors',
          checked ? 'border-primary/60 bg-primary/40' : 'bg-border/60'
        )}
        aria-hidden="true"
      >
        <span
          className={clsx(
            'absolute left-0.5 inline-block h-4 w-4 rounded-full bg-surface shadow transition-transform',
            checked ? 'translate-x-4' : 'translate-x-0'
          )}
        />
      </span>
    </button>
  );
}

export function UserProfileMenu({ className }) {
  const {
    loading,
    account,
    editMode,
    setAccountPreference,
    hasServicePerms,
  } = useContext(stateManager);
  const [open, setOpen] = useState(false);
  const [dropdownPosition, setDropdownPosition] = useState({ top: 0, right: 0 });
  const containerRef = useRef(null);
  const triggerRef = useRef(null);
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const isLoggedIn = !loading && Boolean(account);

  const returnTo = useMemo(() => {
    const search = searchParams?.toString();
    const suffix = search ? `?${search}` : '';
    return `${pathname || '/' }${suffix}`;
  }, [pathname, searchParams]);

  useEffect(() => {
    function handleClick(event) {
      if (!open) {
        return;
      }
      if (
        containerRef.current &&
        !containerRef.current.contains(event.target) &&
        triggerRef.current &&
        !triggerRef.current.contains(event.target)
      ) {
        setOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [open]);

  // Calculate dropdown position when opening
  useEffect(() => {
    if (open && triggerRef.current) {
      const rect = triggerRef.current.getBoundingClientRect();
      const viewportWidth = window.innerWidth;
      const dropdownWidth = 320; // w-80 = 20rem = 320px

      // Calculate position to ensure dropdown stays within viewport
      let rightOffset = viewportWidth - rect.right;

      // If dropdown would overflow left side, adjust position
      if (rect.right - dropdownWidth < 0) {
        rightOffset = viewportWidth - dropdownWidth - 16; // 16px margin
      }

      setDropdownPosition({
        top: rect.bottom + 12, // 12px gap (mt-3)
        right: rightOffset,
      });
    }
  }, [open]);

  const closeMenu = useCallback(() => setOpen(false), []);

  const handleNavigation = useCallback(
    (href) => {
      closeMenu();
      router.push(href);
    },
    [closeMenu, router]
  );

  const handleToggleEditMode = useCallback(
    (next) => {
      setAccountPreference?.('editMode', next);
    },
    [setAccountPreference]
  );

  const handleLogout = useCallback(() => {
    const url = `/auth/logout?returnTo=${encodeURIComponent(returnTo)}`;
    closeMenu();
    if (typeof window !== 'undefined') {
      window.location.href = url;
    }
  }, [returnTo, closeMenu]);

  const handleLogin = useCallback(() => {
    const url = `/auth/login?returnTo=${encodeURIComponent(returnTo)}`;
    closeMenu();
    if (typeof window !== 'undefined') {
      window.location.href = url;
    }
  }, [returnTo, closeMenu]);

  const showEditToggle = useMemo(
    () => isLoggedIn && account?.roles?.servicePermissions?.includes('service_editMode'),
    [isLoggedIn, account?.roles?.servicePermissions]
  );

  const showAdminLinks = useMemo(
    () => Boolean(hasServicePerms?.('service_modifyGlobalPermissions')),
    [hasServicePerms]
  );

  return (
    <div className={clsx('relative', className)}>
      <button
        type="button"
        ref={triggerRef}
        onClick={() => setOpen((prev) => !prev)}
        className={clsx(baseButtonClasses, open ? 'border-primary/60 text-primary' : null)}
        aria-expanded={open}
        aria-haspopup="true"
      >
        {isLoggedIn ? <AvatarBubble account={account} /> : <Users className="h-4 w-4" aria-hidden="true" />}
        <span className="hidden sm:inline">
          {isLoggedIn ? account.profile?.displayName || account.email : 'Account'}
        </span>
        <ChevronDown className="h-4 w-4 text-muted transition-transform group-aria-expanded:rotate-180" aria-hidden="true" />
        {showEditToggle && editMode ? (
          <span className="hidden rounded-full bg-primary/20 px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-primary sm:inline">
            Edit mode
          </span>
        ) : null}
      </button>

      {open ? (
        <div
          ref={containerRef}
          className="fixed z-[60] w-80 min-w-[18rem] origin-top-right rounded-3xl border border-border/70 bg-surface/95 p-4 shadow-[0_32px_80px_-32px_rgba(15,23,42,0.6)] backdrop-blur"
          style={{
            top: `${dropdownPosition.top}px`,
            right: `${dropdownPosition.right}px`,
          }}
        >
          {isLoggedIn ? (
            <div className="flex items-center gap-3 rounded-2xl border border-border/60 bg-surface/80 px-3 py-3">
              <AvatarBubble account={account} />
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold text-emphasis">
                  {account.profile?.displayName || account.email}
                </p>
                <p className="truncate text-xs text-muted">{account.email}</p>
              </div>
            </div>
          ) : (
            <div className="rounded-2xl border border-dashed border-border/60 bg-surface/70 px-3 py-4 text-center text-sm text-muted">
              Sign in to access preferences and edit tools.
            </div>
          )}

          <MenuSection>
            <MenuButton
              icon={Home}
              label="Home"
              description="Jump back to the overview"
              onClick={() => handleNavigation('/')}
            />
            <MenuButton
              icon={Settings}
              label="Preferences"
              description="Update your profile and notifications"
              onClick={() => handleNavigation('/account/preferences')}
            />
          </MenuSection>

          {showEditToggle ? (
            <MenuSection title="Workspace">
              <ToggleRow
                checked={Boolean(editMode)}
                onToggle={handleToggleEditMode}
                label={editMode ? 'Edit mode is on' : 'Enable edit mode'}
                description={editMode ? 'Developer tools and draft content visible' : 'Show builder controls and draft nodes'}
              />
            </MenuSection>
          ) : null}

          {showAdminLinks ? (
            <MenuSection title="Admin">
              <MenuButton
                icon={ShieldCheck}
                label="Invite codes"
                onClick={() => handleNavigation('/admin/codes')}
              />
              <MenuButton
                icon={Sparkles}
                label="Access requests"
                onClick={() => handleNavigation('/admin/accessapprovals')}
              />
              <MenuButton
                icon={Users}
                label="User permissions"
                onClick={() => handleNavigation('/admin/userpermissions')}
              />
              <MenuButton
                icon={Wrench}
                label="Site access"
                onClick={() => handleNavigation('/admin/siteaccess')}
              />
            </MenuSection>
          ) : null}

          <MenuSection>
            {isLoggedIn ? (
              <MenuButton
                icon={LogOut}
                label="Sign out"
                description="Log out of this workspace"
                onClick={handleLogout}
                className="hover:bg-red-50"
              />
            ) : (
              <MenuButton
                icon={LogIn}
                label="Sign in"
                description="Access projects and edit tools"
                onClick={handleLogin}
              />
            )}
          </MenuSection>
        </div>
      ) : null}
    </div>
  );
}

export default UserProfileMenu;

