"use client";

import { useMutation } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { useState } from "react";

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
import { useTRPC } from "@/server/trpc/client";

export function OnboardingForm() {
  const router = useRouter();
  const trpc = useTRPC();
  const [name, setName] = useState("");
  const [currency, setCurrency] = useState("");

  const createBusiness = useMutation(
    trpc.business.create.mutationOptions({
      onSuccess: () => {
        router.push("/");
        router.refresh();
      },
    }),
  );

  return (
    <Card>
      <CardHeader>
        <CardTitle>Set up your business</CardTitle>
        <CardDescription>
          The entity you invoice from - you can refine everything later
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form
          onSubmit={(event) => {
            event.preventDefault();
            createBusiness.mutate({ name, currency });
          }}
          className="flex flex-col gap-4"
        >
          <div className="flex flex-col gap-2">
            <Label htmlFor="name">Business name</Label>
            <Input
              id="name"
              required
              placeholder="Studio Brightwood"
              value={name}
              onChange={(event) => setName(event.target.value)}
            />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="currency">Base currency</Label>
            <Input
              id="currency"
              required
              placeholder="EUR"
              maxLength={3}
              className="uppercase"
              value={currency}
              onChange={(event) => setCurrency(event.target.value)}
            />
            <p className="text-sm text-muted-foreground">
              Three-letter code like EUR, GBP or CZK
            </p>
          </div>
          {createBusiness.error ? (
            <p role="alert" className="text-sm text-destructive">
              {createBusiness.error.message}
            </p>
          ) : null}
          <Button type="submit" disabled={createBusiness.isPending}>
            {createBusiness.isPending ? "Setting up..." : "Create business"}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
