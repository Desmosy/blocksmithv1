import { Body, Button, Container, Head, Heading, Html, Preview, Text } from "@react-email/components";

export function OrgInviteEmail({ orgName, role, inviteUrl }: { orgName: string; role: string; inviteUrl: string }) {
  return (
    <Html>
      <Head />
      <Preview>You have been invited to {orgName} on BlockSmith</Preview>
      <Body style={{ backgroundColor: "#f4f4f5", fontFamily: "Arial, sans-serif", padding: "32px" }}>
        <Container style={{ backgroundColor: "#fff", borderRadius: "12px", padding: "32px" }}>
          <Heading>Join {orgName}</Heading>
          <Text>You were invited as a {role}. Sign in with GitHub using this email to accept.</Text>
          <Button href={inviteUrl} style={{ backgroundColor: "#18181b", color: "#fff", borderRadius: "8px", padding: "12px 18px" }}>
            Open BlockSmith
          </Button>
        </Container>
      </Body>
    </Html>
  );
}
