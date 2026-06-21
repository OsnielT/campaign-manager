import Link from "next/link";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth/session";
import type { Metadata } from "next";
import "./landing.css";
import StemflowLogo from "@/components/branding/StemflowLogo";

export const metadata: Metadata = {
  title: "Stemflow — Multi-step campaign builder",
  description:
    "Build conditional page flows, send email broadcasts, target audiences, and track conversions. Stemflow is the campaign editor for marketing teams.",
  openGraph: {
    title: "Stemflow — Multi-step campaign builder",
    description: "Build conditional page flows, send email broadcasts, target audiences, and track conversions.",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Stemflow — Multi-step campaign builder",
    description: "Build conditional page flows, send email broadcasts, target audiences, and track conversions.",
  },
};

/* ── tiny inline icon set (stroke, editorial). All decorative — paired with
   visible text labels, so hidden from assistive tech. ─────────────────────── */
const svgBase = { "aria-hidden": true, focusable: false } as const;
const I = {
  arrow: (
    <svg {...svgBase} className="arr" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14M13 6l6 6-6 6" /></svg>
  ),
  builder: (
    <svg {...svgBase} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="7" height="7" rx="1.5" /><rect x="14" y="3" width="7" height="4" rx="1.5" /><rect x="14" y="11" width="7" height="10" rx="1.5" /><rect x="3" y="14" width="7" height="7" rx="1.5" /></svg>
  ),
  flow: (
    <svg {...svgBase} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><circle cx="5" cy="12" r="2.4" /><circle cx="19" cy="5" r="2.4" /><circle cx="19" cy="19" r="2.4" /><path d="M7.2 11l9.6-4.8M7.2 13l9.6 4.8" /></svg>
  ),
  mail: (
    <svg {...svgBase} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="5" width="18" height="14" rx="2" /><path d="M3.5 7l8.5 6 8.5-6" /></svg>
  ),
  target: (
    <svg {...svgBase} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="8.2" /><circle cx="12" cy="12" r="4" /><circle cx="12" cy="12" r="0.6" fill="currentColor" /></svg>
  ),
  check: (
    <svg {...svgBase} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12l4.5 4.5L19 7" /></svg>
  ),
  eye: (
    <svg {...svgBase} width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7Z" /><circle cx="12" cy="12" r="2.6" /></svg>
  ),
  send: (
    <svg {...svgBase} width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 2 11 13M22 2l-7 20-4-9-9-4 20-7Z" /></svg>
  ),
};

const PALETTE: { label: string; icon: keyof typeof I }[] = [
  { label: "Heading", icon: "builder" },
  { label: "Text Block", icon: "builder" },
  { label: "Button", icon: "target" },
  { label: "Image", icon: "builder" },
  { label: "Form Field", icon: "mail" },
  { label: "Flow Branch", icon: "flow" },
];

