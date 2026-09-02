import { AlertTriangleIcon } from "lucide-react";
import type { ReactNode } from "react";
import { useState } from "react";

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogMedia,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";

export function ConfirmAction({
  title,
  description,
  actionLabel,
  triggerLabel,
  triggerContent,
  triggerAriaLabel,
  triggerDisabled = false,
  variant = "outline",
  onConfirm,
}: {
  title: string;
  description: string;
  actionLabel: string;
  triggerLabel: string;
  triggerContent?: ReactNode;
  triggerAriaLabel?: string;
  triggerDisabled?: boolean;
  variant?: "default" | "outline" | "destructive" | "secondary" | "ghost";
  onConfirm: () => Promise<void> | void;
}) {
  const [open, setOpen] = useState(false);
  const [isPending, setIsPending] = useState(false);

  const handleConfirm = async () => {
    setIsPending(true);
    try {
      await onConfirm();
      setOpen(false);
    } finally {
      setIsPending(false);
    }
  };

  return (
    <AlertDialog open={open} onOpenChange={setOpen}>
      <AlertDialogTrigger
        render={<Button aria-label={triggerAriaLabel} disabled={triggerDisabled} size={triggerContent ? "icon-sm" : "default"} variant={variant} />}
      >
        {triggerContent ?? triggerLabel}
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogMedia>
            <AlertTriangleIcon />
          </AlertDialogMedia>
          <AlertDialogTitle>{title}</AlertDialogTitle>
          <AlertDialogDescription>{description}</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={isPending}>取消</AlertDialogCancel>
          <AlertDialogAction
            variant={variant === "destructive" ? "destructive" : "default"}
            disabled={isPending}
            onClick={handleConfirm}
          >
            {isPending ? <Spinner data-icon="inline-start" /> : null}
            {actionLabel}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
