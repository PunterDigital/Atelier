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
import { formatDate } from "@/lib/format";
import { useTRPC } from "@/server/trpc/client";

type Member = {
  userId: string;
  name: string;
  email: string;
  role: "owner" | "member";
  joinedAt: Date;
};
type Invitation = {
  id: string;
  email: string;
  role: "owner" | "member";
  token: string;
  expiresAt: Date;
};

const roleLabel = { owner: "Owner", member: "Member" } as const;

export function TeamManager({
  members,
  invitations,
  role,
  currentUserId,
}: {
  members: Member[];
  invitations: Invitation[];
  role: "owner" | "member";
  currentUserId: string;
}) {
  const isOwner = role === "owner";

  return (
    <div className="flex flex-col gap-6">
      {isOwner ? <InviteCard /> : null}
      {isOwner && invitations.length > 0 ? (
        <PendingInvites invitations={invitations} />
      ) : null}
      <MembersCard
        members={members}
        isOwner={isOwner}
        currentUserId={currentUserId}
      />
    </div>
  );
}

function InviteCard() {
  const router = useRouter();
  const trpc = useTRPC();
  const [email, setEmail] = useState("");
  const [inviteRole, setInviteRole] = useState<"owner" | "member">("member");

  const invite = useMutation(
    trpc.team.invite.mutationOptions({
      onSuccess: () => {
        setEmail("");
        router.refresh();
      },
    }),
  );

  return (
    <Card>
      <CardHeader>
        <CardTitle>Invite a team member</CardTitle>
        <CardDescription>
          Send them the invite link to join your business. The link is valid
          for 7 days.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form
          onSubmit={(event) => {
            event.preventDefault();
            invite.mutate({ email: email.trim(), role: inviteRole });
          }}
          className="flex flex-col gap-4"
        >
          <div className="flex flex-col gap-2">
            <Label htmlFor="invite-email">Email</Label>
            <Input
              id="invite-email"
              type="email"
              required
              placeholder="teammate@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="invite-role">Role</Label>
            <select
              id="invite-role"
              value={inviteRole}
              onChange={(e) =>
                setInviteRole(e.target.value as "owner" | "member")
              }
              className="h-9 w-40 rounded-md border bg-transparent px-3 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/40"
            >
              <option value="member">Member</option>
              <option value="owner">Owner</option>
            </select>
            <p className="text-sm text-muted-foreground">
              Owners can manage settings, billing and the team. Members can do
              everything else.
            </p>
          </div>
          {invite.error ? (
            <p role="alert" className="text-sm text-destructive">
              {invite.error.message}
            </p>
          ) : null}
          <div>
            <Button type="submit" disabled={invite.isPending || !email.trim()}>
              {invite.isPending ? "Creating invite..." : "Create invite"}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}

function PendingInvites({ invitations }: { invitations: Invitation[] }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Pending invitations</CardTitle>
        <CardDescription>
          Share the link with each person - they join once they accept.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        {invitations.map((inv) => (
          <InviteRow key={inv.id} invitation={inv} />
        ))}
      </CardContent>
    </Card>
  );
}

function InviteRow({ invitation }: { invitation: Invitation }) {
  const router = useRouter();
  const trpc = useTRPC();
  const [copied, setCopied] = useState(false);

  const revoke = useMutation(
    trpc.team.revoke.mutationOptions({ onSuccess: () => router.refresh() }),
  );

  function copyLink() {
    const url = `${window.location.origin}/invite/${invitation.token}`;
    void navigator.clipboard.writeText(url).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    });
  }

  return (
    <div className="flex items-center gap-3 rounded-md border px-3 py-2.5">
      <div className="min-w-0 flex-1">
        <div className="truncate text-sm font-medium">{invitation.email}</div>
        <div className="text-xs text-muted-foreground">
          {roleLabel[invitation.role]} · expires {formatDate(invitation.expiresAt)}
        </div>
      </div>
      <Button type="button" variant="outline" size="sm" onClick={copyLink}>
        {copied ? "Copied!" : "Copy link"}
      </Button>
      <Button
        type="button"
        variant="ghost"
        size="sm"
        disabled={revoke.isPending}
        onClick={() => revoke.mutate({ invitationId: invitation.id })}
        className="text-muted-foreground hover:text-destructive"
      >
        Revoke
      </Button>
    </div>
  );
}

function MembersCard({
  members,
  isOwner,
  currentUserId,
}: {
  members: Member[];
  isOwner: boolean;
  currentUserId: string;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Members</CardTitle>
        <CardDescription>
          {members.length} {members.length === 1 ? "person" : "people"} on your
          team
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-2">
        {members.map((member) => (
          <MemberRow
            key={member.userId}
            member={member}
            isOwner={isOwner}
            isSelf={member.userId === currentUserId}
          />
        ))}
      </CardContent>
    </Card>
  );
}

function MemberRow({
  member,
  isOwner,
  isSelf,
}: {
  member: Member;
  isOwner: boolean;
  isSelf: boolean;
}) {
  const router = useRouter();
  const trpc = useTRPC();
  const remove = useMutation(
    trpc.team.removeMember.mutationOptions({
      onSuccess: () => router.refresh(),
    }),
  );

  return (
    <div className="flex items-center gap-3 rounded-md border px-3 py-2.5">
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className="truncate text-sm font-medium">{member.name}</span>
          {isSelf ? (
            <span className="text-xs text-muted-foreground">(you)</span>
          ) : null}
        </div>
        <div className="truncate text-sm text-muted-foreground">
          {member.email}
        </div>
      </div>
      <span className="shrink-0 rounded-full bg-[var(--status-draft-bg)] px-2 py-px text-xs font-semibold text-[var(--status-draft-fg)]">
        {roleLabel[member.role]}
      </span>
      {isOwner && !isSelf ? (
        <Button
          type="button"
          variant="ghost"
          size="sm"
          disabled={remove.isPending}
          onClick={() => remove.mutate({ userId: member.userId })}
          className="text-muted-foreground hover:text-destructive"
        >
          Remove
        </Button>
      ) : null}
      {remove.error ? (
        <p role="alert" className="text-xs text-destructive">
          {remove.error.message}
        </p>
      ) : null}
    </div>
  );
}
