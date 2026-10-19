import { ButtonLink } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/states";

export default function NotFound() {
  return (
    <EmptyState
      title="Không tìm thấy trang"
      action={
        <ButtonLink href="/san-pham" variant="primary" size="sm">
          Xem danh sách sản phẩm
        </ButtonLink>
      }
    >
      Đường dẫn không đúng hoặc mẫu này không còn trong danh mục.
    </EmptyState>
  );
}
