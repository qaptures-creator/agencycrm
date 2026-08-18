"use client";

import * as React from "react";
import Link from "next/link";
import Image from "next/image";
import {
  Globe,
  AtSign,
  Phone,
  MapPin as MapPinIcon,
  Plus,
  Bookmark,
  BookmarkCheck,
  Star,
  Building2,
  ExternalLink,
  Loader2,
  CheckCircle2,
} from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { cn } from "@/lib/utils";
import type { BusinessResult } from "@/lib/business-finder-types";

export function BusinessCard({
  business,
  selected,
  onToggleSelect,
  saved,
  onToggleSave,
  onFindInstagram,
  enriching,
  onAddToCrm,
  adding,
}: {
  business: BusinessResult;
  selected: boolean;
  onToggleSelect: (placeId: string) => void;
  saved: boolean;
  onToggleSave: (business: BusinessResult) => void;
  onFindInstagram: (business: BusinessResult) => void;
  enriching: boolean;
  onAddToCrm: (business: BusinessResult) => void;
  adding: boolean;
}) {
  const inCrm = !!business.crmMatch;

  return (
    <Card className={cn("flex flex-col gap-3 p-4 transition-shadow hover:shadow-md", inCrm && "bg-muted/40")}>
      <div className="flex items-start gap-3">
        <Checkbox checked={selected} onCheckedChange={() => onToggleSelect(business.placeId)} className="mt-1" />

        <div className="flex size-12 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-secondary text-muted-foreground">
          {business.photoUrl ? (
            <Image src={business.photoUrl} alt="" width={48} height={48} className="size-12 object-cover" unoptimized />
          ) : (
            <Building2 className="size-5" />
          )}
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2">
            <p className="truncate font-semibold">{business.name}</p>
            <button
              type="button"
              onClick={() => onToggleSave(business)}
              className="shrink-0 text-muted-foreground hover:text-foreground"
              aria-label={saved ? "Remove bookmark" : "Save business"}
            >
              {saved ? <BookmarkCheck className="size-4 text-primary" /> : <Bookmark className="size-4" />}
            </button>
          </div>
          {business.category && <p className="truncate text-xs text-muted-foreground">{business.category}</p>}
        </div>
      </div>

      <div className="space-y-1 text-xs text-muted-foreground">
        {business.address && (
          <p className="flex items-start gap-1.5">
            <MapPinIcon className="mt-0.5 size-3 shrink-0" />
            <span className="line-clamp-2">{business.address}</span>
            {business.distanceMiles != null && <span className="shrink-0 whitespace-nowrap">· {business.distanceMiles} mi</span>}
          </p>
        )}
        {business.phone && (
          <a href={`tel:${business.phone}`} className="flex items-center gap-1.5 hover:text-foreground">
            <Phone className="size-3 shrink-0" /> {business.phone}
          </a>
        )}
      </div>

      <div className="flex flex-wrap gap-1.5">
        {business.rating != null ? (
          <Badge variant="secondary" className="gap-1">
            <Star className="size-3 fill-current" /> {business.rating.toFixed(1)}
          </Badge>
        ) : (
          <Badge variant="secondary">No rating</Badge>
        )}
        <Badge variant="secondary">{business.reviewCount != null ? `${business.reviewCount} reviews` : "0 reviews"}</Badge>
        <Badge variant={business.website ? "secondary" : "outline"}>{business.website ? "Website" : "No Website"}</Badge>
        {business.instagramChecked ? (
          <Badge variant={business.instagram ? "secondary" : "outline"}>{business.instagram ? "Instagram" : "No Instagram Found"}</Badge>
        ) : business.website ? (
          <Badge variant="outline" className="gap-1">
            {enriching && <Loader2 className="size-3 animate-spin" />} Checking Instagram…
          </Badge>
        ) : null}
        {business.openNow != null && <Badge variant={business.openNow ? "secondary" : "outline"}>{business.openNow ? "Open now" : "Closed now"}</Badge>}
        {inCrm && (
          <Badge variant="secondary" className="gap-1">
            <CheckCircle2 className="size-3" /> Already in CRM
          </Badge>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-1.5 border-t border-border pt-3">
        {business.website && (
          <Button asChild variant="outline" size="sm" className="h-7 px-2 text-xs">
            <a href={business.website} target="_blank" rel="noreferrer">
              <Globe className="size-3" /> Website
            </a>
          </Button>
        )}
        {business.instagram ? (
          <Button asChild variant="outline" size="sm" className="h-7 px-2 text-xs">
            <a href={business.instagram.url} target="_blank" rel="noreferrer">
              <AtSign className="size-3" /> {business.instagram.handle}
            </a>
          </Button>
        ) : business.website && business.instagramChecked ? (
          <Button variant="outline" size="sm" className="h-7 px-2 text-xs" onClick={() => onFindInstagram(business)} disabled={enriching}>
            <AtSign className="size-3" /> Find Instagram
          </Button>
        ) : null}
        {business.googleMapsUrl && (
          <Button asChild variant="outline" size="sm" className="h-7 px-2 text-xs">
            <a href={business.googleMapsUrl} target="_blank" rel="noreferrer">
              <ExternalLink className="size-3" /> Maps
            </a>
          </Button>
        )}
      </div>

      {inCrm && business.crmMatch ? (
        <Button asChild variant="outline" className="w-full">
          <Link href={business.crmMatch.href}>Already in CRM — View</Link>
        </Button>
      ) : (
        <Button className="w-full" onClick={() => onAddToCrm(business)} disabled={adding}>
          {adding ? <Loader2 className="size-4 animate-spin" /> : <Plus className="size-4" />}
          {adding ? "Adding…" : "Add to CRM"}
        </Button>
      )}
    </Card>
  );
}
