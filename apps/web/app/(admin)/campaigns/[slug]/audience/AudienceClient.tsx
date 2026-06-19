"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { Stack, Text, Button } from "@primitive/react";
import { GENERATOR_KEYS, GENERATOR_LABELS, resolveGenerator } from "@/lib/audience/generator-types";

interface AudienceField {
  id: string;
  key: string;
  label: string;
  type: string;
  required: boolean;
  position: number;
  onActivation: string | null;
  generator: string | null;
}

interface AudienceRecord {
  id: string;
  lookupKey: string;
  fields: Record<string, unknown>;
  createdAt: string;
}

interface PageFormField {
  key: string;
  label: string;
  pageTitle: string;
  pagePath: string;
  pageId: string;
  componentType: string;
}

interface CampaignPage {
  id: string;
  title: string;
  path: string;
}

type Step = "import" | "activation" | "records";

const PAGE_SIZE = 25;

function getCsrf() {
  return (
    document.cookie
      .split("; ")
      .find((c) => c.startsWith("primitive_csrf="))
      ?.split("=")[1] ?? ""
  );
}

type ActivationType =
  | "none"
  | "timestamp"
  | "fixed"
  | "page:title"
  | "page:path"
  | "product:name"
  | `form:${string}`
  | `url:${string}`
  | `page:${string}:title`
  | `page:${string}:path`;

function groupByPage(fields: PageFormField[]): Record<string, PageFormField[]> {
  const out: Record<string, PageFormField[]> = {};
  for (const f of fields) {
    (out[f.pageTitle] ??= []).push(f);
  }
  return out;
}

/** Parse onActivation string into a UI-friendly shape */
function parseOnActivation(raw: string | null): { type: ActivationType; value: string } {
  if (!raw) return { type: "none", value: "" };
  if (raw === "timestamp") return { type: "timestamp", value: "" };
  if (raw === "page:title") return { type: "page:title", value: "" };
  if (raw === "page:path") return { type: "page:path", value: "" };
  if (raw === "product:name") return { type: "product:name", value: "" };
  if (raw.startsWith("form:")) return { type: raw as ActivationType, value: "" };
  if (raw.startsWith("url:")) return { type: raw as ActivationType, value: "" };
  if (/^page:[^:]+:(title|path)$/.test(raw)) return { type: raw as ActivationType, value: "" };
  if (raw.startsWith("fixed:")) return { type: "fixed", value: raw.slice(6) };
  return { type: "none", value: "" };
}

function serializeOnActivation(type: ActivationType, value: string): string | null {
  if (type === "none") return null;
  if (type === "timestamp") return "timestamp";
  if (type === "fixed") return `fixed:${value}`;
  if (type === "page:title") return "page:title";
  if (type === "page:path") return "page:path";
  if (type === "product:name") return "product:name";
  if ((type as string).startsWith("form:")) return type as string;
  if ((type as string).startsWith("url:")) return type as string;
  if (/^page:[^:]+:(title|path)$/.test(type as string)) return type as string;
  return null;
}

