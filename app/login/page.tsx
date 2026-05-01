"use client";

import { FormEvent, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { getAuthErrorMessage } from "@/lib/auth-errors";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [needsEmailConfirmation, setNeedsEmailConfirmation] = useState(false);

  async function handleSignIn(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setNeedsEmailConfirmation(false);
    setLoading(true);

    try {
      const supabase = createClient();
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (signInError) {
        if (signInError.message.toLowerCase().includes("email not confirmed")) {
          setNeedsEmailConfirmation(true);
        }
        setError(getAuthErrorMessage(signInError.message));
        return;
      }

      router.push("/");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to sign in.");
    } finally {
      setLoading(false);
    }
  }

  async function handleResendConfirmation() {
    setError(null);
    setLoading(true);

    try {
      const supabase = createClient();
      const { error: resendError } = await supabase.auth.resend({
        type: "signup",
        email,
        options: {
          emailRedirectTo: `${window.location.origin}/auth/callback?next=/`,
        },
      });

      if (resendError) {
        setError(getAuthErrorMessage(resendError.message));
        return;
      }

      toast.success("Confirmation email sent. Please check your inbox.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to resend confirmation email.");
    } finally {
      setLoading(false);
    }
  }

  async function handleSignUp() {
    setError(null);
    setLoading(true);

    try {
      const supabase = createClient();
      const { error: signUpError } = await supabase.auth.signUp({
        email,
        password,
        options: {
          emailRedirectTo: `${window.location.origin}/auth/callback?next=/`,
        },
      });

      if (signUpError) {
        if (signUpError.message.toLowerCase().includes("user already registered")) {
          const { error: signInError } = await supabase.auth.signInWithPassword({
            email,
            password,
          });

          if (!signInError) {
            router.push("/");
            router.refresh();
            return;
          }
        }

        setError(getAuthErrorMessage(signUpError.message));
        return;
      }

      router.push("/signup");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to sign up.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="mx-auto flex min-h-[calc(100vh-3.5rem)] w-full max-w-md items-center px-4">
      <Card className="w-full">
        <CardHeader>
          <CardTitle>Sign in</CardTitle>
          <CardDescription>Use your email and password to access your account.</CardDescription>
        </CardHeader>
        <CardContent>
          <form className="space-y-4" onSubmit={handleSignIn}>
            <Input
              autoComplete="email"
              onChange={(e) => setEmail(e.target.value)}
              placeholder="Email"
              required
              type="email"
              value={email}
            />
            <Input
              autoComplete="current-password"
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Password"
              required
              type="password"
              value={password}
            />
            {error ? <p className="text-sm text-destructive">{error}</p> : null}
            {needsEmailConfirmation ? (
              <Button disabled={loading || !email} onClick={handleResendConfirmation} type="button" variant="secondary">
                Resend confirmation email
              </Button>
            ) : null}
            <div className="flex gap-2">
              <Button disabled={loading} type="submit">
                Sign in
              </Button>
              <Button disabled={loading} onClick={handleSignUp} type="button" variant="outline">
                Sign up
              </Button>
            </div>
          </form>
          <p className="mt-4 text-sm text-muted-foreground">
            Prefer the dedicated sign up form?{" "}
            <Link className="underline" href="/signup">
              Create an account
            </Link>
            .
          </p>
        </CardContent>
      </Card>
    </main>
  );
}
