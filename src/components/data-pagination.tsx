import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationNext,
  PaginationPrevious,
} from "@/components/ui/pagination";

export function DataPagination({
  page,
  pageSize,
  total,
  onPageChange,
}: {
  page: number;
  pageSize: number;
  total: number;
  onPageChange: (page: number) => void;
}) {
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  if (totalPages <= 1) {
    return null;
  }
  return (
    <Pagination>
      <PaginationContent>
        <PaginationItem>
          <PaginationPrevious
            href="#"
            text="上一页"
            aria-disabled={page <= 1}
            onClick={(event) => {
              event.preventDefault();
              if (page > 1) onPageChange(page - 1);
            }}
          />
        </PaginationItem>
        <PaginationItem>
          <span className="px-3 text-sm text-muted-foreground">
            第 {page} / {totalPages} 页
          </span>
        </PaginationItem>
        <PaginationItem>
          <PaginationNext
            href="#"
            text="下一页"
            aria-disabled={page >= totalPages}
            onClick={(event) => {
              event.preventDefault();
              if (page < totalPages) onPageChange(page + 1);
            }}
          />
        </PaginationItem>
      </PaginationContent>
    </Pagination>
  );
}
