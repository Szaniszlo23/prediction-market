"use client";

import { FormEvent, useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import { getAuthErrorMessage } from "@/lib/auth-errors";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";

export default function SignUpPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);

    if (password !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }

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
            toast.success("Welcome back. Signed in successfully.");
            router.push("/");
            router.refresh();
            return;
          }
        }

        setError(getAuthErrorMessage(signUpError.message));
        return;
      }

      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (session) {
        toast.success("Account created. You are now signed in.");
        router.push("/");
        router.refresh();
        return;
      }

      toast.success("Account created. If email confirmation is enabled, check your inbox.");
      setPassword("");
      setConfirmPassword("");
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
          <CardTitle>Sign up</CardTitle>
          <CardDescription>Create a new account with your email and password.</CardDescription>
        </CardHeader>
        <CardContent>
          <form className="space-y-4" onSubmit={handleSubmit}>
            <Input
              autoComplete="email"
              onChange={(e) => setEmail(e.target.value)}
              placeholder="Email"
              required
              type="email"
              value={email}
            />
            <Input
              autoComplete="new-password"
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Password"
              required
              type="password"
              value={password}
            />
            <Input
              autoComplete="new-password"
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="Confirm password"
              required
              type="password"
              value={confirmPassword}
            />
            {error ? <p className="text-sm text-destructive">{error}</p> : null}
            <Button disabled={loading} type="submit">
              Sign up
            </Button>
          </form>
          <p className="mt-4 text-sm text-muted-foreground">
            Already have an account?{" "}
            <Link className="underline" href="/login">
              Sign in
            </Link>
            .
          </p>
        </CardContent>
      </Card>
    </main>
  );
}
