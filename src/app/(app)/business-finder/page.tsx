import { BusinessFinderView } from "./business-finder-view";
import { BUSINESS_CATEGORIES } from "@/lib/google-places";

export const dynamic = "force-dynamic";

export default function BusinessFinderPage() {
  const categories = BUSINESS_CATEGORIES.map(({ value, label }) => ({ value, label }));
  return <BusinessFinderView categories={categories} />;
}
