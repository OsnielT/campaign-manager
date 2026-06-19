/** @type {import('tailwindcss').Config} */
module.exports = {
  // Only process the landing page — avoids conflicts with the rest of the app
  content: [
    "./app/page.tsx",
    "./app/landing/**/*.{ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        primary: "#3525cd",
        "primary-hover": "#4f46e5",
        "primary-muted": "#e2dfff",
        "primary-container": "#4f46e5",
        secondary: "#006591",
        surface: "#faf8ff",
        "surface-container": "#eaedff",
        "surface-container-low": "#f2f3ff",
        "surface-container-high": "#e2e7ff",
        "surface-container-lowest": "#ffffff",
        "on-surface": "#131b2e",
        "on-surface-variant": "#464555",
        "outline-variant": "#c7c4d8",
        "on-primary": "#ffffff",
      },
    },
  },
  plugins: [],
};
