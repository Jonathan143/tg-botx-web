import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { UnlockForm } from "./unlock-form";

const unlock = vi.fn(async () => undefined);
vi.mock("@/components/auth-provider", () => ({ useAuth: () => ({ unlock }) }));

describe("UnlockForm", () => {
  it("阻止空密钥提交", async () => {
    render(<UnlockForm onSuccess={vi.fn()} />);
    fireEvent.click(screen.getByRole("button", { name: "解锁后台" }));
    expect(await screen.findByText("请输入管理密钥。")).toBeTruthy();
    expect(unlock).not.toHaveBeenCalled();
  });
});
