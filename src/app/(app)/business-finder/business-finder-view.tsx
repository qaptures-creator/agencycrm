"use client";

import * as React from "react";
import { toast } from "sonner";
import { MapPin, Search, AlertTriangle, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { EmptyState } from "@/components/empty-state";
import { addBusinessToLead, addBusinessesToLead } from "@/actions/business-finder";
import {
  passesReviewFilter,
  sortBusinesses,
  RATING_FILTERS,
  type BusinessResult,
} from "@/lib/business-finder-types";
import { BusinessCard } from "./business-card";
import { SearchBar, ResultFilters, RecentSearches, DEFAULT_FILTERS, type FilterState } from "./search-controls";
import { useRecentSearches, useSavedBusinesses, type RecentSearch } from "./hooks";

type SearchResponse = {
  results: BusinessResult[];
  nextPageToken: string | null;
  center: { lat: number; lng: number };
  formattedAddress: string;
  radiusMiles: number;
};
type SearchErrorResponse = { error: string; message: string };

/**
 * Snapshot of exactly what search produced the current results, frozen at
 * the moment that search succeeds. Load More reads ONLY from this — never
 * from the live form fields — so editing the search box after results load
 * can't leak into a pagination request. This is also what lets a pagination
 * request reproduce the original Google Places request exactly (same
 * textQuery + resolved center), which Places API (New) requires.
 */
type ActiveSearch = {
  query: string;
  location: string;
  radiusMiles: number;
  category: string;
  center: { lat: number; lng: number };
};

function mergeAppendedResults(existing: BusinessResult[], incoming: BusinessResult[]): BusinessResult[] {
  // Existing entries win on overlap so already-fetched Instagram/CRM state
  // from an earlier page is never clobbered by a fresh, unenriched copy of
  // the same business appearing again in a later page.
  const seen = new Set(existing.map((b) => b.placeId));
  return [...existing, ...incoming.filter((b) => !seen.has(b.placeId))];
}

const ENRICH_CONCURRENCY = 3;

export function BusinessFinderView({ categories }: { categories: { value: string; label: string }[] }) {
  const [query, setQuery] = React.useState("");
  const [location, setLocation] = React.useState("");
  const [radiusMiles, setRadiusMiles] = React.useState(5);
  const [category, setCategory] = React.useState("");

  const [filters, setFilters] = React.useState<FilterState>(DEFAULT_FILTERS);
  const [results, setResults] = React.useState<BusinessResult[]>([]);
  const [nextPageToken, setNextPageToken] = React.useState<string | null>(null);
  const [activeSearch, setActiveSearch] = React.useState<ActiveSearch | null>(null);
  const [formattedAddress, setFormattedAddress] = React.useState<string | null>(null);
  const [searchedRadius, setSearchedRadius] = React.useState<number | null>(null);

  const [loading, setLoading] = React.useState(false);
  const [loadingMore, setLoadingMore] = React.useState(false);
  const [hasSearched, setHasSearched] = React.useState(false);
  const [errorMessage, setErrorMessage] = React.useState<string | null>(null);
  const [loadMoreError, setLoadMoreError] = React.useState<string | null>(null);

  const [selectedIds, setSelectedIds] = React.useState<Set<string>>(new Set());
  const [addingIds, setAddingIds] = React.useState<Set<string>>(new Set());
  const [enrichingIds, setEnrichingIds] = React.useState<Set<string>>(new Set());
  const [bulkAdding, setBulkAdding] = React.useState(false);

  const { searches: recentSearches, addSearch } = useRecentSearches();
  const { isSaved, toggleSaved } = useSavedBusinesses();

  const enrichQueueRef = React.useRef<string[]>([]);
  const enrichRunningRef = React.useRef(0);
  const resultsRef = React.useRef<BusinessResult[]>([]);
  React.useEffect(() => {
    resultsRef.current = results;
  }, [results]);

  const runEnrichment = React.useCallback(async (business: BusinessResult) => {
    if (!business.website) return;
    setEnrichingIds((prev) => new Set(prev).add(business.placeId));
    try {
      const res = await fetch(`/api/business-finder/enrich?website=${encodeURIComponent(business.website)}`);
      const data = await res.json().catch(() => ({ instagram: null }));
      setResults((prev) =>
        prev.map((b) => (b.placeId === business.placeId ? { ...b, instagram: data.instagram ?? null, instagramChecked: true } : b))
      );
    } catch {
      setResults((prev) => prev.map((b) => (b.placeId === business.placeId ? { ...b, instagramChecked: true } : b)));
    } finally {
      setEnrichingIds((prev) => {
        const next = new Set(prev);
        next.delete(business.placeId);
        return next;
      });
    }
  }, []);

  // A plain function (not useCallback) so the recursive self-reference below
  // always resolves against the current closure — no stale-reference risk.
  function pumpQueue() {
    while (enrichRunningRef.current < ENRICH_CONCURRENCY && enrichQueueRef.current.length > 0) {
      const placeId = enrichQueueRef.current.shift();
      const business = resultsRef.current.find((b) => b.placeId === placeId);
      if (!business) continue;
      enrichRunningRef.current += 1;
      runEnrichment(business).finally(() => {
        enrichRunningRef.current -= 1;
        pumpQueue();
      });
    }
  }

  function enqueueEnrichment(businesses: BusinessResult[]) {
    for (const b of businesses) {
      if (b.website && !b.instagramChecked) enrichQueueRef.current.push(b.placeId);
    }
    pumpQueue();
  }

  /** A brand-new search — always reads the live form fields. Fully resets paging state. */
  async function performSearch() {
    if (!query.trim() && !category) {
      setErrorMessage("Enter a business type or choose a category.");
      return;
    }
    if (!location.trim()) {
      setErrorMessage("Enter a location to search near.");
      return;
    }

    setLoading(true);
    setErrorMessage(null);
    setLoadMoreError(null);
    // A new search discards any in-flight pagination context outright —
    // pagination and new-search state are never allowed to mix.
    setNextPageToken(null);
    setActiveSearch(null);
    setResults([]);
    setSelectedIds(new Set());

    const trimmedQuery = query.trim();
    const trimmedLocation = location.trim();
    const params = new URLSearchParams({ q: trimmedQuery, location: trimmedLocation, radius: String(radiusMiles) });
    if (category) params.set("category", category);

    try {
      const res = await fetch(`/api/business-finder/search?${params.toString()}`);
      const data = (await res.json()) as SearchResponse | SearchErrorResponse;

      if (!res.ok || "error" in data) {
        setErrorMessage("message" in data ? data.message : "Something went wrong running that search.");
        return;
      }

      setFormattedAddress(data.formattedAddress);
      setSearchedRadius(data.radiusMiles);
      setNextPageToken(data.nextPageToken);
      setHasSearched(true);
      setResults(data.results);
      setActiveSearch({ query: trimmedQuery, location: trimmedLocation, radiusMiles, category, center: data.center });
      addSearch({
        query: trimmedQuery,
        location: trimmedLocation,
        radiusMiles,
        category: category || null,
        categoryLabel: categories.find((c) => c.value === category)?.label ?? null,
      });
      enqueueEnrichment(data.results);
    } catch {
      setErrorMessage("Couldn't reach the server. Check your connection and try again.");
    } finally {
      setLoading(false);
    }
  }

  /** Load More — reads ONLY activeSearch, never the (possibly since-edited) live form fields. */
  async function handleLoadMore() {
    if (!activeSearch || !nextPageToken) {
      setLoadMoreError("Unable to load more results because the original search context is missing. Please run the search again.");
      return;
    }

    setLoadingMore(true);
    setLoadMoreError(null);

    const params = new URLSearchParams({
      q: activeSearch.query,
      location: activeSearch.location,
      radius: String(activeSearch.radiusMiles),
      lat: String(activeSearch.center.lat),
      lng: String(activeSearch.center.lng),
      pageToken: nextPageToken,
    });
    if (activeSearch.category) params.set("category", activeSearch.category);

    try {
      const res = await fetch(`/api/business-finder/search?${params.toString()}`);
      const data = (await res.json()) as SearchResponse | SearchErrorResponse;

      if (!res.ok || "error" in data) {
        setLoadMoreError("message" in data ? data.message : "Couldn't load more results.");
        return;
      }

      setNextPageToken(data.nextPageToken);
      setResults((prev) => mergeAppendedResults(prev, data.results));
      enqueueEnrichment(data.results);
    } catch {
      setLoadMoreError("Couldn't reach the server. Check your connection and try again.");
    } finally {
      setLoadingMore(false);
    }
  }

  function handleRunRecent(s: RecentSearch) {
    setQuery(s.query);
    setLocation(s.location);
    setRadiusMiles(s.radiusMiles);
    setCategory(s.category ?? "");
    // Let state settle before firing — performSearch reads the state vars directly.
    setTimeout(() => performSearch(), 0);
  }

  async function handleAddToCrm(business: BusinessResult) {
    setAddingIds((prev) => new Set(prev).add(business.placeId));
    try {
      const outcome = await addBusinessToLead(business);
      if (outcome.status === "created") {
        toast.success(`${outcome.businessName} added to CRM`);
        setResults((prev) =>
          prev.map((b) => (b.placeId === business.placeId ? { ...b, crmMatch: { type: "lead", id: outcome.leadId, href: `/crm?lead=${outcome.leadId}` } } : b))
        );
      } else {
        toast.message(`${outcome.businessName} is already in the CRM`);
        setResults((prev) => prev.map((b) => (b.placeId === business.placeId ? { ...b, crmMatch: outcome.match } : b)));
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Couldn't add this lead");
    } finally {
      setAddingIds((prev) => {
        const next = new Set(prev);
        next.delete(business.placeId);
        return next;
      });
    }
  }

  async function handleBulkAdd() {
    const selected = results.filter((b) => selectedIds.has(b.placeId));
    if (selected.length === 0) return;
    setBulkAdding(true);
    try {
      const summary = await addBusinessesToLead(selected);
      const parts = [`${summary.added} lead${summary.added === 1 ? "" : "s"} added`];
      if (summary.alreadyExisted > 0) parts.push(`${summary.alreadyExisted} already existed`);
      if (summary.failed > 0) parts.push(`${summary.failed} failed`);
      toast[summary.failed > 0 ? "warning" : "success"](parts.join(" · "));

      // Re-check CRM status for everything we just tried, rather than tracking id-by-id.
      setSelectedIds(new Set());
      performSearch();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Bulk add failed");
    } finally {
      setBulkAdding(false);
    }
  }

  function toggleSelect(placeId: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      next.has(placeId) ? next.delete(placeId) : next.add(placeId);
      return next;
    });
  }

  const filtered = React.useMemo(() => {
    const ratingMin = RATING_FILTERS.find((r) => r.value === filters.rating)?.min ?? 0;
    const narrowed = results.filter((b) => {
      if ((b.rating ?? 0) < ratingMin && filters.rating !== "ANY") return false;
      if (!passesReviewFilter(b.reviewCount, filters.reviews)) return false;
      if (filters.website === "HAS_WEBSITE" && !b.website) return false;
      if (filters.website === "NO_WEBSITE" && b.website) return false;
      if (filters.instagram === "FOUND" && !b.instagram) return false;
      if (filters.instagram === "NOT_FOUND" && b.instagram) return false;
      if (filters.crm === "NOT_IN_CRM" && b.crmMatch) return false;
      if (filters.crm === "IN_CRM" && !b.crmMatch) return false;
      return true;
    });
    return sortBusinesses(narrowed, filters.sort);
  }, [results, filters]);

  const selectableVisible = filtered.filter((b) => !b.crmMatch);
  const allVisibleSelected = selectableVisible.length > 0 && selectableVisible.every((b) => selectedIds.has(b.placeId));

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl font-semibold tracking-tight">Business Finder</h1>
        <p className="text-sm text-muted-foreground">Find local businesses near a location and add promising ones straight to your CRM pipeline.</p>
      </div>

      <div className="rounded-xl border border-border bg-card p-4">
        <SearchBar
          query={query}
          onQueryChange={setQuery}
          location={location}
          onLocationChange={setLocation}
          radiusMiles={radiusMiles}
          onRadiusChange={setRadiusMiles}
          category={category}
          onCategoryChange={setCategory}
          categories={categories}
          onSearch={() => performSearch()}
          searching={loading}
        />
      </div>

      <RecentSearches searches={recentSearches} onRun={handleRunRecent} />

      {errorMessage && (
        <div className="flex items-start gap-2 rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          <AlertTriangle className="mt-0.5 size-4 shrink-0" />
          <span>{errorMessage}</span>
        </div>
      )}

      {loading && (
        <div className="flex items-center justify-center gap-2 py-16 text-sm text-muted-foreground">
          <Loader2 className="size-4 animate-spin" /> Searching Google for businesses…
        </div>
      )}

      {!loading && hasSearched && !errorMessage && (
        <>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-sm font-medium">
                {filtered.length} business{filtered.length === 1 ? "" : "es"} found{formattedAddress ? ` near ${formattedAddress}` : ""}
              </p>
              {searchedRadius != null && <p className="text-xs text-muted-foreground">Within {searchedRadius} mile{searchedRadius === 1 ? "" : "s"}</p>}
            </div>
            <ResultFilters filters={filters} onChange={setFilters} />
          </div>

          {selectableVisible.length > 0 && (
            <div className="flex flex-wrap items-center gap-3 rounded-lg border border-border bg-secondary/30 px-3 py-2">
              <label className="flex items-center gap-2 text-sm">
                <Checkbox
                  checked={allVisibleSelected}
                  onCheckedChange={(checked) =>
                    setSelectedIds(checked ? new Set(selectableVisible.map((b) => b.placeId)) : new Set())
                  }
                />
                Select all visible
              </label>
              {selectedIds.size > 0 && (
                <Button size="sm" onClick={handleBulkAdd} disabled={bulkAdding}>
                  {bulkAdding ? "Adding…" : `Add Selected to CRM (${selectedIds.size})`}
                </Button>
              )}
            </div>
          )}

          {filtered.length === 0 ? (
            <EmptyState icon={Search} title="No businesses match your filters" description="Try widening a filter, or clear them to see the full result set." />
          ) : (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
              {filtered.map((business) => (
                <BusinessCard
                  key={business.placeId}
                  business={business}
                  selected={selectedIds.has(business.placeId)}
                  onToggleSelect={toggleSelect}
                  saved={isSaved(business.placeId)}
                  onToggleSave={toggleSaved}
                  onFindInstagram={runEnrichment}
                  enriching={enrichingIds.has(business.placeId)}
                  onAddToCrm={handleAddToCrm}
                  adding={addingIds.has(business.placeId)}
                />
              ))}
            </div>
          )}

          {nextPageToken && (
            <div className="flex flex-col items-center gap-2 pt-2">
              <Button variant="outline" onClick={handleLoadMore} disabled={loadingMore}>
                {loadingMore ? "Loading more..." : "Load More"}
              </Button>
              {loadMoreError && (
                <p className="flex items-center gap-1.5 text-xs text-destructive">
                  <AlertTriangle className="size-3.5 shrink-0" /> {loadMoreError}
                </p>
              )}
            </div>
          )}
        </>
      )}

      {!loading && !hasSearched && !errorMessage && (
        <EmptyState
          icon={MapPin}
          title="Search for local businesses to prospect"
          description='Enter a business type and a location above — e.g. "Gyms" near "Slough" — then press Search.'
        />
      )}
    </div>
  );
}