export function AudienceClient({
  campaignSlug,
  canEdit,
}: {
  campaignSlug: string;
  canEdit: boolean;
}) {
  const [step, setStep] = useState<Step>("import");
  const [fields, setFields] = useState<AudienceField[]>([]);
  const [records, setRecords] = useState<AudienceRecord[]>([]);
  const [pageFormFields, setPageFormFields] = useState<PageFormField[]>([]);
  const [campaignPages, setCampaignPages] = useState<CampaignPage[]>([]);
  const [loading, setLoading] = useState(true);
  const [importing, setImporting] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [importResult, setImportResult] = useState<{ inserted: number; skipped: number; errors?: string[] } | null>(null);

  // Search
  const [search, setSearch] = useState("");
  const [searchInput, setSearchInput] = useState("");

  // Test lookup
  const [testKey, setTestKey] = useState("");
  const [testResult, setTestResult] = useState<{ found: boolean; record?: { id: string; name: string | null; email: string | null; fields: Record<string, unknown>; isActivated: boolean } | null } | null>(null);
  const [testLoading, setTestLoading] = useState(false);

  // Edit record
  const [editRecord, setEditRecord] = useState<AudienceRecord | null>(null);
  const [editFields, setEditFields] = useState<Record<string, string>>({});
  const [editName, setEditName] = useState("");
  const [editEmail, setEditEmail] = useState("");
  const [savingEdit, setSavingEdit] = useState(false);

  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const [totalRecords, setTotalRecords] = useState(0);

  // Activation config draft — keyed by field id
  const [activationDraft, setActivationDraft] = useState<Record<string, { type: ActivationType; value: string }>>({});
  const [savingActivation, setSavingActivation] = useState(false);
  const [activationSaved, setActivationSaved] = useState(false);

  const fileRef = useRef<HTMLInputElement>(null);

  // Generate-test-data modal
  const [genOpen, setGenOpen] = useState(false);
  const [genCount, setGenCount] = useState(25);
  const [genOverrides, setGenOverrides] = useState<Record<string, string>>({});
  const [generating, setGenerating] = useState(false);

  async function handleGenerate() {
    setGenerating(true);
    try {
      const res = await fetch(`/api/campaigns/${campaignSlug}/audience/generate`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-csrf-token": getCsrf() },
        body: JSON.stringify({ count: genCount, generators: genOverrides }),
      });
      const data = await res.json();
      if (res.ok) {
        setImportResult({ inserted: data.inserted, skipped: data.skipped });
        setGenOpen(false);
        await loadFields();
        await loadRecords(1, "");
      } else {
        setImportResult({ inserted: 0, skipped: 0, errors: [data.error?.message ?? "Generation failed"] });
      }
    } catch {
      setImportResult({ inserted: 0, skipped: 0, errors: ["Network error — generation failed"] });
    } finally {
      setGenerating(false);
    }
  }

  const loadFields = useCallback(async () => {
    const res = await fetch(`/api/campaigns/${campaignSlug}/audience/fields`, { cache: "no-store" });
    const data = await res.json();
    const loaded: AudienceField[] = data.fields ?? [];
    setFields(loaded);
    // Initialise draft from current values
    const draft: Record<string, { type: ActivationType; value: string }> = {};
    for (const f of loaded) {
      draft[f.id] = parseOnActivation(f.onActivation);
    }
    setActivationDraft(draft);
  }, [campaignSlug]);

  const loadRecords = useCallback(async (page = 1, q = "") => {
    const params = new URLSearchParams({ page: String(page), limit: String(PAGE_SIZE) });
    if (q) params.set("search", q);
    const res = await fetch(`/api/campaigns/${campaignSlug}/audience/records?${params}`, { cache: "no-store" });
    const data = await res.json();
    setRecords(data.records ?? []);
    setTotalRecords(data.total ?? 0);
    setCurrentPage(page);
  }, [campaignSlug]);

  useEffect(() => {
    const loadFormFields = fetch(`/api/campaigns/${campaignSlug}/audience/form-fields`)
      .then((r) => r.json())
      .then((d) => {
        setPageFormFields(d.fields ?? []);
        setCampaignPages(d.pages ?? []);
      });
    Promise.all([loadFields(), loadRecords(), loadFormFields]).finally(() => setLoading(false));
  }, [loadFields, loadRecords, campaignSlug]);

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setImporting(true);
    setImportResult(null);
    try {
      const form = new FormData();
      form.append("file", file);
      const res = await fetch(`/api/campaigns/${campaignSlug}/audience/import`, {
        method: "POST",
        headers: { "x-csrf-token": getCsrf() },
        body: form,
      });
      const data = await res.json();
      if (!res.ok) {
        setImportResult({ inserted: 0, skipped: 0, errors: [data.error ?? "Import failed"] });
      } else {
        setImportResult(data);
        await loadFields();
        await loadRecords();
      }
    } catch {
      setImportResult({ inserted: 0, skipped: 0, errors: ["Network error — import failed"] });
    } finally {
      setImporting(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  async function handleSaveActivation() {
    setSavingActivation(true);
    setActivationSaved(false);
    try {
      const updates = fields.map((f) => ({
        id: f.id,
        onActivation: serializeOnActivation(
          activationDraft[f.id]?.type ?? "none",
          activationDraft[f.id]?.value ?? ""
        ),
      }));
      await fetch(`/api/campaigns/${campaignSlug}/audience/fields`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", "x-csrf-token": getCsrf() },
        body: JSON.stringify({ updates }),
      });
      setActivationSaved(true);
      setTimeout(() => setActivationSaved(false), 3000);
    } finally {
      setSavingActivation(false);
    }
  }

  // After deleting a record, reload current page (fall back to prev page if it became empty)
  async function handleDeleteRecord(recordId: string) {
    setDeletingId(recordId);
    try {
      await fetch(`/api/campaigns/${campaignSlug}/audience/records/${recordId}`, {
        method: "DELETE",
        headers: { "x-csrf-token": getCsrf() },
      });
      const newTotal = totalRecords - 1;
      const maxPage = Math.max(1, Math.ceil(newTotal / PAGE_SIZE));
      const targetPage = Math.min(currentPage, maxPage);
      await loadRecords(targetPage);
    } finally {
      setDeletingId(null);
    }
  }

  async function handleTruncate() {
    if (!confirm("Clear all audience records? Field definitions and activation settings will be kept.")) return;
    await fetch(`/api/campaigns/${campaignSlug}/audience/records`, {
      method: "DELETE",
      headers: { "x-csrf-token": getCsrf() },
    });
    setRecords([]);
    setTotalRecords(0);
    setCurrentPage(1);
    setImportResult(null);
  }

  async function handleReset() {
    if (!confirm("Reset the entire audience? This will delete all records AND field definitions. This cannot be undone.")) return;
    await fetch(`/api/campaigns/${campaignSlug}/audience/reset`, {
      method: "DELETE",
      headers: { "x-csrf-token": getCsrf() },
    });
    setRecords([]);
    setTotalRecords(0);
    setCurrentPage(1);
    setFields([]);
    setActivationDraft({});
    setImportResult(null);
    setStep("import");
  }

  async function handleTestLookup(e: React.FormEvent) {
    e.preventDefault();
    if (!testKey.trim()) return;
    setTestLoading(true);
    setTestResult(null);
    try {
      const res = await fetch(`/api/campaigns/${campaignSlug}/audience/test-lookup`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-csrf-token": getCsrf() },
        body: JSON.stringify({ lookupKey: testKey.trim() }),
      });
      const data = await res.json();
      setTestResult(data);
    } finally {
      setTestLoading(false);
    }
  }

  function openEditRecord(r: AudienceRecord) {
    setEditRecord(r);
    setEditName((r as AudienceRecord & { name?: string }).name ?? "");
    setEditEmail((r as AudienceRecord & { email?: string }).email ?? "");
    const f: Record<string, string> = {};
    for (const field of fields) f[field.key] = String(r.fields[field.key] ?? "");
    setEditFields(f);
  }

  async function handleSaveEdit() {
    if (!editRecord) return;
    setSavingEdit(true);
    try {
      const res = await fetch(`/api/campaigns/${campaignSlug}/audience/records/${editRecord.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", "x-csrf-token": getCsrf() },
        body: JSON.stringify({ name: editName || null, email: editEmail || null, fields: editFields }),
      });
      if (res.ok) {
        setEditRecord(null);
        await loadRecords(currentPage, search);
      }
    } finally {
      setSavingEdit(false);
    }
  }

  if (loading) return <Text tone="secondary" size="sm">Loading…</Text>;

  const STEPS: { id: Step; label: string }[] = [
    { id: "import", label: "1. Import CSV" },
    { id: "activation", label: "2. On activation" },
    { id: "records", label: "3. Records" },
  ];

  return (
    <Stack direction="vertical" size="lg">
      <Text as="h1" size="lg" weight="semibold">Audience</Text>
      <Text size="sm" tone="secondary">
        Import audience records via CSV. The <code>lookup_key</code> column is required — all
        other columns become audience fields automatically.
      </Text>

      {/* Tabs */}
      <div style={{ display: "flex", borderBottom: "1px solid var(--border)" }}>
        {STEPS.map((s) => (
          <button
            key={s.id}
            onClick={() => { setStep(s.id); if (s.id === "records") loadRecords(1); }}
            style={{
              padding: "8px 16px",
              background: "none",
              border: "none",
              borderBottom: step === s.id ? "2px solid var(--accent)" : "2px solid transparent",
              color: step === s.id ? "var(--accent)" : "var(--text-secondary)",
              fontSize: 13,
              fontWeight: step === s.id ? 600 : 400,
              cursor: "pointer",
              marginBottom: -1,
            }}
          >
            {s.label}
          </button>
        ))}
      </div>

      {/* ── 1. Import ── */}
      {step === "import" && (
        <Stack direction="vertical" size="md">
          <div style={{ background: "var(--bg-surface)", border: "1px solid var(--border)", borderRadius: 8, padding: "18px 20px" }}>
            <Text weight="semibold" style={{ marginBottom: 8 }}>CSV format</Text>
            <Text size="sm" tone="secondary">
              Include a <code>lookup_key</code> column (hashed on import — never stored raw).
              Add any other columns you need — they become audience fields automatically.
            </Text>
            <pre style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 10, overflowX: "auto" }}>
              lookup_key,name,email,tier,promo_code,...
            </pre>
          </div>

          {canEdit && (
            <>
              <input
                ref={fileRef}
                type="file"
                accept=".csv,text/csv"
                style={{ display: "none" }}
                onChange={handleFileChange}
              />
              <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                <Button
                  appearance="solid"
                  tone="action"
                  size="sm"
                  disabled={importing}
                  onClick={() => fileRef.current?.click()}
                >
                  {importing ? "Importing…" : "Choose CSV file"}
                </Button>
                <Button
                  appearance="outline"
                  tone="action"
                  size="sm"
                  disabled={generating}
                  onClick={() => { setGenOverrides({}); setGenOpen(true); }}
                >
                  Generate test data
                </Button>
                {totalRecords > 0 && (
                  <Button appearance="outline" tone="neutral" size="sm" onClick={() => setStep("records")}>
                    View {totalRecords} record{totalRecords !== 1 ? "s" : ""}
                  </Button>
                )}
              </div>
            </>
          )}

          {importResult && (
            <div style={{
              background: importResult.errors?.length ? "var(--danger-muted)" : "var(--success-muted)",
              border: `1px solid ${importResult.errors?.length ? "var(--danger)" : "var(--success)"}`,
              borderRadius: 8, padding: "12px 16px",
            }}>
              <Text size="sm" weight="semibold">
                Import complete: {importResult.inserted} inserted, {importResult.skipped} skipped
              </Text>
              {importResult.errors && importResult.errors.length > 0 && (
                <div style={{ marginTop: 8 }}>
                  {importResult.errors.map((err, i) => (
                    <Text key={i} size="sm" tone="danger">{err}</Text>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Test lookup */}
          {fields.length > 0 && (
            <div style={{ marginTop: 16, borderTop: "1px solid var(--border)", paddingTop: 16 }}>
              <Text size="sm" weight="semibold" style={{ marginBottom: 8 }}>Test lookup</Text>
              <Text size="sm" tone="secondary" style={{ marginBottom: 10 }}>
                Enter a raw lookup key to verify it resolves without triggering activation.
              </Text>
              <form onSubmit={handleTestLookup} style={{ display: "flex", gap: 8 }}>
                <input
                  value={testKey}
                  onChange={(e) => setTestKey(e.target.value)}
                  placeholder="e.g. PROMO-123"
                  style={{ flex: 1, background: "var(--bg-raised)", border: "1px solid var(--border)", borderRadius: 6, padding: "7px 10px", color: "var(--text-primary)", fontSize: 13 }}
                />
                <Button type="submit" appearance="outline" tone="neutral" size="sm" disabled={testLoading || !testKey.trim()}>
                  {testLoading ? "Checking…" : "Check"}
                </Button>
              </form>
              {testResult && (
                <div style={{
                  marginTop: 10, padding: "12px 14px", borderRadius: 8,
                  background: testResult.found ? "var(--success-muted)" : "var(--danger-muted)",
                  border: `1px solid ${testResult.found ? "var(--success)" : "var(--danger)"}`,
                }}>
                  {testResult.found && testResult.record ? (
                    <>
                      <Text size="sm" weight="semibold">✓ Match found</Text>
                      {testResult.record.name && <Text size="sm">Name: {testResult.record.name}</Text>}
                      {testResult.record.email && <Text size="sm">Email: {testResult.record.email}</Text>}
                      <Text size="sm" tone="secondary">Activated: {testResult.record.isActivated ? "Yes" : "Not yet"}</Text>
                      <Text size="sm" tone="secondary" style={{ marginTop: 4 }}>
                        Fields: {Object.entries(testResult.record.fields).map(([k, v]) => `${k}=${v}`).join(", ")}
                      </Text>
                    </>
                  ) : (
                    <Text size="sm">No match found for this key.</Text>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Danger zone */}
          {canEdit && (totalRecords > 0 || fields.length > 0) && (
            <div style={{ marginTop: 16, borderTop: "1px solid var(--border)", paddingTop: 16 }}>
              <Text size="sm" weight="semibold" style={{ marginBottom: 10, color: "var(--text-secondary)" }}>
                Danger zone
              </Text>
              <div style={{ display: "flex", gap: 8 }}>
                {records.length > 0 && (
                  <Button appearance="outline" tone="danger" size="sm" onClick={handleTruncate}>
                    Clear all records
                  </Button>
                )}
                <Button appearance="outline" tone="danger" size="sm" onClick={handleReset}>
                  Reset audience
                </Button>
              </div>
              <Text size="sm" tone="secondary" style={{ marginTop: 6 }}>
                "Clear records" keeps field definitions. "Reset" removes everything.
              </Text>
            </div>
          )}
        </Stack>
      )}

      {/* ── 2. On activation ── */}
      {step === "activation" && (
        <Stack direction="vertical" size="md">
          <div>
            <Text weight="semibold">On activation settings</Text>
            <Text size="sm" tone="secondary" style={{ marginTop: 4 }}>
              Choose what happens to each audience field when a visitor successfully enters their code.
              Leave a field set to <strong>Don&apos;t set</strong> to keep its imported value unchanged.
            </Text>
          </div>

          {fields.length === 0 ? (
            <div style={{ border: "2px dashed var(--border)", borderRadius: 10, padding: "32px 24px", textAlign: "center" }}>
              <Text tone="secondary">No fields yet — import a CSV first to see your audience columns here.</Text>
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
              {/* Header row */}
              <div style={activationHeaderRow}>
                <span style={{ flex: "0 0 140px" }}>Field</span>
                <span style={{ flex: "0 0 160px" }}>CSV column</span>
                <span style={{ flex: 1 }}>On activation — set to</span>
              </div>

              {fields.map((f) => {
                const draft = activationDraft[f.id] ?? { type: "none", value: "" };
                return (
                  <div key={f.id} style={activationRow}>
                    {/* Label */}
                    <span style={{ flex: "0 0 140px", fontWeight: 500, fontSize: 13 }}>{f.label}</span>

                    {/* Key */}
                    <code style={{ flex: "0 0 160px", fontSize: 12, color: "var(--text-muted)" }}>{f.key}</code>

                    {/* Action selector */}
                    <div style={{ flex: 1, display: "flex", gap: 8, alignItems: "center" }}>
                      <select
                        disabled={!canEdit}
                        value={
                          (draft.type as string).startsWith("url:")
                            ? "url"
                            : draft.type
                        }
                        onChange={(e) => {
                          const val = e.target.value;
                          if (val === "url") {
                            setActivationDraft((prev) => ({
                              ...prev,
                              [f.id]: { type: "url:" as ActivationType, value: "" },
                            }));
                          } else {
                            setActivationDraft((prev) => ({
                              ...prev,
                              [f.id]: { type: val as ActivationType, value: prev[f.id]?.value ?? "" },
                            }));
                          }
                        }}
                        style={selectStyle}
                      >
                        <option value="none">Don&apos;t set</option>
                        <optgroup label="General">
                          <option value="timestamp">Activation timestamp</option>
                          <option value="fixed">Fixed value…</option>
                          <option value="url">URL parameter…</option>
                        </optgroup>
                        <optgroup label="Activation page">
                          <option value="page:title">This page — title</option>
                          <option value="page:path">This page — path / alias</option>
                        </optgroup>
                        {campaignPages.length > 0 && (
                          <optgroup label="Specific page">
                            {campaignPages.flatMap((p) => [
                              <option key={`${p.id}:title`} value={`page:${p.id}:title`}>{p.title} — title</option>,
                              <option key={`${p.id}:path`} value={`page:${p.id}:path`}>{p.title} — path</option>,
                            ])}
                          </optgroup>
                        )}
                        <optgroup label="Product">
                          <option value="product:name">Product — name</option>
                        </optgroup>
                        {Object.entries(groupByPage(pageFormFields)).map(([pageTitle, pageFields]) => (
                          <optgroup key={pageTitle} label={`Form — ${pageTitle}`}>
                            {pageFields.map((ff) => (
                              <option key={`${ff.pageId}:${ff.key}`} value={`form:${ff.key}`}>
                                {ff.label}
                              </option>
                            ))}
                          </optgroup>
                        ))}
                      </select>

                      {draft.type === "fixed" && (
                        <input
                          disabled={!canEdit}
                          value={draft.value}
                          onChange={(e) =>
                            setActivationDraft((prev) => ({
                              ...prev,
                              [f.id]: { ...prev[f.id], value: e.target.value },
                            }))
                          }
                          placeholder='e.g. "true" or "activated"'
                          style={fixedInputStyle}
                        />
                      )}

                      {((draft.type as string) === "url:" || (draft.type as string).startsWith("url:")) && (
                        <input
                          disabled={!canEdit}
                          value={(draft.type as string).slice(4)}
                          onChange={(e) =>
                            setActivationDraft((prev) => ({
                              ...prev,
                              [f.id]: { type: `url:${e.target.value}` as ActivationType, value: "" },
                            }))
                          }
                          placeholder="e.g. product, utm_source"
                          style={fixedInputStyle}
                        />
                      )}

                      {draft.type !== "none" && draft.type !== "fixed" && !(draft.type as string).startsWith("url:") && (
                        <span style={{ fontSize: 12, color: "var(--text-muted)" }}>
                          {draft.type === "timestamp" && "e.g. 2025-04-07T14:23:00.000Z"}
                          {draft.type === "page:title" && "Title of the page where the visitor activates"}
                          {draft.type === "page:path" && "Path of the page where the visitor activates"}
                          {draft.type === "product:name" && "First product linked to this campaign"}
                          {(draft.type as string).startsWith("form:") && (() => {
                            const key = (draft.type as string).slice(5);
                            const ff = pageFormFields.find((f) => f.key === key);
                            return ff ? `Value the visitor submitted in "${ff.label}" on ${ff.pageTitle}` : `form field: ${key}`;
                          })()}
                          {/^page:[^:]+:(title|path)$/.test(draft.type as string) && (() => {
                            const parts = (draft.type as string).split(":");
                            const pageId = parts[1];
                            const field = parts[2];
                            const page = campaignPages.find((p) => p.id === pageId);
                            return page ? `Static ${field} of "${page.title}"` : `page ${field}`;
                          })()}
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {canEdit && fields.length > 0 && (
            <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
              <Button
                appearance="solid"
                tone="action"
                size="sm"
                disabled={savingActivation}
                onClick={handleSaveActivation}
              >
                {savingActivation ? "Saving…" : "Save activation settings"}
              </Button>
              {activationSaved && (
                <Text size="sm" tone="success">Saved</Text>
              )}
            </div>
          )}

          {/* Explanation box */}
          <div style={{ background: "var(--bg-surface)", border: "1px solid var(--border)", borderRadius: 8, padding: "16px 18px", marginTop: 8 }}>
            <Text size="sm" weight="semibold" style={{ marginBottom: 6 }}>How this works</Text>
            <Text size="sm" tone="secondary">
              When a visitor enters their <code>lookup_key</code> on the campaign page and it matches a record,
              these fields are updated instantly on the server — before the visitor reaches the next page.
              Use this to track activation status, timestamps, or any fixed metadata.
            </Text>
            <div style={{ marginTop: 10, display: "flex", flexDirection: "column", gap: 4 }}>
              {[
                { label: "Don't set", desc: "Field is left exactly as it was in your imported CSV." },
                { label: "Activation timestamp", desc: "Writes the exact date and time the code was activated (ISO 8601)." },
                { label: "Fixed value", desc: "Writes a value you define — e.g. \"true\", \"activated\", \"used\"." },
                { label: "URL parameter", desc: "Writes the value of a URL query parameter captured when the visitor first arrived — e.g. ?product=2 writes \"2\"." },
                { label: "Activation page — title/path", desc: "Writes the title or path of the specific page where the visitor entered their code." },
                { label: "Specific page — title/path", desc: "Writes the static title or path of any page in your campaign, regardless of which page the visitor is on." },
                { label: "Product — name", desc: "Writes the name of the first product linked to this campaign." },
                { label: "Form field", desc: "Writes the value the visitor submitted in a specific input. Fields are grouped by page." },
              ].map((item) => (
                <div key={item.label} style={{ display: "flex", gap: 8 }}>
                  <span style={{ fontSize: 12, fontWeight: 600, color: "var(--text-primary)", minWidth: 180 }}>{item.label}</span>
                  <span style={{ fontSize: 12, color: "var(--text-secondary)" }}>{item.desc}</span>
                </div>
              ))}
            </div>
          </div>
        </Stack>
      )}

      {/* ── 3. Records ── */}
      {/* ── Edit Record Modal ── */}
      {genOpen && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.6)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000 }}
          onClick={() => setGenOpen(false)}>
          <div style={{ background: "var(--bg-surface)", border: "1px solid var(--border)", borderRadius: 12, padding: "24px 28px", width: 460, maxWidth: "90vw", maxHeight: "85vh", overflowY: "auto" }}
            onClick={(e) => e.stopPropagation()}>
            <Text as="h3" size="md" weight="semibold" style={{ marginBottom: 6 }}>Generate test data</Text>
            <Text size="sm" tone="secondary" style={{ marginBottom: 16 }}>
              Creates fake records with realistic values. Each record gets a name + email
              {fields.length > 0 ? ", plus the fields below." : " (add fields via CSV or a template for more)."}
            </Text>

            <label style={{ fontSize: 13, fontWeight: 500, display: "flex", flexDirection: "column", gap: 5, marginBottom: 14 }}>
              How many?
              <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                <input type="number" min={1} max={500} value={genCount}
                  onChange={(e) => setGenCount(Math.max(1, Math.min(500, Number(e.target.value) || 1)))}
                  style={{ ...fixedInputStyle, width: 100 }} />
                {[10, 25, 100].map((n) => (
                  <Button key={n} appearance="outline" tone="neutral" size="sm" onClick={() => setGenCount(n)}>{n}</Button>
                ))}
              </div>
            </label>

            {fields.length > 0 && (
              <div style={{ display: "flex", flexDirection: "column", gap: 10, borderTop: "1px solid var(--border)", paddingTop: 14 }}>
                <Text size="sm" weight="semibold">Field data types</Text>
                {fields.map((f) => (
                  <div key={f.key} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10 }}>
                    <span style={{ fontSize: 13 }}>{f.label} <code style={{ fontSize: 11, color: "var(--text-muted)" }}>({f.key})</code>{f.onActivation ? <em style={{ fontSize: 11, color: "var(--text-muted)" }}> · set on activation</em> : null}</span>
                    <select
                      disabled={!!f.onActivation}
                      value={genOverrides[f.key] ?? resolveGenerator(f)}
                      onChange={(e) => setGenOverrides((prev) => ({ ...prev, [f.key]: e.target.value }))}
                      style={{ ...fixedInputStyle, width: 170, opacity: f.onActivation ? 0.5 : 1 }}
                    >
                      {GENERATOR_KEYS.map((g) => (
                        <option key={g} value={g}>{GENERATOR_LABELS[g]}</option>
                      ))}
                    </select>
                  </div>
                ))}
              </div>
            )}

            <div style={{ display: "flex", gap: 10, justifyContent: "flex-end", marginTop: 20 }}>
              <Button appearance="outline" tone="neutral" size="sm" onClick={() => setGenOpen(false)}>Cancel</Button>
              <Button appearance="solid" tone="action" size="sm" disabled={generating} onClick={handleGenerate}>
                {generating ? "Generating…" : `Generate ${genCount}`}
              </Button>
            </div>
          </div>
        </div>
      )}

      {editRecord && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.6)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000 }}
          onClick={() => setEditRecord(null)}>
          <div style={{ background: "var(--bg-surface)", border: "1px solid var(--border)", borderRadius: 12, padding: "24px 28px", width: 420, maxWidth: "90vw" }}
            onClick={(e) => e.stopPropagation()}>
            <Text as="h3" size="md" weight="semibold" style={{ marginBottom: 16 }}>Edit record</Text>
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              <label style={{ fontSize: 13, fontWeight: 500, display: "flex", flexDirection: "column", gap: 5 }}>
                Name
                <input value={editName} onChange={(e) => setEditName(e.target.value)} style={fixedInputStyle} />
              </label>
              <label style={{ fontSize: 13, fontWeight: 500, display: "flex", flexDirection: "column", gap: 5 }}>
                Email
                <input value={editEmail} onChange={(e) => setEditEmail(e.target.value)} style={fixedInputStyle} />
              </label>
              {fields.map((f) => (
                <label key={f.key} style={{ fontSize: 13, fontWeight: 500, display: "flex", flexDirection: "column", gap: 5 }}>
                  {f.label} <code style={{ fontSize: 11, color: "var(--text-muted)" }}>({f.key})</code>
                  <input value={editFields[f.key] ?? ""} onChange={(e) => setEditFields((prev) => ({ ...prev, [f.key]: e.target.value }))} style={fixedInputStyle} />
                </label>
              ))}
            </div>
            <div style={{ display: "flex", gap: 10, justifyContent: "flex-end", marginTop: 20 }}>
              <Button appearance="outline" tone="neutral" size="sm" onClick={() => setEditRecord(null)}>Cancel</Button>
              <Button appearance="solid" tone="action" size="sm" disabled={savingEdit} onClick={handleSaveEdit}>
                {savingEdit ? "Saving…" : "Save changes"}
              </Button>
            </div>
          </div>
        </div>
      )}

      {step === "records" && (
        <Stack direction="vertical" size="md">
          {/* Search */}
          <form onSubmit={(e) => { e.preventDefault(); setSearch(searchInput); loadRecords(1, searchInput); }} style={{ display: "flex", gap: 8 }}>
            <input
              value={searchInput}
              onChange={(e) => { setSearchInput(e.target.value); if (!e.target.value) { setSearch(""); loadRecords(1, ""); } }}
              placeholder="Search by name or email…"
              style={{ flex: 1, background: "var(--bg-raised)", border: "1px solid var(--border)", borderRadius: 6, padding: "7px 10px", color: "var(--text-primary)", fontSize: 13 }}
            />
            <Button type="submit" appearance="outline" tone="neutral" size="sm">Search</Button>
          </form>

          <Stack direction="horizontal" align="center">
            <Text size="sm" tone="secondary" style={{ flex: 1 }}>
              {totalRecords > 0
                ? `${(currentPage - 1) * PAGE_SIZE + 1}–${Math.min(currentPage * PAGE_SIZE, totalRecords)} of ${totalRecords} records${search ? ` matching "${search}"` : ""}`
                : search ? `No records matching "${search}"` : "0 records imported"}
            </Text>
            <div style={{ display: "flex", gap: 8 }}>
              <Button size="sm" appearance="outline" tone="neutral" onClick={() => loadRecords(currentPage)}>
                Refresh
              </Button>
              {canEdit && (
                <>
                  <Button size="sm" appearance="outline" tone="neutral" onClick={() => setStep("import")}>
                    Import more
                  </Button>
                  <Button size="sm" appearance="outline" tone="action" disabled={generating} onClick={() => { setGenOverrides({}); setGenOpen(true); }}>
                    Generate test data
                  </Button>
                  {totalRecords > 0 && (
                    <Button size="sm" appearance="outline" tone="danger" onClick={handleTruncate}>
                      Clear all
                    </Button>
                  )}
                </>
              )}
            </div>
          </Stack>

          {totalRecords === 0 ? (
            <div style={{ border: "2px dashed var(--border)", borderRadius: 10, padding: "48px 24px", textAlign: "center" }}>
              <div style={{ fontSize: 28, marginBottom: 10 }}>👥</div>
              <p style={{ fontWeight: 600, fontSize: 14, color: "var(--text-primary)", margin: "0 0 6px" }}>No audience records</p>
              <p style={{ fontSize: 13, color: "var(--text-secondary)", margin: "0 0 16px", maxWidth: 360, marginInline: "auto" }}>
                Import a CSV file with a <code>lookup_key</code> column plus any custom fields you want to track per visitor.
              </p>
              <button
                style={{ background: "var(--accent)", color: "var(--text-inverse)", border: "none", borderRadius: 7, padding: "8px 16px", fontSize: 13, fontWeight: 600, cursor: "pointer" }}
                onClick={() => setStep("import")}
              >
                Go to Import →
              </button>
            </div>
          ) : (
            <div style={{ overflowX: "auto", border: "1px solid var(--border)", borderRadius: 8 }}>
              <table style={{ width: "100%", borderCollapse: "collapse" }}>
                <thead>
                  <tr>
                    {["lookup_key", ...fields.map((f) => f.label), "Activated", "Imported", ""].map((h, i) => (
                      <th key={i} style={thStyle}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {records.map((r) => {
                    const activatedAt = r.fields._activated_at as string | undefined;
                    return (
                    <tr key={r.id}>
                      <td style={tdStyle}>
                        <code style={{ fontSize: 12 }}>{r.lookupKey}</code>
                      </td>
                      {fields.map((f) => (
                        <td key={f.key} style={tdStyle}>{String(r.fields[f.key] ?? "—")}</td>
                      ))}
                      <td style={tdStyle}>
                        {activatedAt ? (
                          <span title={new Date(activatedAt).toLocaleString()} style={{ color: "var(--success, #16a34a)", fontWeight: 600, fontSize: 12 }}>
                            ✓ {new Date(activatedAt).toLocaleDateString()}
                          </span>
                        ) : (
                          <span style={{ color: "var(--text-muted)", fontSize: 12 }}>—</span>
                        )}
                      </td>
                      <td style={tdStyle}>{new Date(r.createdAt).toLocaleDateString()}</td>
                      <td style={{ ...tdStyle, width: 72, padding: "0 8px" }}>
                        {canEdit && (
                          <div style={{ display: "flex", gap: 4, justifyContent: "flex-end" }}>
                            <button
                              onClick={() => openEditRecord(r)}
                              style={{
                                background: "none", border: "none", cursor: "pointer",
                                color: "var(--text-muted)", fontSize: 15, lineHeight: 1,
                                padding: "2px 4px", borderRadius: 4,
                              }}
                              title="Edit record"
                            >
                              ✎
                            </button>
                            <button
                              disabled={deletingId === r.id}
                              onClick={() => handleDeleteRecord(r.id)}
                              style={{
                                background: "none", border: "none", cursor: "pointer",
                                color: "var(--text-muted)", fontSize: 16, lineHeight: 1,
                                opacity: deletingId === r.id ? 0.4 : 1,
                                padding: "2px 4px", borderRadius: 4,
                              }}
                              title="Delete record"
                            >
                              ×
                            </button>
                          </div>
                        )}
                      </td>
                    </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}

          {/* Pagination controls */}
          {totalRecords > PAGE_SIZE && (
            <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 8, paddingTop: 4 }}>
              <button
                disabled={currentPage <= 1}
                onClick={() => loadRecords(currentPage - 1, search)}
                style={paginationBtnStyle(currentPage <= 1)}
              >
                ← Prev
              </button>
              <span style={{ fontSize: 12, color: "var(--text-secondary)" }}>
                Page {currentPage} of {Math.ceil(totalRecords / PAGE_SIZE)}
              </span>
              <button
                disabled={currentPage >= Math.ceil(totalRecords / PAGE_SIZE)}
                onClick={() => loadRecords(currentPage + 1, search)}
                style={paginationBtnStyle(currentPage >= Math.ceil(totalRecords / PAGE_SIZE))}
              >
                Next →
              </button>
            </div>
          )}
        </Stack>
      )}
    </Stack>
  );
}

const thStyle: React.CSSProperties = {
  padding: "8px 14px", textAlign: "left", fontSize: 11, fontWeight: 600,
  letterSpacing: "0.06em", textTransform: "uppercase", color: "var(--text-muted)",
  borderBottom: "1px solid var(--border)", background: "var(--bg-surface)",
  whiteSpace: "nowrap",
};
const tdStyle: React.CSSProperties = {
  padding: "9px 14px", fontSize: 13, color: "var(--text-primary)",
  borderBottom: "1px solid var(--border-subtle, var(--border))",
  whiteSpace: "nowrap",
};
const activationHeaderRow: React.CSSProperties = {
  display: "flex", gap: 16, padding: "6px 14px",
  fontSize: 11, fontWeight: 600, letterSpacing: "0.06em", textTransform: "uppercase",
  color: "var(--text-muted)",
};
const activationRow: React.CSSProperties = {
  display: "flex", gap: 16, alignItems: "center",
  padding: "10px 14px", borderRadius: 6,
  border: "1px solid var(--border)", marginBottom: 4,
  background: "var(--bg-surface)",
};
const selectStyle: React.CSSProperties = {
  background: "var(--bg-raised)", border: "1px solid var(--border)",
  borderRadius: 6, padding: "6px 9px", color: "var(--text-primary)",
  fontSize: 13, minWidth: 220,
};
const fixedInputStyle: React.CSSProperties = {
  background: "var(--bg-raised)", border: "1px solid var(--border)",
  borderRadius: 6, padding: "6px 9px", color: "var(--text-primary)",
  fontSize: 13, flex: 1,
};

function paginationBtnStyle(disabled: boolean): React.CSSProperties {
  return {
    background: "var(--bg-surface)", border: "1px solid var(--border)",
    borderRadius: 6, padding: "5px 12px", fontSize: 12,
    color: disabled ? "var(--text-muted)" : "var(--text-primary)",
    cursor: disabled ? "default" : "pointer",
    opacity: disabled ? 0.5 : 1,
  };
}
