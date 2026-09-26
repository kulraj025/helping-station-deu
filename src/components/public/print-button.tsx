"use client";

import { Printer } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";

/**
 * Triggers the browser print dialog.
 *
 * Page chrome is hidden by the `.no-print` utility in `globals.css`, so the
 * printed output is just the participation card.
 */
export function PrintButton({
  label = "Print card",
  variant = "primary",
}: {
  label?: string;
  variant?: "primary" | "secondary" | "outline" | "ghost";
}) {
  const toast = useToast();

  return (
    <Button
      type="button"
      variant={variant}
      size="lg"
      onClick={() => {
        // Give the browser a frame to lay out the card before the dialog opens.
        window.requestAnimationFrame(() => {
          try {
            window.print();
          } catch {
            toast.warning(
              "Printing is blocked",
              "Use your browser menu and choose Print instead.",
            );
          }
        });
      }}
    >
      <Printer className="h-4 w-4" aria-hidden="true" />
      {label}
    </Button>
  );
}
