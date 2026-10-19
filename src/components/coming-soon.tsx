import { ButtonLink } from "@/components/ui/button";
import { PageHeader } from "@/components/ui/panel";
import { EmptyState } from "@/components/ui/states";

/** Placeholder for screens not built yet */
export function ComingSoon({ eyebrow, title }: { eyebrow: string; title: string }) {
  return (
    <>
      <PageHeader eyebrow={eyebrow} title={title} />
      <EmptyState
        title="Đang xây dựng"
        action={
          <ButtonLink href="/" variant="primary" size="sm">
            Về Tổng quan
          </ButtonLink>
        }
      >
        Màn hình này sẽ có ở bước tiếp theo.
      </EmptyState>
    </>
  );
}
