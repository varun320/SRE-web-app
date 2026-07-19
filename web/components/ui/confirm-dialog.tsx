'use client';
import { useState, useTransition, type ReactNode } from 'react';
import { Dialog as DialogPrimitive } from '@base-ui/react/dialog';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { friendlyError } from '@/lib/errors';

interface ConfirmDialogProps {
  triggerLabel: ReactNode;
  triggerVariant?: 'default' | 'outline' | 'destructive' | 'ghost' | 'secondary';
  triggerSize?: 'sm' | 'default' | 'md' | 'lg' | 'xs';
  triggerClassName?: string;
  title: string;
  description?: ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  destructive?: boolean;
  onConfirm: () => Promise<unknown> | unknown;
  successMessage?: string;
}

/**
 * Themed replacement for `window.confirm()`. Wraps the work in a transition +
 * toast so the caller doesn't repeat error plumbing.
 */
export function ConfirmDialog({
  triggerLabel,
  triggerVariant = 'outline',
  triggerSize = 'sm',
  triggerClassName,
  title,
  description,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  destructive = false,
  onConfirm,
  successMessage,
}: ConfirmDialogProps) {
  const [open, setOpen] = useState(false);
  const [pending, start] = useTransition();

  function handleConfirm() {
    start(async () => {
      try {
        await onConfirm();
        if (successMessage) toast.success(successMessage);
        setOpen(false);
      } catch (err) {
        toast.error(friendlyError(err));
      }
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogPrimitive.Trigger
        render={
          <Button variant={triggerVariant} size={triggerSize} className={triggerClassName} />
        }
      >
        {triggerLabel}
      </DialogPrimitive.Trigger>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>
        {description ? (
          <div className="text-sm text-[var(--color-text-muted)]">{description}</div>
        ) : null}
        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => setOpen(false)} disabled={pending}>
            {cancelLabel}
          </Button>
          <Button
            type="button"
            variant={destructive ? 'destructive' : 'default'}
            onClick={handleConfirm}
            disabled={pending}
          >
            {pending ? 'Working…' : confirmLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
