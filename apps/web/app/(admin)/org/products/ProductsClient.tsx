"use client";

import { useState, useEffect, useCallback, FormEvent } from "react";
import { Stack, Text, Button, Input, Textarea, Badge } from "@twinaholic/react";
import { Plus, Pencil, Trash2, Save, X, Package } from "lucide-react";

interface OrgProduct {
  id: string;
  name: string;
  description: string | null;
  imageUrl: string | null;
  isActive: boolean;
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

export function ProductsClient({ orgId }: { orgId: string }) {
  const [products, setProducts] = useState<OrgProduct[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [imageUrl, setImageUrl] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/orgs/${orgId}/products`);
      const data = await res.json();
      setProducts(data.products ?? []);
    } finally {
      setLoading(false);
    }
  }, [orgId]);

  useEffect(() => { load(); }, [load]);

  function openCreate() {
    setEditId(null);
    setName("");
    setDescription("");
    setImageUrl("");
    setShowForm(true);
  }

  function openEdit(p: OrgProduct) {
    setEditId(p.id);
    setName(p.name);
    setDescription(p.description ?? "");
    setImageUrl(p.imageUrl ?? "");
    setShowForm(true);
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setCreating(true);
    try {
      const body = { name, description: description || undefined, imageUrl: imageUrl || undefined };
      const url = editId ? `/api/orgs/${orgId}/products/${editId}` : `/api/orgs/${orgId}/products`;
      const method = editId ? "PUT" : "POST";

      await fetch(url, {
        method,
        headers: { "Content-Type": "application/json", "x-csrf-token": getCsrf() },
        body: JSON.stringify(body),
      });

      setShowForm(false);
      await load();
    } finally {
      setCreating(false);
    }
  }

  async function handleToggleActive(p: OrgProduct) {
    await fetch(`/api/orgs/${orgId}/products/${p.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json", "x-csrf-token": getCsrf() },
      body: JSON.stringify({ isActive: !p.isActive }),
    });
    await load();
  }

  async function handleDelete(p: OrgProduct) {
    if (!confirm(`Delete "${p.name}"?`)) return;
    await fetch(`/api/orgs/${orgId}/products/${p.id}`, {
      method: "DELETE",
      headers: { "x-csrf-token": getCsrf() },
    });
    await load();
  }

  return (
    <div style={{ padding: "32px" }}>
      <Stack direction="vertical" size="lg">
        <Stack direction="horizontal" align="center">
          <Text as="h1" size="lg" weight="semibold" style={{ flex: 1 }}>Product library</Text>
          <Button size="sm" appearance="solid" tone="action" onClick={openCreate}>
            Add product
          </Button>
        </Stack>

        {showForm && (
          <form
            onSubmit={handleSubmit}
            style={{
              background: "var(--bg-surface)",
              border: "1px solid var(--border)",
              borderRadius: 10,
              padding: "20px 24px",
            }}
          >
            <Stack direction="vertical" size="md">
              <Text weight="semibold">{editId ? "Edit product" : "New product"}</Text>
              <Input
                label="Name"
                required
                value={name}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => setName(e.target.value)}
              />
              <Textarea
                label="Description"
                value={description}
                onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setDescription(e.target.value)}
                rows={3}
              />
              <Input
                label="Image URL"
                type="url"
                value={imageUrl}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => setImageUrl(e.target.value)}
                placeholder="https://…"
              />
              <Stack direction="horizontal" size="sm">
                <Button type="submit" appearance="solid" tone="action" size="sm">
                  {creating ? "Saving…" : editId ? <><Save size={13} style={{ display: "inline", verticalAlign: "middle", marginRight: 5 }} />Save</> : <><Plus size={13} style={{ display: "inline", verticalAlign: "middle", marginRight: 5 }} />Create</>}
                </Button>
                <Button
                  type="button"
                  appearance="ghost"
                  tone="neutral"
                  size="sm"
                  onClick={() => setShowForm(false)}
                >
                  <X size={13} style={{ display: "inline", verticalAlign: "middle", marginRight: 4 }} />Cancel
                </Button>
              </Stack>
            </Stack>
          </form>
        )}

        {loading ? (
          <Text tone="secondary" size="sm">Loading…</Text>
        ) : products.length === 0 ? (
          <EmptyState />
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {products.map((p) => (
              <div
                key={p.id}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 16,
                  background: "var(--bg-surface)",
                  border: "1px solid var(--border)",
                  borderRadius: 8,
                  padding: "14px 18px",
                }}
              >
                {p.imageUrl && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={p.imageUrl}
                    alt={p.name}
                    style={{ width: 48, height: 48, objectFit: "cover", borderRadius: 6, flexShrink: 0 }}
                  />
                )}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <Stack direction="horizontal" size="sm" align="center">
                    <Text weight="medium">{p.name}</Text>
                    <Badge
                      tone={p.isActive ? "success" : "neutral"}
                      appearance="soft"
                      size="sm"
                    >
                      {p.isActive ? "Active" : "Inactive"}
                    </Badge>
                  </Stack>
                  {p.description && (
                    <Text size="sm" tone="secondary" style={{ marginTop: 2 }}>{p.description}</Text>
                  )}
                </div>
                <Stack direction="horizontal" size="sm">
                  <Button size="sm" appearance="outline" tone="neutral" onClick={() => openEdit(p)}>
                    <Pencil size={12} style={{ display: "inline", verticalAlign: "middle", marginRight: 4 }} />Edit
                  </Button>
                  <Button
                    size="sm"
                    appearance="ghost"
                    tone="neutral"
                    onClick={() => handleToggleActive(p)}
                  >
                    {p.isActive ? "Deactivate" : "Activate"}
                  </Button>
                  <Button size="sm" appearance="ghost" tone="danger" onClick={() => handleDelete(p)}>
                    <Trash2 size={12} style={{ display: "inline", verticalAlign: "middle", marginRight: 4 }} />Delete
                  </Button>
                </Stack>
              </div>
            ))}
          </div>
        )}
      </Stack>
    </div>
  );
}

function EmptyState() {
  return (
    <div
      style={{
        border: "2px dashed var(--border)",
        borderRadius: 12,
        padding: "48px 32px",
        textAlign: "center",
      }}
    >
      <Stack direction="vertical" size="sm" align="center">
        <Text tone="secondary">No products yet</Text>
        <Text size="sm" tone="secondary">Add products to your library and reuse them across campaigns.</Text>
      </Stack>
    </div>
  );
}
