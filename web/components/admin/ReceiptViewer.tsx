'use client';

import { useState } from 'react';
import { Paperclip, ExternalLink, Download } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';

interface Props {
  url: string;
  filename?: string;
  label?: string;
}

function isPdf(url: string): boolean {
  const clean = url.split('?')[0].toLowerCase();
  return clean.endsWith('.pdf');
}

export function ReceiptViewer({ url, filename, label = 'View' }: Props) {
  const [open, setOpen] = useState(false);
  const pdf = isPdf(url);
  const name = filename ?? url.split('/').pop()?.split('?')[0] ?? 'receipt';

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger className="inline-flex items-center gap-1 text-xs text-[var(--color-accent)] hover:underline">
        <Paperclip className="h-3.5 w-3.5" /> {label}
      </DialogTrigger>
      <DialogContent className="max-w-4xl p-0 overflow-hidden">
        <DialogHeader className="px-4 py-3 border-b border-[var(--color-border-soft)]">
          <DialogTitle className="flex items-center justify-between gap-2 text-sm">
            <span className="truncate">{name}</span>
            <span className="flex items-center gap-2 text-xs font-normal">
              <a
                href={url}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1 text-[var(--color-text-muted)] hover:text-[var(--color-text)]"
                title="Open in new tab"
              >
                <ExternalLink className="h-3.5 w-3.5" /> Open
              </a>
              <a
                href={url}
                download={name}
                className="inline-flex items-center gap-1 text-[var(--color-text-muted)] hover:text-[var(--color-text)]"
                title="Download"
              >
                <Download className="h-3.5 w-3.5" /> Download
              </a>
            </span>
          </DialogTitle>
        </DialogHeader>
        <div className="bg-black/5 dark:bg-black/40 h-[75vh] flex items-center justify-center">
          {pdf ? (
            <iframe
              src={url}
              title={name}
              className="w-full h-full bg-white"
            />
          ) : (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={url}
              alt={name}
              className="max-w-full max-h-full object-contain"
            />
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
