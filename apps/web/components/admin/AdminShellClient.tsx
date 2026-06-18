"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { SidebarNav } from "./SidebarNav";

const STORAGE_KEY = "primitive_sidebar_collapsed";

const CAMPAIGN_DETAIL_RE = /^\/campaigns\/[^/]+(?:\/(?!compose).*)?$/;

export function AdminShellClient({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored !== null) {
      setCollapsed(stored === "true");
    }
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!mounted) return;
    if (CAMPAIGN_DETAIL_RE.test(pathname)) {
      setCollapsed(true);
      localStorage.setItem(STORAGE_KEY, "true");
    }
  }, [pathname, mounted]);

  function toggle() {
    setCollapsed((prev) => {
      const next = !prev;
      localStorage.setItem(STORAGE_KEY, String(next));
      return next;
    });
  }

  return (
    <div style={shell}>
      <SidebarNav collapsed={collapsed} onToggle={toggle} />
      <div style={main}>{children}</div>
    </div>
  );
}

const shell: React.CSSProperties = {
  display: "flex",
  height: "100vh",
  overflow: "hidden",
};

const main: React.CSSProperties = {
  flex: 1,
  overflow: "auto",
  background: "var(--bg)",
};
