'use client';

import { useState } from 'react';

interface CopyTokenProps {
  token: string;
}

export function CopyToken({ token }: CopyTokenProps) {
  const [copied, setCopied] = useState(false);
  const [reveal, setReveal] = useState(false);

  const preview = reveal ? token : `${token.slice(0, 12)}…${token.slice(-8)}`;

  async function onCopy() {
    try {
      await navigator.clipboard.writeText(token);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
    }
  }

  return (
    <div className="rounded-md border bg-muted/40 p-4 space-y-3">
      <pre className="whitespace-pre-wrap break-all font-mono text-xs">
        {preview}
      </pre>
      <div className="flex gap-2">
        <button
          type="button"
          onClick={onCopy}
          className="rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground hover:opacity-90"
        >
          {copied ? 'Copied' : 'Copy token'}
        </button>
        <button
          type="button"
          onClick={() => setReveal((v) => !v)}
          className="rounded-md border px-3 py-1.5 text-xs font-medium hover:bg-accent"
        >
          {reveal ? 'Hide' : 'Reveal'}
        </button>
      </div>
    </div>
  );
}
