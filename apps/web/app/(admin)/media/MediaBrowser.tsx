"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
import { Stack, Text, Button, Badge } from "@primitive/react";
import { Upload, Copy, Check, Trash2, ImageOff } from "lucide-react";

interface MediaAsset {
  id: string;
  filename: string;
  contentType: string;
  sizeBytes: number;
  publicUrl: string;
  createdAt: string;
}

type UploadState = "idle" | "requesting" | "uploading" | "done" | "error";

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function isImage(contentType: string): boolean {
  return contentType.startsWith("image/");
}

export function MediaBrowser() {
  const [assets, setAssets] = useState<MediaAsset[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploadState, setUploadState] = useState<UploadState>("idle");
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/media");
      if (res.ok) {
        const data = await res.json();
        setAssets(data.assets);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploadError(null);
    setUploadState("requesting");

    try {
      // 1. Request presigned URL
      const initRes = await fetch("/api/media", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          filename: file.name,
          contentType: file.type,
          sizeBytes: file.size,
        }),
      });

      if (!initRes.ok) {
        const err = await initRes.json();
        throw new Error(err.error ?? "Failed to initiate upload");
      }

      const { presignedUrl } = await initRes.json();

      // 2. Upload directly to R2
      setUploadState("uploading");
      const uploadRes = await fetch(presignedUrl, {
        method: "PUT",
        headers: { "Content-Type": file.type },
        body: file,
      });

      if (!uploadRes.ok) throw new Error("Upload to storage failed");

      setUploadState("done");
      await load();
    } catch (err) {
      setUploadError(err instanceof Error ? err.message : "Upload failed");
      setUploadState("error");
    } finally {
      // Reset input so same file can be re-selected
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  async function handleDelete(asset: MediaAsset) {
    if (!confirm(`Delete "${asset.filename}"? This cannot be undone.`)) return;
    await fetch(`/api/media/${asset.id}`, { method: "DELETE" });
    setAssets((prev) => prev.filter((a) => a.id !== asset.id));
  }

  async function copyUrl(asset: MediaAsset) {
    await navigator.clipboard.writeText(asset.publicUrl);
    setCopiedId(asset.id);
    setTimeout(() => setCopiedId(null), 1500);
  }

  const uploading = uploadState === "requesting" || uploadState === "uploading";

  return (
    <div style={{ padding: "32px" }}>
      <Stack direction="vertical" size="lg">
        {/* Header */}
        <Stack direction="horizontal" align="center">
          <Text as="h1" size="lg" weight="semibold" style={{ flex: 1 }}>
            Media
          </Text>
          <label>
            <input
              ref={fileRef}
              type="file"
              accept="image/*,video/mp4,video/webm,application/pdf"
              style={{ display: "none" }}
              onChange={handleFileChange}
              disabled={uploading}
            />
            <Button
              appearance="solid"
              tone="action"
              size="sm"
              style={{ cursor: uploading ? "not-allowed" : "pointer" }}
            >
              {uploading
                ? uploadState === "requesting"
                  ? "Preparing…"
                  : "Uploading…"
                : <><Upload size={13} style={{ display: "inline", verticalAlign: "middle", marginRight: 5 }} />Upload file</> }
            </Button>
          </label>
        </Stack>

        {uploadError && (
          <Text size="sm" tone="danger">
            {uploadError}
          </Text>
        )}

        {/* Grid */}
        {loading ? (
          <Text tone="secondary" size="sm">Loading…</Text>
        ) : assets.length === 0 ? (
          <EmptyState />
        ) : (
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fill, minmax(180px, 1fr))",
              gap: "16px",
            }}
          >
            {assets.map((asset) => (
              <AssetCard
                key={asset.id}
                asset={asset}
                copied={copiedId === asset.id}
                onCopy={copyUrl}
                onDelete={handleDelete}
              />
            ))}
          </div>
        )}
      </Stack>
    </div>
  );
}

function AssetCard({
  asset,
  copied,
  onCopy,
  onDelete,
}: {
  asset: MediaAsset;
  copied: boolean;
  onCopy: (a: MediaAsset) => void;
  onDelete: (a: MediaAsset) => void;
}) {
  const [hover, setHover] = useState(false);

  return (
    <div
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        borderRadius: 8,
        overflow: "hidden",
        border: "1px solid var(--border)",
        background: "var(--bg-surface)",
        transition: "box-shadow 0.15s",
        boxShadow: hover ? "var(--shadow)" : "var(--shadow-sm)",
      }}
    >
      {/* Thumbnail */}
      <div
        style={{
          height: 120,
          background: "var(--bg-sunken)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          overflow: "hidden",
          position: "relative",
        }}
      >
        {isImage(asset.contentType) ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={asset.publicUrl}
            alt={asset.filename}
            style={{ width: "100%", height: "100%", objectFit: "cover" }}
          />
        ) : (
          <Text size="sm" tone="secondary">
            {asset.contentType.split("/")[1]?.toUpperCase() ?? "FILE"}
          </Text>
        )}
      </div>

      {/* Info */}
      <div style={{ padding: "10px 12px 12px" }}>
        <Text
          size="sm"
          weight="medium"
          style={{
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
            display: "block",
          }}
          title={asset.filename}
        >
          {asset.filename}
        </Text>
        <Text size="sm" tone="secondary">
          {formatBytes(asset.sizeBytes)}
        </Text>

        <Stack direction="horizontal" size="sm" style={{ marginTop: 8 }}>
          <Button
            size="sm"
            appearance="outline"
            tone="action"
            onClick={() => onCopy(asset)}
            style={{ flex: 1 }}
          >
            {copied ? <><Check size={12} style={{ display: "inline", verticalAlign: "middle", marginRight: 4 }} />Copied!</> : <><Copy size={12} style={{ display: "inline", verticalAlign: "middle", marginRight: 4 }} />Copy URL</>}
          </Button>
          <Button
            size="sm"
            appearance="ghost"
            tone="danger"
            onClick={() => onDelete(asset)}
          >
            <Trash2 size={13} />
          </Button>
        </Stack>
      </div>
    </div>
  );
}

function EmptyState() {
  return (
    <div
      style={{
        border: "2px dashed var(--border)",
        borderRadius: 12,
        padding: "60px 32px",
        textAlign: "center",
      }}
    >
      <Stack direction="vertical" size="sm" align="center">
        <ImageOff size={28} strokeWidth={1.4} style={{ color: "var(--text-muted)", opacity: 0.5 }} />
        <Text size="lg" tone="secondary">No media yet</Text>
        <Text size="sm" tone="secondary">
          Upload images, videos, or PDFs up to 10 MB
        </Text>
      </Stack>
    </div>
  );
}
