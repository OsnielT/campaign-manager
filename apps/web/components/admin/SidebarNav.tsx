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
  LogOut,
  PanelLeftClose,
  PanelLeftOpen,
} from "lucide-react";

const NAV_ITEMS = [
  { href: "/dashboard",    label: "Dashboard", Icon: LayoutDashboard },
  { href: "/campaigns",    label: "Campaigns", Icon: Megaphone },
  { href: "/templates",    label: "Templates", Icon: LayoutTemplate },
  { href: "/media",        label: "Media",     Icon: ImageIcon },
  { href: "/org/products", label: "Products",  Icon: Package },
  { href: "/org/members",  label: "Members",   Icon: Users },
  { href: "/org/settings", label: "Settings",  Icon: Settings },
];

export function SidebarNav({
  collapsed = false,
  onToggle,
}: {
  collapsed?: boolean;
  onToggle?: () => void;
}) {
  const pathname = usePathname();

  return (
    <nav
      style={{
        ...nav,
        width: collapsed ? "56px" : "220px",
        padding: collapsed ? "16px 8px" : "20px 12px",
        alignItems: collapsed ? "center" : undefined,
      }}
    >
      {/* Logo / toggle row */}
      <div
        style={{
          ...logoRow,
          justifyContent: collapsed ? "center" : "space-between",
          padding: collapsed ? "4px 0 20px" : "4px 0 20px",
        }}
      >
        {!collapsed && (
          <div style={{ display: "flex", alignItems: "center", gap: "9px", paddingLeft: "8px" }}>
            <span style={logoMark} />
            <span style={logoLabel}>Primitive</span>
          </div>
        )}
        {collapsed && <span style={logoMark} />}
        {onToggle && (
          <button
            onClick={onToggle}
            style={{
              ...toggleBtn,
              marginLeft: collapsed ? undefined : "auto",
              marginRight: collapsed ? undefined : "4px",
            }}
            title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          >
            {collapsed
              ? <PanelLeftOpen size={15} strokeWidth={1.8} />
              : <PanelLeftClose size={15} strokeWidth={1.8} />}
          </button>
        )}
      </div>

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
                <Icon
                  size={16}
                  strokeWidth={active ? 2.2 : 1.8}
                  style={{ flexShrink: 0 }}
                />
                {!collapsed && label}
              </Link>
            </li>
          );
        })}
      </ul>

      {/* Footer */}
      <div style={{ ...footer, width: "100%" }}>
        <Link
          href="/logout"
          style={navLink}
          title={collapsed ? "Sign out" : undefined}
        >
          <LogOut size={16} strokeWidth={1.8} style={{ flexShrink: 0 }} />
          {!collapsed && "Sign out"}
        </Link>
      </div>
    </nav>
  );
}

const nav: React.CSSProperties = {
  flexShrink: 0,
  background: "var(--bg-surface)",
  borderRight: "1px solid var(--border-subtle)",
  display: "flex",
  flexDirection: "column",
  gap: "4px",
  transition: "width 0.2s ease, padding 0.2s ease",
  overflow: "hidden",
};

const logoRow: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
};

const logoMark: React.CSSProperties = {
  width: "22px",
  height: "22px",
  borderRadius: "5px",
  background: "var(--accent)",
  flexShrink: 0,
  display: "block",
};

const logoLabel: React.CSSProperties = {
  fontSize: "14px",
  fontWeight: "600",
  letterSpacing: "-0.3px",
  color: "var(--text-primary)",
};

const list: React.CSSProperties = {
  listStyle: "none",
  display: "flex",
  flexDirection: "column",
  gap: "2px",
};

const navLink: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  justifyContent: "flex-start",
  gap: "9px",
  padding: "8px 10px",
  borderRadius: "var(--radius-sm)",
  fontSize: "13px",
  fontWeight: "500",
  color: "var(--text-secondary)",
  transition: "background 0.1s, color 0.1s",
  textDecoration: "none",
  whiteSpace: "nowrap",
  overflow: "hidden",
};

const navLinkActive: React.CSSProperties = {
  background: "var(--accent-muted)",
  color: "var(--accent-hover)",
};

const footer: React.CSSProperties = {
  marginTop: "auto",
  paddingTop: "12px",
  borderTop: "1px solid var(--border-subtle)",
};

const toggleBtn: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  width: "24px",
  height: "24px",
  background: "transparent",
  border: "none",
  borderRadius: "var(--radius-sm)",
  color: "var(--text-muted)",
  cursor: "pointer",
  flexShrink: 0,
  padding: 0,
};
