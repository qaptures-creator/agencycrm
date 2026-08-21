import { describe, it, expect } from "vitest";
import { isActiveMembership, isActiveMembershipType, isDayPassType } from "./membership-rules";

describe("Active Members", () => {
  const active = (membershipType: string, status: string) => isActiveMembership({ membershipType, status });

  it("Rolling Membership + Live => active", () => {
    expect(active("Rolling Membership", "Live")).toBe(true);
  });
  it("12 Month Contract + New => active", () => {
    expect(active("12 Month Contract", "New")).toBe(true);
  });
  it("Presale Membership + Defaulter => active", () => {
    expect(active("Presale Membership", "Defaulter")).toBe(true);
  });
  it("Rolling Membership + Paid in Full => active", () => {
    expect(active("Rolling Membership", "Paid in Full")).toBe(true);
  });

  it("Day Pass + Live => not active", () => {
    expect(active("Day Pass", "Live")).toBe(false);
  });
  it("Day Pass + Paid in Full => not active", () => {
    expect(active("Day Pass", "Paid in Full")).toBe(false);
  });
  it("Day Pass + Complete => not active", () => {
    expect(active("Day Pass", "Complete")).toBe(false);
  });
  it("Day Pass + Expired => not active", () => {
    expect(active("Day Pass", "Expired")).toBe(false);
  });
  it("PAYG + Live => not active", () => {
    expect(active("PAYG", "Live")).toBe(false);
  });
  it("Cash Membership Temp + Live => not active", () => {
    expect(active("Cash Membership Temp", "Live")).toBe(false);
  });
  it("Rolling Membership + Complete => not active", () => {
    expect(active("Rolling Membership", "Complete")).toBe(false);
  });
  it("Rolling Membership + Expired => not active", () => {
    expect(active("Rolling Membership", "Expired")).toBe(false);
  });

  it("tolerates whitespace/case differences in status", () => {
    expect(active("Rolling Membership", "paid in full")).toBe(true);
    expect(active("Rolling Membership", "  Paid In Full  ")).toBe(true);
  });

  it("does not silently accept unrecognized types or statuses", () => {
    expect(active("Some New Plan", "Live")).toBe(false);
    expect(active("Rolling Membership", "SomeUnknownStatus")).toBe(false);
  });
});

describe("New Members This Month (type-only, status-independent)", () => {
  it("Rolling Membership joined this month + Live => yes", () => {
    expect(isActiveMembershipType("Rolling Membership")).toBe(true);
  });
  it("12 Month Contract joined this month + Defaulter => yes (type check ignores status)", () => {
    expect(isActiveMembershipType("12 Month Contract")).toBe(true);
  });
  it("Presale Membership joined this month + Paid in Full => yes", () => {
    expect(isActiveMembershipType("Presale Membership")).toBe(true);
  });
  it("Day Pass joined this month => no", () => {
    expect(isActiveMembershipType("Day Pass")).toBe(false);
  });
});

describe("Day Passes This Month", () => {
  it("Day Pass + Complete => yes", () => {
    expect(isDayPassType("Day Pass")).toBe(true);
  });
  it("Day Pass + Expired => yes", () => {
    expect(isDayPassType("Day Pass")).toBe(true);
  });
  it("Day Pass + Paid in Full => yes", () => {
    expect(isDayPassType("Day Pass")).toBe(true);
  });
  it("Rolling Membership => no", () => {
    expect(isDayPassType("Rolling Membership")).toBe(false);
  });
  it("tolerates whitespace/case", () => {
    expect(isDayPassType("  day pass  ")).toBe(true);
  });
});
