"use client";

import { Button, ButtonLink } from "@/components/ui/button";
import { ErrorState } from "@/components/ui/states";

export default function ErrorPage({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <ErrorState
      code={error.digest ? `Mã lỗi: ${error.digest}` : undefined}
      action={
        <>
          <Button variant="primary" size="sm" onClick={reset}>
            Thử lại
          </Button>
          <ButtonLink href="/" size="sm">
            Về Tổng quan
          </ButtonLink>
        </>
      }
    >
      Máy chủ gặp lỗi khi đọc dữ liệu. Thử lại sau ít phút; nếu vẫn lỗi, báo quản trị viên kèm mã lỗi bên dưới.
    </ErrorState>
  );
}
