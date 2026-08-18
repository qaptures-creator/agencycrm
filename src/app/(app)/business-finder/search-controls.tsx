"use client";

import { Search, SlidersHorizontal, History } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetBody, SheetTrigger } from "@/components/ui/sheet";
import {
  RADIUS_OPTIONS_MILES,
  RATING_FILTERS,
  REVIEW_FILTERS,
  WEBSITE_FILTERS,
  INSTAGRAM_FILTERS,
  CRM_FILTERS,
  SORT_OPTIONS,
  type RatingFilterValue,
  type ReviewFilterValue,
  type WebsiteFilterValue,
  type InstagramFilterValue,
  type CrmFilterValue,
  type SortValue,
} from "@/lib/business-finder-types";
import type { RecentSearch } from "./hooks";

export type FilterState = {
  sort: SortValue;
  rating: RatingFilterValue;
  reviews: ReviewFilterValue;
  website: WebsiteFilterValue;
  instagram: InstagramFilterValue;
  crm: CrmFilterValue;
};

export const DEFAULT_FILTERS: FilterState = {
  sort: "BEST_PROSPECT",
  rating: "ANY",
  reviews: "ANY",
  website: "ANY",
  instagram: "ANY",
  crm: "ALL",
};

function activeFilterCount(f: FilterState): number {
  let n = 0;
  if (f.rating !== "ANY") n++;
  if (f.reviews !== "ANY") n++;
  if (f.website !== "ANY") n++;
  if (f.instagram !== "ANY") n++;
  if (f.crm !== "ALL") n++;
  return n;
}

export function SearchBar({
  query,
  onQueryChange,
  location,
  onLocationChange,
  radiusMiles,
  onRadiusChange,
  category,
  onCategoryChange,
  categories,
  onSearch,
  searching,
}: {
  query: string;
  onQueryChange: (v: string) => void;
  location: string;
  onLocationChange: (v: string) => void;
  radiusMiles: number;
  onRadiusChange: (v: number) => void;
  category: string;
  onCategoryChange: (v: string) => void;
  categories: { value: string; label: string }[];
  onSearch: () => void;
  searching: boolean;
}) {
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        onSearch();
      }}
      className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-[2fr_2fr_1fr_1.4fr_auto]"
    >
      <div className="space-y-1.5">
        <Label htmlFor="bf-query">Business type</Label>
        <Input id="bf-query" placeholder="e.g. Gyms, car detailing, dentists…" value={query} onChange={(e) => onQueryChange(e.target.value)} />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="bf-location">Location</Label>
        <Input id="bf-location" placeholder="Town, postcode, or area" value={location} onChange={(e) => onLocationChange(e.target.value)} />
      </div>
      <div className="space-y-1.5">
        <Label>Radius</Label>
        <Select value={String(radiusMiles)} onValueChange={(v) => onRadiusChange(Number(v))}>
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent>
            {RADIUS_OPTIONS_MILES.map((m) => (
              <SelectItem key={m} value={String(m)}>{m} mile{m === 1 ? "" : "s"}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="space-y-1.5">
        <Label>Category (optional)</Label>
        <Select value={category || "NONE"} onValueChange={(v) => onCategoryChange(v === "NONE" ? "" : v)}>
          <SelectTrigger><SelectValue placeholder="Any category" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="NONE">Any category</SelectItem>
            {categories.map((c) => (
              <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="flex items-end">
        <Button type="submit" className="w-full lg:w-auto" disabled={searching}>
          <Search className="size-4" /> {searching ? "Searching…" : "Search"}
        </Button>
      </div>
    </form>
  );
}

function FilterFields({ filters, onChange }: { filters: FilterState; onChange: (f: FilterState) => void }) {
  return (
    <>
      <div className="space-y-1.5">
        <Label>Sort by</Label>
        <Select value={filters.sort} onValueChange={(v) => onChange({ ...filters, sort: v as SortValue })}>
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent>
            {SORT_OPTIONS.map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>
      <div className="space-y-1.5">
        <Label>Minimum rating</Label>
        <Select value={filters.rating} onValueChange={(v) => onChange({ ...filters, rating: v as RatingFilterValue })}>
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent>
            {RATING_FILTERS.map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>
      <div className="space-y-1.5">
        <Label>Reviews</Label>
        <Select value={filters.reviews} onValueChange={(v) => onChange({ ...filters, reviews: v as ReviewFilterValue })}>
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent>
            {REVIEW_FILTERS.map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>
      <div className="space-y-1.5">
        <Label>Website</Label>
        <Select value={filters.website} onValueChange={(v) => onChange({ ...filters, website: v as WebsiteFilterValue })}>
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent>
            {WEBSITE_FILTERS.map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>
      <div className="space-y-1.5">
        <Label>Instagram</Label>
        <Select value={filters.instagram} onValueChange={(v) => onChange({ ...filters, instagram: v as InstagramFilterValue })}>
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent>
            {INSTAGRAM_FILTERS.map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>
      <div className="space-y-1.5">
        <Label>CRM</Label>
        <Select value={filters.crm} onValueChange={(v) => onChange({ ...filters, crm: v as CrmFilterValue })}>
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent>
            {CRM_FILTERS.map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>
    </>
  );
}

export function ResultFilters({ filters, onChange }: { filters: FilterState; onChange: (f: FilterState) => void }) {
  const count = activeFilterCount(filters);
  return (
    <>
      <div className="hidden flex-wrap items-end gap-3 md:flex">
        <FilterFields filters={filters} onChange={onChange} />
      </div>
      <div className="md:hidden">
        <Sheet>
          <SheetTrigger asChild>
            <Button variant="outline" size="sm">
              <SlidersHorizontal className="size-4" /> Filters {count > 0 && <Badge variant="secondary" className="ml-1">{count}</Badge>}
            </Button>
          </SheetTrigger>
          <SheetContent side="right">
            <SheetHeader>
              <SheetTitle>Filter &amp; sort</SheetTitle>
            </SheetHeader>
            <SheetBody className="space-y-4">
              <FilterFields filters={filters} onChange={onChange} />
            </SheetBody>
          </SheetContent>
        </Sheet>
      </div>
    </>
  );
}

export function RecentSearches({ searches, onRun }: { searches: RecentSearch[]; onRun: (s: RecentSearch) => void }) {
  if (searches.length === 0) return null;
  return (
    <div className="flex flex-wrap items-center gap-2 text-xs">
      <span className="flex items-center gap-1 text-muted-foreground">
        <History className="size-3.5" /> Recent:
      </span>
      {searches.map((s) => (
        <button
          key={s.id}
          type="button"
          onClick={() => onRun(s)}
          className="rounded-full border border-border bg-secondary/50 px-2.5 py-1 text-muted-foreground hover:bg-secondary hover:text-foreground"
        >
          {s.query || s.categoryLabel || "Businesses"} • {s.location} • {s.radiusMiles} mi
        </button>
      ))}
    </div>
  );
}
