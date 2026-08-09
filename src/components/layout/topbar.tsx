"use client";

import * as React from "react";
import { Menu } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ThemeToggle } from "./theme-toggle";
import { GlobalSearch } from "./global-search";
import { MobileSidebar } from "./sidebar";
import { PersonAvatar } from "@/components/ui/avatar";

export function Topbar({ userName }: { userName: string }) {
  const [mobileOpen, setMobileOpen] = React.useState(false);

  return (
    <>
      <header className="sticky top-0 z-40 flex h-14 shrink-0 items-center gap-3 border-b border-border bg-background/80 px-4 backdrop-blur sm:px-6">
        <Button variant="ghost" size="icon" className="lg:hidden" onClick={() => setMobileOpen(true)}>
          <Menu className="size-5" />
        </Button>
        <div className="flex-1">
          <GlobalSearch />
        </div>
        <ThemeToggle />
        <PersonAvatar name={userName} />
      </header>
      <MobileSidebar open={mobileOpen} onClose={() => setMobileOpen(false)} />
    </>
  );
}
