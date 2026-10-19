import { PageSkeleton } from "@/components/ui/states";
import { shellMessages } from "@/lib/i18n/messages/shell";
import { getT } from "@/lib/i18n/server";

export default async function Loading() {
  return <PageSkeleton label={(await getT(shellMessages)).states.loading} />;
}
