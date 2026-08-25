import { LegalPage, LegalSection } from "@/components/legal/LegalPage";

export const metadata = { title: "Terms of Service — BlockSmith" };

export default function TermsPage() {
  return (
    <LegalPage title="Terms of Service" updated="2026-06-24">
      <p>
        These terms govern your use of BlockSmith (the &ldquo;Service&rdquo;),
        operated by [Company / legal entity]. By using the Service you agree to
        them.
      </p>

      <LegalSection heading="1. Accounts">
        <p>
          You sign in with GitHub and are responsible for activity under your
          account. You must have the right to connect any repository or Figma
          file you bring in.
        </p>
      </LegalSection>

      <LegalSection heading="2. Your content">
        <p>
          You retain ownership of the design systems, files, and data you bring
          in or create. You grant us the limited rights needed to store and
          process them to provide the Service.
        </p>
      </LegalSection>

      <LegalSection heading="3. Acceptable use">
        <p>
          Don&rsquo;t abuse the Service: no unlawful content, no attempts to
          breach tenant isolation or access others&rsquo; data, and no
          circumventing rate limits or resale of the Service as a competing
          hosted offering (see the project license).
        </p>
      </LegalSection>

      <LegalSection heading="4. AI features">
        <p>
          AI generation is best-effort and may be inaccurate; review outputs
          before relying on them. Usage may be rate-limited and metered.
        </p>
      </LegalSection>

      <LegalSection heading="5. Availability & changes">
        <p>
          The Service is provided &ldquo;as is&rdquo; without warranties. We may
          change, suspend, or discontinue features. [Add SLA/plan terms if
          offering paid tiers.]
        </p>
      </LegalSection>

      <LegalSection heading="6. Limitation of liability">
        <p>
          To the maximum extent permitted by law, we are not liable for indirect
          or consequential damages. [Insert liability cap.]
        </p>
      </LegalSection>

      <LegalSection heading="7. Termination">
        <p>
          You may stop using the Service anytime. We may suspend accounts that
          violate these terms.
        </p>
      </LegalSection>

      <LegalSection heading="8. Contact">
        <p>Questions: [legal@yourdomain.com]. Governing law: [jurisdiction].</p>
      </LegalSection>
    </LegalPage>
  );
}
