"use client";

import * as React from "react";
import type { BusinessResult } from "@/lib/business-finder-types";

// Local to this browser only — there's no per-user session in this CRM to
// hang a database row off (see src/lib/current-user.ts), and neither of
// these needs to survive a device change, so localStorage is the honest,
// unover-engineered choice here per the product spec.

export type RecentSearch = {
  id: string;
  query: string;
  location: string;
  radiusMiles: number;
  category: string | null;
  categoryLabel: string | null;
  timestamp: number;
};

const RECENT_SEARCHES_KEY = "prmote:business-finder:recent-searches";
const SAVED_BUSINESSES_KEY = "prmote:business-finder:saved";
const MAX_RECENT = 8;

function readStorage<T>(key: string, fallback: T): T {
  if (typeof window === "undefined") return fallback;
  try {
    const raw = window.localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

function writeStorage<T>(key: string, value: T) {
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // localStorage can throw in private-browsing/quota-exceeded situations — non-critical, just skip persisting.
  }
}

export function useRecentSearches() {
  const [searches, setSearches] = React.useState<RecentSearch[]>([]);

  React.useEffect(() => {
    setSearches(readStorage(RECENT_SEARCHES_KEY, []));
  }, []);

  const addSearch = React.useCallback((entry: Omit<RecentSearch, "id" | "timestamp">) => {
    setSearches((prev) => {
      const deduped = prev.filter(
        (s) => !(s.query === entry.query && s.location === entry.location && s.radiusMiles === entry.radiusMiles && s.category === entry.category)
      );
      const next = [{ ...entry, id: crypto.randomUUID(), timestamp: Date.now() }, ...deduped].slice(0, MAX_RECENT);
      writeStorage(RECENT_SEARCHES_KEY, next);
      return next;
    });
  }, []);

  return { searches, addSearch };
}

export function useSavedBusinesses() {
  const [saved, setSaved] = React.useState<Record<string, BusinessResult>>({});

  React.useEffect(() => {
    setSaved(readStorage(SAVED_BUSINESSES_KEY, {}));
  }, []);

  const toggleSaved = React.useCallback((business: BusinessResult) => {
    setSaved((prev) => {
      const next = { ...prev };
      if (next[business.placeId]) delete next[business.placeId];
      else next[business.placeId] = business;
      writeStorage(SAVED_BUSINESSES_KEY, next);
      return next;
    });
  }, []);

  return { saved, toggleSaved, isSaved: (placeId: string) => Boolean(saved[placeId]) };
}
