import { type LucideIcon } from "lucide-react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { EmptyState } from "@/components/empty-state";

export function ChartCard({
  title,
  subtitle,
  isEmpty,
  emptyIcon,
  emptyMessage,
  children,
  className,
}: {
  title: string;
  subtitle?: string;
  isEmpty: boolean;
  emptyIcon: LucideIcon;
  emptyMessage: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <Card className={className}>
      <CardHeader>
        <CardTitle className="text-sm font-semibold text-foreground">{title}</CardTitle>
        {subtitle && <p className="text-xs text-muted-foreground">{subtitle}</p>}
      </CardHeader>
      <CardContent>
        {isEmpty ? (
          <EmptyState icon={emptyIcon} title="Not enough data yet" description={emptyMessage} className="border-none bg-transparent py-10" />
        ) : (
          children
        )}
      </CardContent>
    </Card>
  );
}
