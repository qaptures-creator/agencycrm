import { DotBadge } from "@/components/ui/badge";
import { colorFor, labelFor } from "@/lib/gym/constants";

type Opt = { value: string; label: string; color?: string };

export function GymStatusBadge({ list, value }: { list: Opt[]; value: string | null | undefined }) {
  return <DotBadge color={colorFor(list, value)}>{labelFor(list, value)}</DotBadge>;
}
