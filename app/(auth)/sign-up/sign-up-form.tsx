"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { authClient } from "@/lib/auth-client";

export function SignUpForm({
  googleEnabled,
  redirectTo,
}: {
  googleEnabled: boolean;
  redirectTo?: string;
}) {
  const router = useRouter();
  // Invited sign-ups return to the accept screen; everyone else goes to set
  // up their own business.
  const destination = redirectTo ?? "/onboarding";
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  // Terms/privacy consent is only required on the hosted app. We detect the
  // host client-side (defaulting to false) to avoid a hydration mismatch.
  const [requireConsent, setRequireConsent] = useState(false);
  const [acceptedTerms, setAcceptedTerms] = useState(false);

  useEffect(() => {
    setRequireConsent(window.location.hostname === "app.useclerq.net");
  }, []);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (requireConsent && !acceptedTerms) {
      setError("Please accept the Terms of Service and Privacy Policy");
      return;
    }
    setError(null);
    setPending(true);
    const { error: signUpError } = await authClient.signUp.email({
      name,
      email,
      password,
    });
    setPending(false);
    if (signUpError) {
      setError(signUpError.message ?? "Could not create your account");
      return;
    }
    router.push(destination);
    router.refresh();
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Create your account</CardTitle>
        <CardDescription>
          Your Clerq instance, your data - let&apos;s get you set up
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            <Label htmlFor="name">Name</Label>
            <Input
              id="name"
              autoComplete="name"
              required
              value={name}
              onChange={(event) => setName(event.target.value)}
            />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              type="email"
              autoComplete="email"
              required
              value={email}
              onChange={(event) => setEmail(event.target.value)}
            />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="password">Password</Label>
            <Input
              id="password"
              type="password"
              autoComplete="new-password"
              required
              minLength={8}
              value={password}
              onChange={(event) => setPassword(event.target.value)}
            />
          </div>
          {requireConsent ? (
            <label className="flex items-start gap-2 text-sm text-muted-foreground">
              <input
                type="checkbox"
                className="mt-0.5"
                checked={acceptedTerms}
                onChange={(event) => setAcceptedTerms(event.target.checked)}
              />
              <span>
                I agree to the{" "}
                <Link
                  href="https://useclerq.net/terms"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-primary underline-offset-4 hover:underline"
                >
                  Terms of Service
                </Link>{" "}
                and{" "}
                <Link
                  href="https://useclerq.net/privacy"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-primary underline-offset-4 hover:underline"
                >
                  Privacy Policy
                </Link>
              </span>
            </label>
          ) : null}
          {error ? (
            <p role="alert" className="text-sm text-destructive">
              {error}
            </p>
          ) : null}
          <Button type="submit" disabled={pending || (requireConsent && !acceptedTerms)}>
            {pending ? "Creating your account..." : "Create account"}
          </Button>
        </form>
        {googleEnabled ? (
          <Button
            type="button"
            variant="outline"
            onClick={() =>
              authClient.signIn.social({
                provider: "google",
                callbackURL: destination,
              })
            }
          >
            Continue with Google
          </Button>
        ) : null}
        <p className="text-sm text-muted-foreground">
          Already have an account?{" "}
          <Link href="/sign-in" className="text-primary underline-offset-4 hover:underline">
            Sign in
          </Link>
        </p>
      </CardContent>
    </Card>
  );
}
