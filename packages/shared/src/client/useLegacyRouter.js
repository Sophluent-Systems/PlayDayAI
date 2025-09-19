"use client";

import { useMemo } from "react";
import { useRouter as useNextRouter, usePathname, useSearchParams } from "next/navigation";

const PATHS_WITH_GAME_PARAM = new Set([
  "play",
  "editdetails",
  "editgameversions",
  "editpermissions",
  "sessionlist",
  "trainingdata",
]);

function buildQueryObject(searchParams, pathname) {
  const query = {};

  if (searchParams) {
    for (const key of searchParams.keys()) {
      const value = searchParams.getAll(key);
      query[key] = value.length > 1 ? value : value[0];
    }
  }

  const segments = pathname?.split("/").filter(Boolean) ?? [];
  const [first, second] = segments;

  if (second && PATHS_WITH_GAME_PARAM.has(first)) {
    query.gameUrl = decodeURIComponent(second);
  }

  return query;
}

export function useLegacyRouter() {
  const router = useNextRouter();
  const pathname = usePathname() ?? "/";
  const searchParams = useSearchParams();

  const asPath = useMemo(() => {
    const params = searchParams?.toString();
    return params && params.length > 0 ? `${pathname}?${params}` : pathname;
  }, [pathname, searchParams]);

  const query = useMemo(() => buildQueryObject(searchParams, pathname), [searchParams, pathname]);

  const events = useMemo(
    () => ({
      on: () => {},
      off: () => {},
    }),
    []
  );

  return useMemo(
    () => ({
      push: router.push,
      replace: router.replace,
      prefetch: router.prefetch,
      back: router.back,
      forward: router.forward,
      refresh: router.refresh,
      pathname,
      asPath,
      query,
      isReady: true,
      events,
    }),
    [router, pathname, asPath, query, events]
  );
}
