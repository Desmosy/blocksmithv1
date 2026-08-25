import "server-only";

import { Resend } from "resend";
import { OrgInviteEmail } from "@/emails/OrgInviteEmail";

export async function sendOrgInvite(input: { email: string; orgName: string; role: string }) {
  const key = process.env.RESEND_API_KEY?.trim();
  if (!key) return { delivered: false as const, reason: "RESEND_API_KEY is not configured" };

  const origin = (process.env.NEXT_PUBLIC_APP_URL || "https://blocksmith-mocha.vercel.app").replace(/\/$/, "");
  const from = process.env.BLOCKSMITH_EMAIL_FROM || "BlockSmith <invites@blocksmith.dev>";
  const { data, error } = await new Resend(key).emails.send({
    from,
    to: input.email,
    subject: `Join ${input.orgName} on BlockSmith`,
    react: <OrgInviteEmail orgName={input.orgName} role={input.role} inviteUrl={`${origin}/?auth=required`} />,
  });
  if (error) throw new Error(`Invite saved, but email delivery failed: ${error.message}`);
  return { delivered: true as const, id: data?.id };
}