export default async function RootPage() {
  const session = await getSession();
  if (session.userId) {
    redirect(session.orgId ? "/dashboard" : "/onboarding");
  }

  return (
    <div className="lp">
      <a href="#main" className="lp-skip">Skip to content</a>
      <div className="lp-atmos" aria-hidden />
      <div className="lp-grain" aria-hidden />

      {/* ── Nav ─────────────────────────────────────────────────────────── */}
      <nav className="lp-nav" aria-label="Primary">
        <div className="lp-nav-inner">
          <div className="lp-nav-left">
            <StemflowLogo width={118} />
            <div className="lp-nav-links">
              <a className="lp-nav-link" href="#flow">/ flow</a>
              <a className="lp-nav-link" href="#features">/ features</a>
              <a className="lp-nav-link" href="#editor">/ editor</a>
            </div>
          </div>
          <div className="lp-nav-right">
            <Link href="/login" className="lp-signin">Sign in</Link>
            <Link href="/signup" className="lp-btn lp-btn--sm">Get started {I.arrow}</Link>
          </div>
        </div>
      </nav>

      <div className="lp-wrap">
       <main id="main">
        {/* ── Hero ──────────────────────────────────────────────────────── */}
        <header className="lp-hero">
          <div className="lp-hero-grid" aria-hidden />
          <div className="lp-shell">
            <div className="lp-hero-inner">
              <div className="lp-rise d1"><span className="lp-badge"><span className="dot" /> One workspace · pages · flows · email · audiences</span></div>
              <h1 className="lp-h1 lp-rise d2">
                Campaigns that <span className="ital grad">branch,</span> adapt, and convert
              </h1>
              <p className="lp-lede lp-rise d3">
                Stemflow is one canvas for marketing teams to build campaign pages, route every
                visitor through conditional flows, send targeted email, and measure exactly what
                converts — no stitching tools together.
              </p>
              <div className="lp-actions lp-rise d4">
                <Link href="/signup" className="lp-btn lp-btn--grad">Start building {I.arrow}</Link>
                <a href="#editor" className="lp-btn lp-btn--ghost">See the workspace</a>
              </div>
              <div className="lp-trust lp-rise d5">
                <span><b>Drag-and-drop</b> builder</span>
                <span><b>A/B</b> split flows</span>
                <span><b>Signed</b> conversion webhooks</span>
              </div>
            </div>

            {/* Animated flow diagram — the actual product */}
            <div id="flow" className="lp-flow lp-rise d6">
              <div className="lp-flow-bar">
                <span className="tl" /><span className="tl" /><span className="tl" />
                <span className="crumb">flow · <b>Summer Launch 2024</b> — routing by device</span>
              </div>
              <div className="lp-flow-stage">
                <svg className="lp-flow-svg" viewBox="0 0 1000 360" role="img" aria-label="Conditional campaign flow: an entry page branches by device into a mobile offer and a desktop offer, both leading to a converted signup goal.">
                  <defs>
                    <linearGradient id="flgrad" x1="0" y1="0" x2="1000" y2="0" gradientUnits="userSpaceOnUse">
                      <stop offset="0" stopColor="#3525cd" /><stop offset="0.5" stopColor="#6d28d9" /><stop offset="1" stopColor="#4f46e5" />
                    </linearGradient>
                  </defs>

                  {/* wires */}
                  <path id="w1" className="fl-wire" d="M174 180 L250 180" />
                  <path id="w2" className="fl-wire" d="M400 180 C455 180 455 93 510 93" />
                  <path id="w3" className="fl-wire" d="M400 180 C455 180 455 267 510 267" />
                  <path id="w4" className="fl-wire" d="M660 93 C730 93 730 180 800 180" />
                  <path id="w5" className="fl-wire" d="M660 267 C730 267 730 180 800 180" />

                  {/* traveling pulses */}
                  {[
                    { id: "#w1", b: "0s" }, { id: "#w2", b: "0.6s" }, { id: "#w3", b: "1.1s" },
                    { id: "#w4", b: "1.7s" }, { id: "#w5", b: "2.1s" },
                  ].map((p) => (
                    <circle key={p.id} className="fl-pulse" r="3.4">
                      <animateMotion dur="2.4s" begin={p.b} repeatCount="indefinite" rotate="auto">
                        <mpath href={p.id} />
                      </animateMotion>
                    </circle>
                  ))}

                  {/* branch labels */}
                  <text className="fl-tag" x="452" y="120" textAnchor="middle">if mobile</text>
                  <text className="fl-tag" x="452" y="246" textAnchor="middle">else</text>

                  {/* nodes */}
                  <g>
                    <rect className="fl-node fl-node--start" x="24" y="153" width="150" height="54" rx="13" />
                    <text className="fl-label" x="99" y="178" textAnchor="middle">Entry</text>
                    <text className="fl-sub" x="99" y="195" textAnchor="middle">/ welcome</text>
                  </g>
                  <g>
                    <rect className="fl-node" x="250" y="153" width="150" height="54" rx="13" />
                    <text className="fl-label" x="325" y="178" textAnchor="middle">Branch</text>
                    <text className="fl-sub" x="325" y="195" textAnchor="middle">device · geo · utm</text>
                  </g>
                  <g>
                    <rect className="fl-node" x="510" y="66" width="150" height="54" rx="13" />
                    <text className="fl-label" x="585" y="91" textAnchor="middle">Mobile offer</text>
                    <text className="fl-sub" x="585" y="108" textAnchor="middle">/ offer-m</text>
                  </g>
                  <g>
                    <rect className="fl-node" x="510" y="240" width="150" height="54" rx="13" />
                    <text className="fl-label" x="585" y="265" textAnchor="middle">Desktop offer</text>
                    <text className="fl-sub" x="585" y="282" textAnchor="middle">/ offer-d</text>
                  </g>
                  <g>
                    <rect className="fl-node fl-node--goal" x="800" y="153" width="172" height="54" rx="13" />
                    <text className="fl-label" x="886" y="178" textAnchor="middle">Converted ✓</text>
                    <text className="fl-sub" x="886" y="195" textAnchor="middle">goal · signup</text>
                  </g>
                </svg>
              </div>
            </div>
          </div>
        </header>

        {/* ── Features (bento) ──────────────────────────────────────────── */}
        <section id="features" className="lp-section">
          <div className="lp-shell">
            <div className="lp-head center lp-rv">
              <span className="lp-eyebrow">What&apos;s inside</span>
              <h2 className="lp-h2">Four tools, <span className="ital grad">one</span> canvas</h2>
              <p className="lp-sub">Everything a campaign needs — from the first page a visitor sees to the conversion you export.</p>
            </div>

            <div className="lp-bento">
              {/* page builder — wide */}
              <article className="lp-card lp-card--wide lp-rv">
                <div className="lp-ic">{I.builder}</div>
                <h3>Drag-and-drop page builder</h3>
                <p>Compose campaign pages from reusable blocks — headings, text, buttons, forms, images. Start from a template or a blank canvas. Every change autosaves.</p>
                <div className="lp-mini" aria-hidden>
                  <span className="blk b1" /><span className="blk b2" /><span className="blk b3" />
                </div>
              </article>

              {/* flow engine — tall accent */}
              <article className="lp-card lp-card--tall lp-card--accent lp-rv">
                <div className="lp-ic">{I.flow}</div>
                <h3>Conditional flow engine</h3>
                <p>Multi-step flows with branching logic, A/B splits, and action nodes. Route on form data, URL params, audience fields, device, geo, and time.</p>
                <div className="lp-bars" aria-hidden>
                  <i style={{ height: "42%" }} /><i style={{ height: "70%" }} /><i className="on" style={{ height: "100%" }} /><i style={{ height: "58%" }} /><i style={{ height: "84%" }} /><i style={{ height: "48%" }} />
                </div>
              </article>

              {/* email — half */}
              <article className="lp-card lp-card--half lp-rv">
                <div className="lp-ic">{I.mail}</div>
                <h3>Email broadcasts</h3>
                <p>Design emails visually, segment by audience, add merge tags, schedule sends, and track delivery — with one-click unsubscribe and test sends.</p>
                <div className="lp-pills">
                  <span className="lp-pill">audience segments</span>
                  <span className="lp-pill">merge tags</span>
                  <span className="lp-pill">scheduling</span>
                </div>
              </article>

              {/* audience — half */}
              <article className="lp-card lp-card--half lp-rv">
                <div className="lp-ic">{I.target}</div>
                <h3>Targeting &amp; conversions</h3>
                <p>Import audience records, personalize flows per visitor, and track goal-based conversions. Export enriched data through HMAC-signed webhooks.</p>
                <div className="lp-pills">
                  <span className="lp-pill">record lookup</span>
                  <span className="lp-pill">goal tracking</span>
                  <span className="lp-pill">signed export</span>
                </div>
              </article>
            </div>
          </div>
        </section>

        {/* ── Editor peek ───────────────────────────────────────────────── */}
        <section id="editor" className="lp-section" style={{ paddingTop: 0 }}>
          <div className="lp-shell">
            <div className="lp-head lp-rv">
              <span className="lp-eyebrow">The workspace</span>
              <h2 className="lp-h2">Build the whole campaign <span className="ital grad">in one place</span></h2>
              <p className="lp-sub">Pages, content, theming, and preview — without bouncing between tools.</p>
            </div>

            <div className="lp-editor-wrap lp-rv" role="img" aria-label="Screenshot of the Stemflow page editor: a component palette on the left, the live page canvas in the center, and a properties inspector on the right.">
             <div aria-hidden>
              <div className="lp-ed-float f1"><span className="ck">{I.check}</span> autosaved · 2s ago</div>
              <div className="lp-ed-float f2"><span className="ck">{I.flow}</span> 3 pages · 1 branch</div>

              <div className="lp-editor">
                <div className="lp-ed-bar">
                  <div className="l">
                    <span className="lp-ed-crumb">‹ Summer Launch 2024</span>
                    <div className="lp-ed-chips">
                      <span className="lp-ed-chip on"><span className="lp-ed-dot" />Welcome <span className="pt">/</span></span>
                      <span className="lp-ed-chip">Offer <span className="pt">/offer</span></span>
                      <span className="lp-ed-chip">Thanks <span className="pt">/thank-you</span></span>
                    </div>
                  </div>
                  <div className="lp-ed-actions">
                    <span className="lp-ed-btn ghost">{I.eye} Preview</span>
                    <span className="lp-ed-btn pri">{I.send} Publish</span>
                  </div>
                </div>

                <div className="lp-ed-body">
                  {/* palette */}
                  <aside className="lp-ed-side">
                    <div className="lp-ed-side-h"><span>Components</span></div>
                    <div className="lp-ed-list">
                      {PALETTE.map((p) => (
                        <div key={p.label} className="lp-ed-item">{I[p.icon]}<span>{p.label}</span></div>
                      ))}
                    </div>
                  </aside>

                  {/* canvas */}
                  <div className="lp-ed-canvas">
                    <div className="lp-ed-page">
                      <div className="lp-ed-sel">
                        <span className="lp-ed-tag">Hero · selected</span>
                        <div className="lp-ed-hero">
                          <div className="t">Exclusive Summer Deals</div>
                          <div className="s">Limited-time offer — don&apos;t miss out</div>
                          <span className="b">Claim your offer</span>
                        </div>
                      </div>
                      <div className="lp-ed-rows">
                        <div className="r w3" /><div className="r" /><div className="r w5" />
                      </div>
                    </div>
                  </div>

                  {/* inspector */}
                  <aside className="lp-ed-side r">
                    <div className="lp-ed-side-h"><span>Hero</span><span className="sel">1 selected</span></div>
                    <div className="lp-ed-field">
                      <label>Heading</label>
                      <div className="lp-ed-input">Exclusive Summer Deals</div>
                    </div>
                    <div className="lp-ed-field">
                      <label>Size</label>
                      <div className="lp-ed-seg"><span>sm</span><span>md</span><span className="on">lg</span></div>
                    </div>
                    <div className="lp-ed-field">
                      <label>Alignment</label>
                      <div className="lp-ed-seg"><span>left</span><span className="on">center</span><span>right</span></div>
                    </div>
                    <div className="lp-ed-field">
                      <label>Background</label>
                      <div className="lp-ed-swatch"><i /><code>#3525CD</code></div>
                    </div>
                  </aside>
                </div>
              </div>
             </div>
            </div>
          </div>
        </section>

        {/* ── How it works ──────────────────────────────────────────────── */}
        <section className="lp-section" style={{ paddingTop: 0 }}>
          <div className="lp-shell">
            <div className="lp-head lp-rv">
              <span className="lp-eyebrow">From blank to live</span>
              <h2 className="lp-h2">Four steps to a <span className="ital grad">published</span> campaign</h2>
            </div>
            <div className="lp-steps lp-rv">
              {[
                { n: "01", h: "Compose", p: "Drag blocks onto the canvas to build each page of your campaign." },
                { n: "02", h: "Branch", p: "Wire pages into a flow with conditions, A/B splits, and goals." },
                { n: "03", h: "Target", p: "Import audiences, personalize content, and segment your sends." },
                { n: "04", h: "Publish", p: "Go live on your org URL and watch conversions land in real time." },
              ].map((s) => (
                <div key={s.n} className="lp-step">
                  <div className="n" aria-hidden>{s.n}</div>
                  <h3>{s.h}</h3>
                  <p>{s.p}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ── Final CTA ─────────────────────────────────────────────────── */}
        <section className="lp-section" style={{ paddingTop: 0 }}>
          <div className="lp-shell">
            <div className="lp-final lp-rv">
              <span className="lp-eyebrow" style={{ justifyContent: "center", display: "flex" }}>Start free</span>
              <h2 style={{ marginTop: 18 }}>Build your first <span className="ital">campaign</span> today</h2>
              <p>Create an account, set up your organization, and publish your first multi-step campaign in minutes.</p>
              <div className="lp-actions">
                <Link href="/signup" className="lp-btn lp-btn--grad">Create your account {I.arrow}</Link>
                <Link href="/login" className="lp-btn lp-btn--ghost">Sign in</Link>
              </div>
            </div>
          </div>
        </section>

       </main>

        {/* ── Footer ────────────────────────────────────────────────────── */}
        <footer className="lp-footer">
          <div className="lp-shell">
            <div className="lp-foot-grid">
              <div>
                <StemflowLogo width={120} />
                <p>One canvas for building, theming, and publishing multi-step marketing campaigns.</p>
              </div>
              <div className="lp-foot-col">
                <h3>Product</h3>
                <a href="#editor">Page editor</a>
                <a href="#flow">Campaign flows</a>
                <a href="#features">Email broadcasts</a>
                <a href="#features">Audience &amp; conversions</a>
              </div>
              <div className="lp-foot-col">
                <h3>Account</h3>
                <Link href="/signup">Create account</Link>
                <Link href="/login">Sign in</Link>
                <Link href="/forgot-password">Forgot password</Link>
              </div>
            </div>
            <div className="lp-foot-bar">
              <span>© 2025 Stemflow — all rights reserved</span>
              <a href="mailto:support@stemflow.dev">support@stemflow.dev</a>
            </div>
          </div>
        </footer>
      </div>
    </div>
  );
}
