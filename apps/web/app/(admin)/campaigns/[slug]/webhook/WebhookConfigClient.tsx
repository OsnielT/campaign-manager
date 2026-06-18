"use client";

import { useState, useEffect, FormEvent } from "react";
import { Stack, Text, Button, Input } from "@primitive/react";

interface WebhookConfig {
  id: string;
  endpointUrl: string;
  payloadFields: string[];
  enabled: boolean;
  createdAt: string;
}

function getCsrf() {
  return (
    document.cookie
      .split("; ")
      .find((c) => c.startsWith("primitive_csrf="))
      ?.split("=")[1] ?? ""
  );
}

export function WebhookConfigClient({
  campaignSlug,
}: {
  campaignSlug: string;
  orgId: string;
}) {
  const [webhook, setWebhook] = useState<WebhookConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ ok: boolean; status?: number } | null>(null);
  const [secret, setSecret] = useState<string | null>(null);

  const [endpointUrl, setEndpointUrl] = useState("");
  const [payloadFields, setPayloadFields] = useState("*");
  const [enabled, setEnabled] = useState(true);

  useEffect(() => {
    fetch(`/api/campaigns/${campaignSlug}/webhook`)
      .then((r) => r.json())
      .then((data) => {
        if (data.webhook) {
          setWebhook(data.webhook);
          setEndpointUrl(data.webhook.endpointUrl);
          setPayloadFields(data.webhook.payloadFields.join(", "));
          setEnabled(data.webhook.enabled);
        }
      })
      .finally(() => setLoading(false));
  }, [campaignSlug]);

  async function handleSave(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    setSecret(null);
    try {
      const fields = payloadFields
        .split(",")
        .map((f) => f.trim())
        .filter(Boolean);

      const res = await fetch(`/api/campaigns/${campaignSlug}/webhook`, {
        method: "PUT",
        headers: { "Content-Type": "application/json", "x-csrf-token": getCsrf() },
        body: JSON.stringify({ endpointUrl, payloadFields: fields, enabled }),
      });
      const data = await res.json();
      setWebhook(data.webhook);
      if (data.secret) setSecret(data.secret);
    } finally {
      setSaving(false);
    }
  }

  async function handleRotateSecret() {
    if (!confirm("Rotate the signing secret? The old secret will stop working immediately.")) return;
    setSaving(true);
    setSecret(null);
    try {
      const res = await fetch(`/api/campaigns/${campaignSlug}/webhook`, {
        method: "PUT",
        headers: { "Content-Type": "application/json", "x-csrf-token": getCsrf() },
        body: JSON.stringify({ rotateSecret: true }),
      });
      const data = await res.json();
      if (data.secret) setSecret(data.secret);
    } finally {
      setSaving(false);
    }
  }

  async function handleTest() {
    setTesting(true);
    setTestResult(null);
    try {
      const res = await fetch(`/api/campaigns/${campaignSlug}/webhook`, {
        method: "POST",
        headers: { "x-csrf-token": getCsrf() },
      });
      const data = await res.json();
      setTestResult(data);
    } finally {
      setTesting(false);
    }
  }

  if (loading) return <Text tone="secondary" size="sm">Loading…</Text>;

  return (
    <Stack direction="vertical" size="lg">
      <Text as="h1" size="lg" weight="semibold">Webhook</Text>
      <Text size="sm" tone="secondary">
        Receive a signed HTTP POST to your endpoint whenever a conversion is recorded.
      </Text>

      {secret && (
        <div style={secretBanner}>
          <Text size="sm" weight="semibold">Signing secret (shown once — copy now):</Text>
          <code style={secretCode}>{secret}</code>
          <Text size="sm" tone="secondary">
            Verify the <code>X-Primitive-Signature</code> header (HMAC-SHA256) on every request.
          </Text>
        </div>
      )}

      <form onSubmit={handleSave} style={{ display: "contents" }}>
        <Stack direction="vertical" size="md">
          <Input
            label="Endpoint URL"
            type="url"
            required
            value={endpointUrl}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) => setEndpointUrl(e.target.value)}
            placeholder="https://your-server.com/webhook"
          />

          <div>
            <label style={labelStyle}>
              Payload fields
              <input
                style={inputStyle}
                value={payloadFields}
                onChange={(e) => setPayloadFields(e.target.value)}
                placeholder="* or field1, field2"
              />
            </label>
            <Text size="sm" tone="secondary" style={{ marginTop: 4 }}>
              Comma-separated field keys to include, or <code>*</code> for all.
            </Text>
          </div>

          <label style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer" }}>
            <input
              type="checkbox"
              checked={enabled}
              onChange={(e) => setEnabled(e.target.checked)}
            />
            <Text size="sm">Enabled</Text>
          </label>

          <Stack direction="horizontal" size="sm">
            <Button type="submit" appearance="solid" tone="action" size="sm">
              {saving ? "Saving…" : webhook ? "Save changes" : "Create webhook"}
            </Button>
            {webhook && (
              <>
                <Button
                  type="button"
                  appearance="outline"
                  tone="neutral"
                  size="sm"
                  onClick={handleRotateSecret}
                >
                  Rotate secret
                </Button>
                <Button
                  type="button"
                  appearance="outline"
                  tone="neutral"
                  size="sm"
                  onClick={handleTest}
                >
                  {testing ? "Sending…" : "Send test"}
                </Button>
              </>
            )}
          </Stack>

          {testResult && (
            <Text size="sm" tone={testResult.ok ? "success" : "danger"}>
              {testResult.ok
                ? `Test delivered — HTTP ${testResult.status}`
                : `Test failed — HTTP ${testResult.status ?? "no response"}`}
            </Text>
          )}
        </Stack>
      </form>
    </Stack>
  );
}

const secretBanner: React.CSSProperties = {
  background: "var(--warning-muted)",
  border: "1px solid var(--warning)",
  borderRadius: 8,
  padding: "14px 16px",
  display: "flex",
  flexDirection: "column",
  gap: 8,
};

const secretCode: React.CSSProperties = {
  fontFamily: "monospace",
  fontSize: 13,
  background: "var(--bg-sunken)",
  padding: "6px 10px",
  borderRadius: 4,
  wordBreak: "break-all",
  color: "var(--text-primary)",
};

const labelStyle: React.CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: 6,
  fontSize: 13,
  fontWeight: 500,
  color: "var(--text-secondary)",
};

const inputStyle: React.CSSProperties = {
  background: "var(--bg-raised)",
  border: "1px solid var(--border)",
  borderRadius: "var(--radius)",
  padding: "9px 12px",
  color: "var(--text-primary)",
  fontSize: 14,
};
