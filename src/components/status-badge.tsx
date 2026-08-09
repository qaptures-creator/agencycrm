import { DotBadge } from "@/components/ui/badge";
import { colorFor, labelFor } from "@/lib/constants";

export function StatusBadge<T extends { value: string; label: string; color: string }>({
  list,
  value,
}: {
  list: T[];
  value: string | null | undefined;
}) {
  return <DotBadge color={colorFor(list, value)}>{labelFor(list, value)}</DotBadge>;
}
