import Link from "next/link";

export default function NotFound() {
  return (
    <html lang="en">
      <body
        style={{
          margin: 0,
          fontFamily: "'Helvetica Neue', Helvetica, Arial, sans-serif",
          background: "#080810",
          color: "#94a3b8",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          minHeight: "100vh",
        }}
      >
        <div style={{ textAlign: "center", padding: "0 24px" }}>
          <p style={{ fontSize: 80, fontWeight: 800, color: "#1e1e2e", margin: "0 0 8px", letterSpacing: "-4px" }}>
            404
          </p>
          <p style={{ fontSize: 20, fontWeight: 600, color: "#e2e8f0", margin: "0 0 10px" }}>
            Page not found
          </p>
          <p style={{ fontSize: 14, margin: "0 0 32px" }}>
            The page you're looking for doesn't exist or has been removed.
          </p>
          <Link
            href="/"
            style={{
              display: "inline-block",
              padding: "10px 24px",
              background: "#7c5af3",
              color: "#fff",
              borderRadius: 8,
              fontSize: 14,
              fontWeight: 600,
              textDecoration: "none",
            }}
          >
            Go home
          </Link>
        </div>
      </body>
    </html>
  );
}
