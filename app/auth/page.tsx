"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";

type Step = "email" | "otp";

export default function AuthPage() {
  const [step, setStep] = useState<Step>("email");
  const [email, setEmail] = useState("");
  const [otp, setOtp] = useState("");
  const [loading, setLoading] = useState(false);

  const supabase = createClient();

  async function sendOtp(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: { shouldCreateUser: true },
    });
    setLoading(false);

    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Check your email — we sent a one-time code.");
    setStep("otp");
  }

  async function verifyOtp(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    const { error } = await supabase.auth.verifyOtp({
      email,
      token: otp,
      type: "email",
    });
    setLoading(false);

    if (error) {
      toast.error("Invalid or expired code. Try again.");
      return;
    }
    // Redirect happens via middleware after session is set
    window.location.href = "/";
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50 px-4">
      <Card className="w-full max-w-sm">
        <CardHeader className="text-center">
          <CardTitle className="text-2xl font-bold">Crux Pass</CardTitle>
          <CardDescription>
            {step === "email"
              ? "Enter your email to sign in or create an account."
              : `Enter the code we sent to ${email}`}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {step === "email" ? (
            <form onSubmit={sendOtp} className="flex flex-col gap-4">
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="you@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  autoFocus
                />
              </div>
              <Button type="submit" disabled={loading} className="w-full">
                {loading ? "Sending…" : "Send one-time code"}
              </Button>
              <p className="text-center text-xs text-gray-400">
                Codes expire quickly. Resends are rate-limited.
              </p>
            </form>
          ) : (
            <form onSubmit={verifyOtp} className="flex flex-col gap-4">
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="otp">One-time code</Label>
                <Input
                  id="otp"
                  type="text"
                  inputMode="numeric"
                  placeholder="12345678"
                  maxLength={8}
                  value={otp}
                  onChange={(e) => setOtp(e.target.value.replace(/\D/g, ""))}
                  required
                  autoFocus
                />
              </div>
              <Button type="submit" disabled={loading} className="w-full">
                {loading ? "Verifying…" : "Verify code"}
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => setStep("email")}
              >
                Use a different email
              </Button>
            </form>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
