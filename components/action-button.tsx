"use client";

import { useState, useTransition } from "react";
import { Button, type ButtonSize, type ButtonVariant } from "@/components/ui/button";

/**
 * Runs a server action on click, with an optional confirm() or prompt() first.
 * The action returns an error string to show, or nothing (it may also redirect).
 */
export function ActionButton({
  action,
  confirm: confirmText,
  prompt: promptText,
  children,
  variant = "outline",
  size,
}: {
  action: (input?: string) => Promise<string | void>;
  confirm?: string;
  prompt?: string;
  children: React.ReactNode;
  variant?: ButtonVariant;
  size?: ButtonSize;
}) {
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  return (
    <span className="inline-flex flex-col items-start gap-1">
      <Button
        type="button"
        variant={variant}
        size={size}
        disabled={pending}
        onClick={() => {
          let input: string | undefined;
          if (promptText) {
            const answer = window.prompt(promptText);
            if (answer === null) return;
            input = answer;
          } else if (confirmText && !window.confirm(confirmText)) return;
          setError(null);
          start(async () => {
            const err = await action(input);
            if (err) setError(err);
          });
        }}
      >
        {children}
      </Button>
      {error && <span className="max-w-64 text-xs text-destructive">{error}</span>}
    </span>
  );
}
