"use client";

export default function GlobalError({ reset }: { error: Error; reset: () => void }) {
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
          <p style={{ fontSize: 20, fontWeight: 600, color: "#e2e8f0", margin: "0 0 10px" }}>
            Something went wrong
          </p>
          <p style={{ fontSize: 14, margin: "0 0 32px" }}>
            An unexpected error occurred. Please try again.
          </p>
          <button
            onClick={reset}
            style={{
              display: "inline-block",
              padding: "10px 24px",
              background: "#7c5af3",
              color: "#fff",
              borderRadius: 8,
              fontSize: 14,
              fontWeight: 600,
              border: "none",
              cursor: "pointer",
            }}
          >
            Try again
          </button>
        </div>
      </body>
    </html>
  );
}
