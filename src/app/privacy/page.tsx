import { LegalPage, LegalSection } from "@/components/legal/LegalPage";

export const metadata = { title: "Privacy Policy — BlockSmith" };

export default function PrivacyPage() {
  return (
    <LegalPage title="Privacy Policy" updated="2026-06-24">
      <p>
        This policy explains what BlockSmith (&ldquo;we&rdquo;, operated by
        [Company / legal entity]) collects, why, and your choices. By using the
        service you agree to it.
      </p>

      <LegalSection heading="1. What we collect">
        <p>
          <strong>Account:</strong> your GitHub identity (login, email) via
          sign-in.
        </p>
        <p>
          <strong>Design data you bring in:</strong> design systems you import or
          create — Figma tokens/styles/components (fetched with a token you
          provide), code-scan output from repositories you connect, uploaded or
          pasted <code>.md</code> files, and AI-generated systems.
        </p>
        <p>
          <strong>Usage + diagnostics:</strong> basic logs and error reports
          (via Sentry) to operate and debug the service.
        </p>
      </LegalSection>

      <LegalSection heading="2. How we use it">
        <p>
          To provide the product — store your design systems, render the wiki,
          run governance/drift, serve the MCP, and (when you opt in) generate
          designs with AI. We do not sell your data.
        </p>
      </LegalSection>

      <LegalSection heading="3. Third-party processors">
        <p>
          We share data with infrastructure providers only as needed to run the
          service: <strong>Supabase</strong> (auth + storage/database),
          <strong> Vercel</strong> (hosting), <strong>Upstash</strong> (rate
          limiting), <strong>NVIDIA</strong> (AI inference, when you use
          generation), <strong>Sentry</strong> (error monitoring), and
          <strong> GitHub/Figma</strong> (only the repos/files you connect).
        </p>
      </LegalSection>

      <LegalSection heading="4. Tokens & secrets">
        <p>
          A Figma personal access token you paste is used once to fetch the file
          and is not stored. We never store third-party passwords.
        </p>
      </LegalSection>

      <LegalSection heading="5. Retention & deletion">
        <p>
          We keep your projects until you delete them or close your account.
          Deleting a project removes its stored document. [Specify backup
          retention window.]
        </p>
      </LegalSection>

      <LegalSection heading="6. Your rights">
        <p>
          You may access, export, or delete your design systems at any time, and
          request account deletion by contacting us. [Add GDPR/CCPA specifics if
          applicable.]
        </p>
      </LegalSection>

      <LegalSection heading="7. Contact">
        <p>Questions: [privacy@yourdomain.com].</p>
      </LegalSection>
    </LegalPage>
  );
}
