"use client";

import * as React from "react";
import { Clapperboard } from "lucide-react";

export const BRAND_NAME = "PRMOTE";

/**
 * Renders /logo.png if it exists, falling back to the icon mark otherwise —
 * swap in the real file at public/logo.png and this picks it up with no
 * further code changes.
 */
export function BrandMark({ iconClassName = "size-7" }: { iconClassName?: string }) {
  const [logoFailed, setLogoFailed] = React.useState(false);

  if (!logoFailed) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src="/logo.png"
        alt={BRAND_NAME}
        className={`${iconClassName} rounded-lg object-contain`}
        onError={() => setLogoFailed(true)}
      />
    );
  }

  return (
    <div className={`flex ${iconClassName} items-center justify-center rounded-lg bg-primary text-primary-foreground`}>
      <Clapperboard className="size-4" />
    </div>
  );
}
