import { Target } from "lucide-react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { ChartCard } from "@/components/charts/chart-card";
import { HorizontalBarChart } from "@/components/charts/horizontal-bar-chart";
import { EmptyState } from "@/components/empty-state";
import { LEAD_SOURCES, labelFor } from "@/lib/gym/constants";

type SourceRow = { source: string; count: number; joined: number };

export function LeadsBySource({ rows }: { rows: SourceRow[] }) {
  const chartData = rows.map((r) => ({ name: labelFor(LEAD_SOURCES, r.source), value: r.count }));
  const totalLeads = rows.reduce((sum, r) => sum + r.count, 0);
  const totalJoined = rows.reduce((sum, r) => sum + r.joined, 0);

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-1 gap-5 xl:grid-cols-3">
        <ChartCard
          title="Leads by Source"
          subtitle={`${totalLeads} total lead${totalLeads === 1 ? "" : "s"}`}
          isEmpty={rows.length === 0}
          emptyIcon={Target}
          emptyMessage="No leads recorded yet. Once leads come in, their source breakdown will show here."
          className="xl:col-span-2"
        >
          <HorizontalBarChart data={chartData} dataKey="value" nameKey="name" />
        </ChartCard>

        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-semibold">Overall Conversion</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {totalLeads === 0 ? (
              <EmptyState icon={Target} title="No data yet" className="border-none bg-transparent py-6" />
            ) : (
              <>
                <div className="flex items-baseline justify-between">
                  <span className="text-xs text-muted-foreground">Leads generated</span>
                  <span className="text-lg font-semibold">{totalLeads}</span>
                </div>
                <div className="flex items-baseline justify-between">
                  <span className="text-xs text-muted-foreground">Joined</span>
                  <span className="text-lg font-semibold text-success">{totalJoined}</span>
                </div>
                <div className="flex items-baseline justify-between border-t border-border pt-3">
                  <span className="text-xs text-muted-foreground">Conversion rate</span>
                  <span className="text-lg font-semibold">{Math.round((totalJoined / totalLeads) * 100)}%</span>
                </div>
              </>
            )}
          </CardContent>
        </Card>
      </div>

      {rows.length > 0 && (
        <div className="overflow-x-auto rounded-xl border border-border bg-card">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-left text-xs text-muted-foreground">
                <th className="px-4 py-2.5 font-medium">Source</th>
                <th className="px-4 py-2.5 font-medium">Leads</th>
                <th className="px-4 py-2.5 font-medium">Joined</th>
                <th className="px-4 py-2.5 font-medium">Conversion</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {rows.map((r) => (
                <tr key={r.source}>
                  <td className="px-4 py-2.5">{labelFor(LEAD_SOURCES, r.source)}</td>
                  <td className="px-4 py-2.5">{r.count}</td>
                  <td className="px-4 py-2.5">{r.joined}</td>
                  <td className="px-4 py-2.5">{r.count > 0 ? Math.round((r.joined / r.count) * 100) : 0}%</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
