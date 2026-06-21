"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Megaphone,
  LayoutTemplate,
  Image as ImageIcon,
  Package,
  Users,
  Settings,
  PanelLeftClose,
  PanelLeftOpen,
  LogOut,
} from "lucide-react";
import StemflowLogo from "@/components/branding/StemflowLogo";
import { useRouter } from "next/navigation";

const NAV_ITEMS = [
  { href: "/dashboard", label: "Dashboard", Icon: LayoutDashboard },
  { href: "/campaigns", label: "Campaigns", Icon: Megaphone },
  { href: "/templates", label: "Templates", Icon: LayoutTemplate },
  { href: "/media", label: "Media", Icon: ImageIcon },
  { href: "/org/products", label: "Products", Icon: Package },
  { href: "/org/members", label: "Members", Icon: Users },
  { href: "/org/settings", label: "Settings", Icon: Settings },
];

export function SidebarNav({
  collapsed = false,
  onToggle,
}: {
  collapsed?: boolean;
  onToggle?: () => void;
}) {
  const router = useRouter();
  const pathname = usePathname();

  function handleLogout() {
    if (window.confirm("Log out of Stemflow?")) router.push("/logout");
  }

  return (
    <nav
      style={{
        ...nav,
        width: collapsed ? "56px" : "216px",
        padding: collapsed ? "16px 8px" : "20px 12px",
        alignItems: collapsed ? "center" : undefined,
      }}
    >
      {/* Logo + toggle */}
      <div style={{ ...logoRow, justifyContent: collapsed ? "center" : "space-between" }}>
        {!collapsed && (
          <div style={{ paddingLeft: 6 }}>
            <StemflowLogo width={96} />
          </div>
        )}
        {onToggle && (
          <button
            onClick={onToggle}
            style={toggleBtn}
            title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          >
            {collapsed
              ? <PanelLeftOpen size={15} strokeWidth={1.6} />
              : <PanelLeftClose size={15} strokeWidth={1.6} />}
          </button>
        )}
      </div>

      {/* Divider */}
      <div style={divider} />

      {/* Nav items */}
      <ul style={{ ...list, width: "100%" }}>
        {NAV_ITEMS.map(({ href, label, Icon }) => {
          const active = pathname === href || pathname.startsWith(href + "/");
          return (
            <li key={href}>
              <Link
                href={href as never}
                style={active ? { ...navLink, ...navLinkActive } : navLink}
                title={collapsed ? label : undefined}
              >
                {active && <span style={activePip} aria-hidden />}
                <Icon
                  size={16}
                  strokeWidth={active ? 2.2 : 1.7}
                  style={{ flexShrink: 0, opacity: active ? 1 : 0.7 }}
                />
                {!collapsed && (
                  <span style={{ opacity: active ? 1 : 0.75 }}>{label}</span>
                )}
              </Link>
            </li>
          );
        })}
      </ul>

      {/* Footer */}
      <div style={{ ...footer, width: "100%" }}>
        <button
          onClick={handleLogout}
          style={{
            ...logoutBtn,
            justifyContent: collapsed ? "center" : "flex-start",
          }}
          title="Log out"
        >
          <LogOut size={15} strokeWidth={1.7} style={{ flexShrink: 0, opacity: 0.6 }} />
          {!collapsed && <span style={{ opacity: 0.6 }}>Log out</span>}
        </button>
      </div>
    </nav>
  );
}

/* ── Styles ── */

const nav: React.CSSProperties = {
  flexShrink: 0,
  background: "#131b2e",
  borderRight: "1px solid rgba(255,255,255,0.06)",
  display: "flex",
  flexDirection: "column",
  gap: "2px",
  transition: "width 0.2s cubic-bezier(0.22,1,0.36,1), padding 0.2s cubic-bezier(0.22,1,0.36,1)",
  overflow: "hidden",
  position: "relative",
};

const logoRow: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  paddingBottom: "4px",
};

const divider: React.CSSProperties = {
  height: "1px",
  background: "rgba(255,255,255,0.07)",
  margin: "12px 0 10px",
  flexShrink: 0,
};

const list: React.CSSProperties = {
  listStyle: "none",
  display: "flex",
  flexDirection: "column",
  gap: "1px",
};

const navLink: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: "9px",
  padding: "8px 10px",
  borderRadius: "6px",
  fontSize: "13px",
  fontWeight: "500",
  color: "rgba(255,255,255,0.65)",
  transition: "background 0.12s, color 0.12s",
  textDecoration: "none",
  whiteSpace: "nowrap",
  overflow: "hidden",
  position: "relative",
  letterSpacing: "0",
};

const navLinkActive: React.CSSProperties = {
  background: "rgba(99, 102, 241, 0.18)",
  color: "#a5b4fc",
};

const activePip: React.CSSProperties = {
  position: "absolute",
  left: 0,
  top: "50%",
  transform: "translateY(-50%)",
  width: "3px",
  height: "18px",
  borderRadius: "0 3px 3px 0",
  background: "linear-gradient(180deg, #6366f1, #a78bfa)",
  flexShrink: 0,
};

const footer: React.CSSProperties = {
  marginTop: "auto",
  paddingTop: "12px",
  borderTop: "1px solid rgba(255,255,255,0.07)",
};

const logoutBtn: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: "9px",
  width: "100%",
  padding: "8px 10px",
  borderRadius: "6px",
  fontSize: "13px",
  fontWeight: "500",
  color: "rgba(255,255,255,0.5)",
  background: "none",
  border: "none",
  cursor: "pointer",
  textAlign: "left",
  transition: "background 0.12s, color 0.12s",
};

const toggleBtn: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  width: "26px",
  height: "26px",
  background: "rgba(255,255,255,0.06)",
  border: "1px solid rgba(255,255,255,0.08)",
  borderRadius: "6px",
  color: "rgba(255,255,255,0.45)",
  cursor: "pointer",
  flexShrink: 0,
  padding: 0,
  transition: "background 0.12s",
};
