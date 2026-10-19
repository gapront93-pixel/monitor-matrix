import { ButtonLink } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/states";
import { shellMessages } from "@/lib/i18n/messages/shell";
import { getT } from "@/lib/i18n/server";

export default async function NotFound() {
  const t = (await getT(shellMessages)).states;
  return (
    <EmptyState
      title={t.notFound}
      action={
        <ButtonLink href="/san-pham" variant="primary" size="sm">
          {t.toProducts}
        </ButtonLink>
      }
    >
      {t.notFoundText}
    </EmptyState>
  );
}
