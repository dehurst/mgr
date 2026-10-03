"use client";

import { startTransition, useActionState, useEffect, useRef, type FormEvent } from "react";
import type { ActionState } from "@/lib/form";

/**
 * Like useActionState, but submits via onSubmit so React doesn't auto-reset the form.
 * That keeps the user's input when the server returns validation errors.
 * Pass resetOnSuccess for "add" forms that should clear after saving.
 */
export function useFormAction(
  action: (prev: ActionState, fd: FormData) => Promise<ActionState>,
  opts: { resetOnSuccess?: boolean } = {},
) {
  const [state, dispatch, pending] = useActionState(action, {});
  const formRef = useRef<HTMLFormElement>(null);

  const onSubmit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    startTransition(() => dispatch(fd));
  };

  useEffect(() => {
    if (opts.resetOnSuccess && state.ok) formRef.current?.reset();
  }, [state, opts.resetOnSuccess]);

  return { state, errors: state.errors ?? {}, onSubmit, pending, formRef };
}
