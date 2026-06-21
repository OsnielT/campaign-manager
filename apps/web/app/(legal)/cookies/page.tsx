import type { Metadata } from "next";
import { COMPANY } from "@/lib/legal/company";

export const metadata: Metadata = {
  title: "Cookie Policy",
  description: "How Stemflow uses cookies and similar technologies.",
};

export default function CookiesPage() {
  return (
    <>
      <div style={titleBlock}>
        <h1 style={h1}>Cookie Policy</h1>
        <p style={meta}>Effective date: {COMPANY.effectiveDate} · {COMPANY.legalName}</p>
      </div>

      <p style={lead}>
        {COMPANY.brandName} uses a small number of cookies that are strictly necessary to operate
        the platform. We do <strong>not</strong> use advertising cookies, tracking cookies, or
        third-party analytics cookies that identify individual visitors.
      </p>

      <Section id="what-are-cookies" title="1. What are cookies?">
        <p>
          Cookies are small text files stored in your browser by websites you visit. They are
          widely used to make websites work, remember your preferences, and provide website owners
          with information about how their site is used.
        </p>
      </Section>

      <Section id="cookies-we-use" title="2. Cookies we use">
        <p>
          We use only the following essential cookies. None of these are used for advertising or
          cross-site tracking.
        </p>

        <table style={table}>
          <thead>
            <tr>
              <th style={th}>Cookie name</th>
              <th style={th}>Purpose</th>
              <th style={th}>Duration</th>
              <th style={th}>Type</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td style={td}><code style={code}>primitive_session</code></td>
              <td style={td}>
                Encrypted authentication session. Identifies you as a logged-in user and stores your
                current organization context. Without it, you would need to log in on every page.
              </td>
              <td style={td}>Session / 7 days</td>
              <td style={tdBadge}><Badge>Essential</Badge></td>
            </tr>
            <tr>
              <td style={td}><code style={code}>primitive_csrf</code></td>
              <td style={td}>
                CSRF (cross-site request forgery) protection token. Sent with every mutating request
                (POST / PUT / DELETE) to verify the request originated from {COMPANY.brandName} and
                not a malicious third-party site.
              </td>
              <td style={td}>Session</td>
              <td style={tdBadge}><Badge>Essential</Badge></td>
            </tr>
            <tr>
              <td style={td}><code style={code}>cs_*</code></td>
              <td style={td}>
                Campaign visitor session cookie. Set on public campaign pages (not the admin app)
                to track a visitor&apos;s progress through a multi-step campaign flow. One cookie per
                campaign, named with the campaign&apos;s unique ID. Contains only an anonymous visitor
                token.
              </td>
              <td style={td}>30 days</td>
              <td style={tdBadge}><Badge>Essential</Badge></td>
            </tr>
          </tbody>
        </table>
      </Section>

      <Section id="analytics" title="3. Analytics">
        <p>
          {COMPANY.brandName} uses <strong>Vercel Analytics</strong> to understand aggregate traffic
          patterns. Vercel Analytics is <strong>cookieless</strong> — it does not set any cookies,
          does not fingerprint individual browsers, and does not track visitors across sites. No
          personal data leaves your browser through Vercel Analytics.
        </p>
        <p>
          We do not use Google Analytics, Meta Pixel, or any other third-party analytics service
          that tracks individual users.
        </p>
      </Section>

      <Section id="no-consent-required" title="4. No consent banner">
        <p>
          Because we only set strictly necessary cookies and use cookieless analytics, we do not
          display a consent banner. Essential cookies cannot be disabled without breaking core
          functionality (authentication, security, campaign flow tracking).
        </p>
      </Section>

      <Section id="managing-cookies" title="5. Managing cookies">
        <p>
          You can clear cookies at any time through your browser settings. Clearing the session
          cookie will log you out. Most browsers also allow you to block all cookies, but doing so
          will prevent {COMPANY.brandName} from functioning correctly.
        </p>
        <p>
          For instructions on managing cookies in your browser, visit your browser&apos;s help pages:
        </p>
        <ul style={ul}>
          <li>Chrome: Settings → Privacy and security → Cookies</li>
          <li>Firefox: Settings → Privacy &amp; Security → Cookies and Site Data</li>
          <li>Safari: Preferences → Privacy</li>
          <li>Edge: Settings → Cookies and site permissions</li>
        </ul>
      </Section>

      <Section id="changes" title="6. Changes to this policy">
        <p>
          We may update this Cookie Policy to reflect changes in the cookies we use. Material
          changes will be communicated via the app or by email.
        </p>
      </Section>

      <Section id="contact" title="7. Contact">
        <p>
          If you have questions about our use of cookies, contact us at{" "}
          <a href={`mailto:${COMPANY.privacyEmail}`} style={inlineLink}>{COMPANY.privacyEmail}</a>.
        </p>
        <p>
          {COMPANY.legalName}<br />
          {COMPANY.postalAddress}
        </p>
      </Section>
    </>
  );
}

function Section({ id, title, children }: { id: string; title: string; children: React.ReactNode }) {
  return (
    <section id={id} style={section}>
      <h2 style={h2}>{title}</h2>
      {children}
    </section>
  );
}

function Badge({ children }: { children: React.ReactNode }) {
  return <span style={badge}>{children}</span>;
}

const titleBlock: React.CSSProperties = { marginBottom: "40px" };
const h1: React.CSSProperties = { fontSize: "clamp(26px, 4vw, 36px)", fontWeight: 700, color: "var(--text-primary)", marginBottom: "8px" };
const meta: React.CSSProperties = { fontSize: "13px", color: "var(--text-muted)" };
const lead: React.CSSProperties = { fontSize: "16px", lineHeight: 1.8, color: "var(--text-secondary)", marginBottom: "40px" };
const section: React.CSSProperties = { marginBottom: "40px" };
const h2: React.CSSProperties = { fontSize: "18px", fontWeight: 700, color: "var(--text-primary)", marginBottom: "12px", paddingTop: "8px", borderTop: "1px solid var(--border)" };
const table: React.CSSProperties = { width: "100%", borderCollapse: "collapse", fontSize: "14px", marginTop: "8px" };
const th: React.CSSProperties = { textAlign: "left", padding: "8px 12px", background: "var(--bg-raised)", color: "var(--text-secondary)", fontWeight: 600, fontSize: "12px", borderBottom: "1px solid var(--border)" };
const td: React.CSSProperties = { padding: "10px 12px", borderBottom: "1px solid var(--border)", color: "var(--text-secondary)", fontSize: "13px", verticalAlign: "top" };
const tdBadge: React.CSSProperties = { ...td, verticalAlign: "middle" };
const code: React.CSSProperties = { fontFamily: "monospace", background: "var(--bg-raised)", padding: "1px 5px", borderRadius: "3px", fontSize: "12px", color: "var(--text-primary)" };
const badge: React.CSSProperties = { background: "var(--success-muted, #d1fae5)", color: "var(--success, #059669)", padding: "2px 8px", borderRadius: "12px", fontSize: "11px", fontWeight: 600 };
const ul: React.CSSProperties = { paddingLeft: "20px", margin: "8px 0", lineHeight: 2 };
const inlineLink: React.CSSProperties = { color: "var(--accent)", textDecoration: "underline" };
