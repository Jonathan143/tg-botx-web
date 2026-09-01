import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { DataPagination } from "./data-pagination";

describe("DataPagination", () => {
  it("显示当前每页条数的标签", () => {
    render(
      <DataPagination
        page={1}
        pageSize={25}
        total={100}
        onPageChange={vi.fn()}
        onPageSizeChange={vi.fn()}
      />,
    );

    expect(screen.getByText("25 条")).toBeTruthy();
  });
});
