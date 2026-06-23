'use client';
import { useState, useTransition } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { signInWithPassword, sendMagicLink } from './actions';
import { toast } from 'sonner';

export default function LoginPage() {
  const [pending, start] = useTransition();
  const [magicSent, setMagicSent] = useState(false);

  return (
    <main className="min-h-dvh grid place-items-center p-6">
      <div className="w-full max-w-sm space-y-6">
        <h1 className="text-2xl font-semibold tracking-tight">SRE Timesheet</h1>
        <Tabs defaultValue="password">
          <TabsList className="grid grid-cols-2 w-full">
            <TabsTrigger value="password">Password</TabsTrigger>
            <TabsTrigger value="magic">Magic link</TabsTrigger>
          </TabsList>

          <TabsContent value="password">
            <form
              action={(fd) => start(async () => {
                const res = await signInWithPassword(fd);
                if (res?.error) toast.error(res.error);
              })}
              className="space-y-3 mt-4"
            >
              <Label htmlFor="email">Email</Label>
              <Input id="email" name="email" type="email" required autoComplete="email" />
              <Label htmlFor="password">Password</Label>
              <Input id="password" name="password" type="password" required autoComplete="current-password" />
              <Button type="submit" disabled={pending} className="w-full">
                {pending ? 'Signing in…' : 'Sign in'}
              </Button>
            </form>
          </TabsContent>

          <TabsContent value="magic">
            <form
              action={(fd) => start(async () => {
                const res = await sendMagicLink(fd);
                if (res?.error) toast.error(res.error);
                else { setMagicSent(true); toast.success('Magic link sent — check your inbox'); }
              })}
              className="space-y-3 mt-4"
            >
              <Label htmlFor="magic-email">Email</Label>
              <Input id="magic-email" name="email" type="email" required autoComplete="email" />
              <Button type="submit" disabled={pending || magicSent} className="w-full">
                {magicSent ? 'Link sent' : pending ? 'Sending…' : 'Send magic link'}
              </Button>
            </form>
          </TabsContent>
        </Tabs>
      </div>
    </main>
  );
}
