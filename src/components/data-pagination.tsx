import {
  Pagination,
  PaginationContent,
  PaginationEllipsis,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from "@/components/ui/pagination";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";

const DEFAULT_PAGE_SIZE_OPTIONS = [10, 25, 50, 100];

type PageItem = number | "ellipsis-start" | "ellipsis-end";

function getPageItems(page: number, totalPages: number): PageItem[] {
  if (totalPages <= 7) {
    return Array.from({ length: totalPages }, (_, index) => index + 1);
  }
  if (page <= 3) {
    return [1, 2, 3, "ellipsis-end", totalPages];
  }
  if (page >= totalPages - 2) {
    return [1, "ellipsis-start", totalPages - 2, totalPages - 1, totalPages];
  }
  return [1, "ellipsis-start", page - 1, page, page + 1, "ellipsis-end", totalPages];
}

export function DataPagination({
  page,
  pageSize,
  total,
  onPageChange,
  onPageSizeChange,
  pageSizeOptions = DEFAULT_PAGE_SIZE_OPTIONS,
}: {
  page: number;
  pageSize: number;
  total: number;
  onPageChange: (page: number) => void;
  onPageSizeChange?: (pageSize: number) => void;
  pageSizeOptions?: number[];
}) {
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  if (totalPages <= 1 && !onPageSizeChange) {
    return null;
  }
  const pageItems = getPageItems(page, totalPages);
  const pageSizeItems = pageSizeOptions.map((option) => ({
    value: String(option),
    label: `${option} 条`,
  }));

  return (
    <div className="relative flex flex-col gap-3 pt-4 sm:flex-row sm:items-center sm:justify-between">
      <Separator className="absolute inset-x-0 top-0" />
      <span>共 {total} 条</span>
      <div className="flex items-center gap-4 text-sm text-muted-foreground">
        {totalPages > 1 ? (
          <Pagination className="mx-0 w-auto justify-end">
            <PaginationContent>
              <PaginationItem>
                <PaginationPrevious
                  href="#"
                  text=""
                  variant="outline"
                  aria-disabled={page <= 1}
                  tabIndex={page <= 1 ? -1 : undefined}
                  onClick={(event) => {
                    event.preventDefault();
                    if (page > 1) onPageChange(page - 1);
                  }}
                />
              </PaginationItem>
              {pageItems.map((item) =>
                typeof item === "string" ? (
                  <PaginationItem key={item}>
                    <PaginationEllipsis />
                  </PaginationItem>
                ) : (
                  <PaginationItem key={item}>
                    <PaginationLink
                      href="#"
                      size="icon"
                      isActive={item === page}
                      variant={item === page ? "default" : "outline"}
                      aria-label={`第 ${item} 页`}
                      onClick={(event) => {
                        event.preventDefault();
                        if (item !== page) onPageChange(item);
                      }}
                    >
                      {item}
                    </PaginationLink>
                  </PaginationItem>
                ),
              )}
              <PaginationItem>
                <PaginationNext
                  href="#"
                  text=""
                  variant="outline"
                  aria-disabled={page >= totalPages}
                  tabIndex={page >= totalPages ? -1 : undefined}
                  onClick={(event) => {
                    event.preventDefault();
                    if (page < totalPages) onPageChange(page + 1);
                  }}
                />
              </PaginationItem>
            </PaginationContent>
          </Pagination>
        ) : null}{" "}
        {onPageSizeChange ? (
          <div className="flex items-center gap-2">
            <span>每页</span>
            <Select
              items={pageSizeItems}
              value={String(pageSize)}
              onValueChange={(value) => {
                if (!value) return;
                const nextPageSize = Number(value);
                if (Number.isFinite(nextPageSize) && nextPageSize !== pageSize) {
                  onPageSizeChange(nextPageSize);
                }
              }}
            >
              <SelectTrigger className="h-8 min-w-18" aria-label="每页条数">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectGroup>
                  {pageSizeOptions.map((option) => (
                    <SelectItem key={option} value={String(option)}>
                      {option} 条
                    </SelectItem>
                  ))}
                </SelectGroup>
              </SelectContent>
            </Select>
          </div>
        ) : null}
      </div>
    </div>
  );
}
