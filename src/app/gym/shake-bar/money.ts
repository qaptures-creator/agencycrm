// Shake Bar prices are quoted in GBP — kept local to this module rather than
// the shared lib/utils.ts formatCurrency helper, which is USD-formatted for
// the rest of the app.
const gbpFormatter = new Intl.NumberFormat("en-GB", { style: "currency", currency: "GBP" });

export function moneyGBP(value: number | null | undefined) {
  if (value === null || value === undefined) return "—";
  return gbpFormatter.format(value);
}
