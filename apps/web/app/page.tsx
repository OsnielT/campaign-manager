import Link from "next/link";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth/session";
import type { Metadata } from "next";
import "./landing.css";
export const metadata: Metadata = {
  title: "Stemflow — Multi-step campaign builder",
  description: "Build conditional page flows, send email broadcasts, target audiences, and track conversions. Stemflow is the campaign editor for marketing teams.",
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

export default async function RootPage() {
  const session = await getSession();
  if (session.userId) {
    redirect(session.orgId ? "/dashboard" : "/onboarding");
  }

  return (
    <div className="scroll-smooth bg-surface text-on-surface font-sans">
      {/* Fonts */}
      {/* eslint-disable-next-line @next/next/no-page-custom-font */}
      <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap" />
      {/* eslint-disable-next-line @next/next/no-page-custom-font */}
      <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:wght,FILL@100..700,0..1&display=swap" />

      {/* Top Navigation */}
      <nav className="fixed top-0 w-full z-50 bg-surface/80 backdrop-blur-md border-b border-outline-variant/30">
        <div className="flex justify-between items-center h-14 px-4 max-w-7xl mx-auto">
          <div className="flex items-center gap-8">
            <div className="stemflow-logo-gradient" aria-label="Stemflow logo" role="img" />
            <div className="hidden md:flex gap-6">
              <a className="text-sm text-primary border-b-2 border-primary pb-1 transition-colors" href="#features">Features</a>
              <a className="text-sm text-on-surface-variant hover:text-primary transition-colors" href="#editor">Editor</a>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <Link href="/login" className="text-xs font-medium text-on-surface-variant hover:text-primary px-4 py-2 transition-all">
              Sign In
            </Link>
            <Link href="/signup" className="text-xs font-semibold bg-primary text-on-primary px-5 py-2.5 rounded-lg hover:shadow-lg transition-all active:scale-95">
              Get Started
            </Link>
          </div>
        </div>
      </nav>

      <main className="pt-20">
        {/* Hero */}
        <section className="relative px-4 pt-16 pb-24 overflow-hidden">
          <div className="max-w-7xl mx-auto text-center relative z-10">
            <h1 className="text-5xl md:text-[56px] md:leading-[64px] font-extrabold text-on-surface mb-6 tracking-tight max-w-4xl mx-auto">
              Build, publish, and track multi-step marketing campaigns
            </h1>
            <p className="text-base text-on-surface-variant mb-10 max-w-2xl mx-auto leading-relaxed">
              Stemflow is a campaign editor for building conditional page flows, targeting audiences, sending email broadcasts, and tracking conversions — all in one place.
            </p>
            <div className="flex flex-col sm:flex-row justify-center items-center gap-4">
              <Link href="/signup" className="w-full sm:w-auto text-xs font-semibold bg-primary text-on-primary px-8 py-4 rounded-xl hover:shadow-xl hover:-translate-y-0.5 transition-all active:scale-95">
                Create an account
              </Link>
              <a href="#editor" className="w-full sm:w-auto text-xs font-semibold border border-outline-variant text-on-surface px-8 py-4 rounded-xl hover:bg-surface-container transition-all active:scale-95">
                See the editor
              </a>
            </div>
          </div>
          <div className="absolute -top-24 -right-24 w-96 h-96 bg-primary/5 blur-[120px] rounded-full pointer-events-none" />
          <div className="absolute -bottom-24 -left-24 w-96 h-96 bg-secondary/5 blur-[120px] rounded-full pointer-events-none" />
        </section>

        {/* Editor Showcase */}
        <section id="editor" className="py-24 px-4 bg-surface">
          <div className="max-w-7xl mx-auto">
            <div className="mb-16 text-center">
              <h2 className="text-2xl font-semibold text-on-surface mb-4">A Workspace Designed for Clarity</h2>
              <p className="text-sm text-on-surface-variant max-w-xl mx-auto">The same drag-and-drop editor your team will use — built for speed and precision.</p>
            </div>

            {/* Faithful replica of BuilderClient / Puck editor chrome */}
            <div className="rounded-2xl border border-outline-variant soft-shadow overflow-hidden bg-white" style={{ fontFamily: "'Inter', system-ui, sans-serif" }}>
              {/* Top bar — mirrors the real BuilderClient header */}
              <div className="h-12 border-b border-outline-variant flex items-center justify-between px-3 bg-white">
                <div className="flex items-center gap-3">
                  <a className="flex items-center gap-1.5 text-xs text-on-surface-variant hover:text-on-surface transition-colors px-2 py-1 rounded hover:bg-slate-100">
                    <span className="material-symbols-outlined" style={{ fontSize: 16 }}>chevron_left</span>
                    <span className="font-medium">Summer Launch 2024</span>
                  </a>
                  <div className="h-4 w-px bg-outline-variant" />
                  {/* Page nav chips — matches the real pageChips bar */}
                  <div className="flex items-center gap-1.5">
                    {[
                      { label: "Welcome", path: "/", entry: true, active: true },
                      { label: "Offer", path: "/offer", entry: false, active: false },
                      { label: "Thank You", path: "/thank-you", entry: false, active: false },
                    ].map((pg) => (
                      <div
                        key={pg.label}
                        className={`flex items-center gap-1.5 px-2.5 py-1 rounded text-[11px] font-medium border transition-colors cursor-pointer ${
                          pg.active
                            ? "bg-primary/10 border-primary/30 text-primary"
                            : "bg-white border-outline-variant text-on-surface-variant hover:border-primary/30"
                        }`}
                      >
                        {pg.entry && <span className="w-1.5 h-1.5 rounded-full bg-primary inline-block" />}
                        {pg.label}
                        <span className="text-[10px] opacity-50">{pg.path}</span>
                      </div>
                    ))}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-[11px] text-on-surface-variant/60 px-2 py-1">Saved</span>
                  <button className="flex items-center gap-1.5 text-[11px] font-medium border border-outline-variant text-on-surface-variant px-3 py-1.5 rounded hover:bg-slate-50 transition-colors">
                    <span className="material-symbols-outlined" style={{ fontSize: 14 }}>visibility</span>
                    Preview
                  </button>
                  <button className="flex items-center gap-1.5 text-[11px] font-semibold bg-primary text-on-primary px-4 py-1.5 rounded hover:bg-primary-hover transition-colors">
                    <span className="material-symbols-outlined" style={{ fontSize: 14 }}>send</span>
                    Publish
                  </button>
                </div>
              </div>

              {/* Puck editor layout: left sidebar + canvas + right inspector */}
              <div className="flex" style={{ height: 520 }}>
                {/* Left sidebar — component palette */}
                <div className="w-56 border-r border-outline-variant bg-[#f8f9fb] flex flex-col">
                  <div className="px-3 py-2.5 border-b border-outline-variant">
                    <span className="text-[10px] font-semibold uppercase tracking-widest text-on-surface-variant">Components</span>
                  </div>
                  <div className="flex-1 overflow-y-auto p-2 space-y-1">
                    {[
                      { icon: "title", label: "Heading" },
                      { icon: "format_paragraph", label: "Text Block" },
                      { icon: "smart_button", label: "Button" },
                      { icon: "image", label: "Image" },
                      { icon: "view_agenda", label: "Card" },
                      { icon: "horizontal_rule", label: "Divider" },
                      { icon: "input", label: "Form Field" },
                      { icon: "grid_view", label: "Columns" },
                    ].map((item) => (
                      <div
                        key={item.label}
                        className="flex items-center gap-2.5 px-2.5 py-2 rounded-lg border border-transparent hover:border-outline-variant hover:bg-white cursor-grab transition-all text-on-surface-variant"
                      >
                        <span className="material-symbols-outlined" style={{ fontSize: 16 }}>{item.icon}</span>
                        <span className="text-xs font-medium">{item.label}</span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Canvas */}
                <div className="flex-1 bg-slate-100 canvas-grid overflow-auto flex items-start justify-center p-8">
                  <div className="w-full max-w-xl bg-white rounded-lg shadow-lg overflow-hidden">
                    {/* Selected block highlight */}
                    <div className="relative border-2 border-primary rounded-t-lg">
                      <div className="absolute -top-6 left-0 bg-primary text-white text-[10px] font-semibold px-2 py-0.5 rounded-t">
                        Heading · selected
                      </div>
                      <div className="bg-primary px-8 py-10 text-center text-white">
                        <div className="text-2xl font-bold mb-2">Exclusive Summer Deals</div>
                        <div className="text-sm opacity-80 mb-5">Limited time offer — don't miss out</div>
                        <div className="inline-block bg-white text-primary font-semibold text-sm px-6 py-2.5 rounded-full">
                          Claim Your Offer
                        </div>
                      </div>
                    </div>
                    {/* Next block */}
                    <div className="px-8 py-6 border-b border-slate-100">
                      <div className="h-3 bg-slate-200 rounded w-3/4 mb-2" />
                      <div className="h-3 bg-slate-200 rounded w-full mb-2" />
                      <div className="h-3 bg-slate-200 rounded w-5/6" />
                    </div>
                    <div className="px-8 py-5 flex gap-3">
                      <div className="h-8 bg-primary/10 rounded flex-1" />
                      <div className="h-8 bg-slate-100 rounded flex-1" />
                    </div>
                  </div>
                </div>

                {/* Right inspector — mirrors Puck's properties panel */}
                <div className="w-64 border-l border-outline-variant bg-[#f8f9fb] flex flex-col">
                  <div className="px-3 py-2.5 border-b border-outline-variant flex items-center justify-between">
                    <span className="text-[10px] font-semibold uppercase tracking-widest text-on-surface-variant">Heading</span>
                    <span className="text-[10px] text-primary font-medium">1 selected</span>
                  </div>
                  <div className="flex-1 p-3 space-y-4 overflow-y-auto">
                    <div>
                      <label className="text-[11px] font-semibold text-on-surface-variant block mb-1.5">Text</label>
                      <div className="w-full bg-white border border-outline-variant rounded px-2.5 py-1.5 text-xs text-on-surface">Exclusive Summer Deals</div>
                    </div>
                    <div>
                      <label className="text-[11px] font-semibold text-on-surface-variant block mb-1.5">Size</label>
                      <div className="grid grid-cols-3 gap-1">
                        {["sm", "md", "lg"].map((s) => (
                          <div key={s} className={`text-center py-1 rounded text-[11px] font-medium border cursor-pointer ${s === "lg" ? "border-primary bg-primary/5 text-primary" : "border-outline-variant text-on-surface-variant hover:border-primary/40"}`}>{s}</div>
                        ))}
                      </div>
                    </div>
                    <div>
                      <label className="text-[11px] font-semibold text-on-surface-variant block mb-1.5">Alignment</label>
                      <div className="grid grid-cols-3 gap-1">
                        {[
                          { icon: "format_align_left", v: "left" },
                          { icon: "format_align_center", v: "center" },
                          { icon: "format_align_right", v: "right" },
                        ].map((a) => (
                          <div key={a.v} className={`flex items-center justify-center py-1 rounded border cursor-pointer ${a.v === "center" ? "border-primary bg-primary/5 text-primary" : "border-outline-variant text-on-surface-variant hover:border-primary/40"}`}>
                            <span className="material-symbols-outlined" style={{ fontSize: 14 }}>{a.icon}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                    <div>
                      <label className="text-[11px] font-semibold text-on-surface-variant block mb-1.5">Background</label>
                      <div className="flex items-center gap-2">
                        <div className="w-7 h-7 rounded border border-outline-variant bg-primary cursor-pointer" />
                        <span className="text-xs text-on-surface font-mono">#3525CD</span>
                      </div>
                    </div>
                    <div>
                      <label className="text-[11px] font-semibold text-on-surface-variant block mb-1.5">Padding</label>
                      <div className="grid grid-cols-2 gap-1.5">
                        {[["Top", "40px"], ["Right", "32px"], ["Bottom", "40px"], ["Left", "32px"]].map(([side, val]) => (
                          <div key={side} className="bg-white border border-outline-variant rounded px-2 py-1">
                            <div className="text-[9px] text-on-surface-variant/60 uppercase">{side}</div>
                            <div className="text-xs font-medium text-on-surface">{val}</div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Features */}
        <section id="features" className="py-24 px-4 bg-surface-container-low">
          <div className="max-w-7xl mx-auto">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {/* Feature 1 — Page builder */}
              <div className="md:col-span-2 bg-surface-container-lowest p-8 rounded-2xl border border-outline-variant/50 soft-shadow hover:border-primary/30 transition-all">
                <div className="flex flex-col md:flex-row gap-8 items-center">
                  <div className="flex-1">
                    <div className="w-12 h-12 bg-primary/10 text-primary rounded-xl flex items-center justify-center mb-6">
                      <span className="material-symbols-outlined" style={{ fontSize: 28 }}>dashboard_customize</span>
                    </div>
                    <h3 className="text-xl font-semibold mb-4">Drag-and-drop page builder</h3>
                    <p className="text-sm text-on-surface-variant">Compose campaign pages from reusable blocks — headings, text, buttons, forms, images, and more. Start from a template or build from scratch. Changes save automatically.</p>
                  </div>
                  <div className="flex-1 w-full h-48 bg-slate-100 rounded-xl overflow-hidden relative border border-outline-variant/30">
                    <div className="absolute inset-0 flex items-center justify-center opacity-40">
                      <span className="material-symbols-outlined text-primary" style={{ fontSize: 64 }}>grid_view</span>
                    </div>
                    <div className="absolute top-4 left-4 w-24 h-12 bg-white rounded shadow-sm border border-outline-variant/50" />
                    <div className="absolute bottom-4 right-4 w-32 h-16 bg-primary/20 rounded shadow-sm border border-primary/30" />
                  </div>
                </div>
              </div>
              {/* Feature 2 — Flow engine */}
              <div className="bg-primary text-on-primary p-8 rounded-2xl soft-shadow hover:-translate-y-1 transition-all">
                <div className="w-12 h-12 bg-white/20 rounded-xl flex items-center justify-center mb-6">
                  <span className="material-symbols-outlined" style={{ fontSize: 28 }}>account_tree</span>
                </div>
                <h3 className="text-xl font-semibold mb-4">Conditional flow engine</h3>
                <p className="text-sm text-white/80">Build multi-step flows with branching logic, A/B splits, and action nodes. Routes visitors based on form data, URL params, audience fields, device, geo, and time.</p>
                <div className="mt-8 flex items-end gap-1 h-12">
                  {[40, 70, 100, 60, 85].map((h, i) => (
                    <div key={i} className={`flex-1 rounded-t ${i === 2 ? "bg-white" : "bg-white/30"}`} style={{ height: `${h}%` }} />
                  ))}
                </div>
              </div>
              {/* Feature 3 — Email */}
              <div className="bg-surface-container-lowest p-8 rounded-2xl border border-outline-variant/50 soft-shadow">
                <div className="w-12 h-12 bg-secondary/10 text-secondary rounded-xl flex items-center justify-center mb-6">
                  <span className="material-symbols-outlined" style={{ fontSize: 28 }}>forward_to_inbox</span>
                </div>
                <h3 className="text-base font-semibold mb-4">Email broadcasts</h3>
                <p className="text-sm text-on-surface-variant">Design emails visually, segment by audience, add merge tags, schedule sends, and track delivery. Includes one-click unsubscribe and test send support.</p>
                <div className="mt-8 flex gap-2">
                  <span className="px-3 py-1 bg-secondary/10 text-secondary rounded-full text-[11px] font-semibold">Audience segmentation</span>
                  <span className="px-3 py-1 bg-secondary/10 text-secondary rounded-full text-[11px] font-semibold">Merge tags</span>
                </div>
              </div>
              {/* Feature 4 — Conversions */}
              <div className="md:col-span-2 bg-surface-container-low border border-outline-variant/50 p-8 rounded-2xl">
                <div className="flex flex-col md:flex-row items-center gap-8">
                  <div className="flex-1">
                    <div className="w-12 h-12 bg-primary/10 text-primary rounded-xl flex items-center justify-center mb-6">
                      <span className="material-symbols-outlined" style={{ fontSize: 28 }}>conversion_path</span>
                    </div>
                    <h3 className="text-xl font-semibold mb-4">Audience targeting & conversion tracking</h3>
                    <p className="text-sm text-on-surface-variant">Import audience records, filter by segment, and personalize flows per visitor. Track goal-based conversions and export enriched data via signed webhooks.</p>
                    <Link href="/signup" className="mt-6 inline-flex items-center gap-2 text-primary text-xs font-medium hover:gap-3 transition-all">
                      Get started <span className="material-symbols-outlined" style={{ fontSize: 18 }}>arrow_forward</span>
                    </Link>
                  </div>
                  <div className="flex-1 w-full flex justify-center">
                    <div className="relative w-48 h-48 rounded-full border-2 border-dashed border-primary/30 flex items-center justify-center">
                      <span className="material-symbols-outlined text-primary/20" style={{ fontSize: 48 }}>group</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Final CTA */}
        <section className="py-24 px-4">
          <div className="max-w-4xl mx-auto text-center bg-surface-container rounded-[2rem] p-12 md:p-20 border border-outline-variant/30 relative overflow-hidden">
            <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-primary to-transparent" />
            <h2 className="text-3xl font-bold mb-6 text-on-surface">Start building your first campaign</h2>
            <p className="text-base text-on-surface-variant mb-10 max-w-xl mx-auto">Create an account to access the editor, set up your organization, and publish your first campaign.</p>
            <div className="flex flex-col sm:flex-row justify-center gap-4">
              <Link href="/signup" className="bg-primary text-on-primary px-10 py-5 rounded-xl text-base font-semibold hover:shadow-xl transition-all">
                Create an account
              </Link>
              <Link href="/login" className="bg-white border border-outline-variant text-on-surface px-10 py-5 rounded-xl text-base font-semibold hover:bg-slate-50 transition-all">
                Sign in
              </Link>
            </div>
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="bg-surface-container border-t border-outline-variant/20">
        <div className="max-w-7xl mx-auto py-12 px-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-12 mb-12">
            <div>
              <span className="text-base font-bold text-on-surface block mb-4">Stemflow</span>
              <p className="text-sm text-on-surface-variant">A platform for building, theming, and publishing multi-step marketing campaigns.</p>
            </div>
            <div>
              <h4 className="text-xs font-bold text-on-surface uppercase mb-6">Product</h4>
              <ul className="space-y-4">
                <li><a className="text-sm text-on-surface-variant hover:text-primary transition-colors" href="#editor">Page editor</a></li>
                <li><a className="text-sm text-on-surface-variant hover:text-primary transition-colors" href="#features">Campaign flows</a></li>
                <li><a className="text-sm text-on-surface-variant hover:text-primary transition-colors" href="#features">Email broadcasts</a></li>
                <li><a className="text-sm text-on-surface-variant hover:text-primary transition-colors" href="#features">Audience & conversions</a></li>
              </ul>
            </div>
            <div>
              <h4 className="text-xs font-bold text-on-surface uppercase mb-6">Account</h4>
              <ul className="space-y-4">
                <li><Link className="text-sm text-on-surface-variant hover:text-primary transition-colors" href="/signup">Create account</Link></li>
                <li><Link className="text-sm text-on-surface-variant hover:text-primary transition-colors" href="/login">Sign in</Link></li>
                <li><Link className="text-sm text-on-surface-variant hover:text-primary transition-colors" href="/forgot-password">Forgot password</Link></li>
              </ul>
            </div>
          </div>
          <div className="flex flex-col md:flex-row justify-between items-center gap-4 py-8 border-t border-outline-variant/10">
            <p className="text-xs text-on-surface-variant/70">© 2025 Stemflow. All rights reserved.</p>
            <div className="flex gap-6">
              <a className="text-xs text-on-surface-variant/70 hover:text-on-surface transition-colors" href="mailto:support@stemflow.io">Contact Support</a>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
