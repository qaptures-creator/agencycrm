import Link from "next/link";
import { CalendarClock } from "lucide-react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";

export function UpcomingList({
  title,
  items,
  emptyMessage,
  viewAllHref,
}: {
  title: string;
  items: { id: string; title: string; subtitle: string; date: string; href: string; danger?: boolean }[];
  emptyMessage: string;
  viewAllHref: string;
}) {
  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between space-y-0">
        <CardTitle className="text-sm font-semibold text-foreground">{title}</CardTitle>
        {items.length > 0 && (
          <Link href={viewAllHref} className="text-xs text-primary hover:underline">
            View all
          </Link>
        )}
      </CardHeader>
      <CardContent>
        {items.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-2 py-8 text-center">
            <CalendarClock className="size-5 text-muted-foreground" />
            <p className="text-xs text-muted-foreground">{emptyMessage}</p>
          </div>
        ) : (
          <ul className="space-y-1">
            {items.map((item) => (
              <li key={item.id}>
                <Link
                  href={item.href}
                  className="flex items-center justify-between gap-2 rounded-lg px-2 py-1.5 text-sm transition-colors hover:bg-secondary/60"
                >
                  <span className="min-w-0 truncate">
                    <span className="font-medium">{item.title}</span>
                    <span className="text-muted-foreground"> · {item.subtitle}</span>
                  </span>
                  <span className={cn("shrink-0 text-xs font-medium", item.danger ? "text-destructive" : "text-muted-foreground")}>
                    {item.date}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
