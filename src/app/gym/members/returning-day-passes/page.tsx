import { Repeat } from "lucide-react";
import { requireTabAccess } from "@/lib/gym/auth";
import { parseRdpFilters, getReturningDayPassList, getReturningDayPassSummary } from "@/lib/gym/returning-day-pass";
import { StatCard } from "@/components/stat-card";
import { MemberSectionNav } from "../member-section-nav";
import { ReturningDayPassList } from "./returning-day-pass-list";

export default async function ReturningDayPassesPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  await requireTabAccess("/gym/members");

  const sp = await searchParams;
  const filters = parseRdpFilters(sp);

  const [{ rows, total }, summary] = await Promise.all([getReturningDayPassList(filters), getReturningDayPassSummary()]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-2xl font-bold">Members</h1>
        <p className="text-sm text-muted-foreground">Member records, membership status and payment health.</p>
      </div>

      <MemberSectionNav />

      <div>
        <h2 className="font-display text-lg font-semibold">Returning Day Passes</h2>
        <p className="text-sm text-muted-foreground">
          Customers who&apos;ve bought a Day Pass more than once, and whether they&apos;ve since taken out a real membership.
        </p>
      </div>

      {/* Always the true totals, independent of the table filters below */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-5">
        <StatCard label="Returning Day Pass Customers" value={summary.returningCustomers} icon={Repeat} />
        <StatCard label="Not Converted" value={summary.notConverted} icon={Repeat} />
        <StatCard label="Converted" value={summary.converted} icon={Repeat} tone="success" />
        <StatCard label="Conversion Rate" value={`${summary.conversionRatePct.toFixed(1)}%`} icon={Repeat} />
        <StatCard label="Total Day Pass Purchases (Returning)" value={summary.totalDayPassPurchases} icon={Repeat} />
      </div>

      <ReturningDayPassList rows={rows} total={total} filters={filters} />
    </div>
  );
}
