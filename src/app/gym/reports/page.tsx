import { requireGymUser } from "@/lib/gym/auth";
import { can, type GymAccessRole } from "@/lib/gym/permissions";
import {
  resolveDateRange,
  getMembershipReport,
  getRevenueReport,
  getLeadsReport,
  getStaffReport,
  getOperationsReport,
} from "@/lib/gym/reports-data";
import { DateRangeFilter } from "./date-range-filter";
import { MembershipSection, RevenueSection, LeadsSection, StaffSection, OperationsSection } from "./report-sections";
import { toDateInputValue } from "@/lib/utils";

export default async function ReportsPage({
  searchParams,
}: {
  searchParams: Promise<{ range?: string; from?: string; to?: string }>;
}) {
  const user = await requireGymUser();
  const showFinance = can(user.accessRole as GymAccessRole, "viewFinance");
  const { range: rangeParam, from: fromParam, to: toParam } = await searchParams;

  const range = resolveDateRange(rangeParam, fromParam, toParam);

  const [membership, revenue, leads, staff, operations] = await Promise.all([
    getMembershipReport(range),
    showFinance ? getRevenueReport(range) : Promise.resolve(null),
    getLeadsReport(range),
    getStaffReport(range),
    getOperationsReport(range),
  ]);

  return (
    <div className="space-y-8">
      <div>
        <h1 className="font-display text-2xl font-bold">Reports</h1>
        <p className="text-sm text-muted-foreground">Membership, revenue, leads, staff, and operations — real numbers, real gaps.</p>
      </div>

      <DateRangeFilter active={rangeParam ?? "month"} from={fromParam ?? toDateInputValue(range.from)} to={toParam ?? toDateInputValue(range.to)} />

      <MembershipSection data={membership} rangeLabel={range.label} />

      {showFinance && revenue && <RevenueSection data={revenue} rangeLabel={range.label} />}

      <LeadsSection data={leads} rangeLabel={range.label} />

      <StaffSection data={staff} rangeLabel={range.label} />

      <OperationsSection data={operations} rangeLabel={range.label} />
    </div>
  );
}
