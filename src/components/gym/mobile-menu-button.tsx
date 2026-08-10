"use client";

import * as React from "react";
import { Menu } from "lucide-react";
import { Button } from "@/components/ui/button";
import { GymMobileSidebar } from "@/components/gym/sidebar";

export function MobileMenuButton({ user }: { user: { name: string; accessRole: string } }) {
  const [open, setOpen] = React.useState(false);
  return (
    <>
      <Button variant="ghost" size="icon" className="lg:hidden" onClick={() => setOpen(true)}>
        <Menu className="size-5" />
      </Button>
      <GymMobileSidebar open={open} onClose={() => setOpen(false)} user={user} />
    </>
  );
}
