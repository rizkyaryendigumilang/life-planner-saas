/** @type {import('tailwindcss').Config} */
export default {
  darkMode: "class",
  future: {
    hoverOnlyWhenSupported: true,
  },
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      fontFamily: {
        sans: [
          "ui-sans-serif",
          "system-ui",
          "-apple-system",
          "BlinkMacSystemFont",
          '"Segoe UI Variable Text"',
          '"Segoe UI"',
          "Roboto",
          '"Helvetica Neue"',
          "Arial",
          '"Noto Sans"',
          "sans-serif",
        ],
        mono: ['"Cascadia Code"', '"SF Mono"', "ui-monospace", "Menlo", "Consolas", "monospace"],
      },
      colors: {
        canvas: "rgb(var(--c-canvas) / <alpha-value>)",
        surface: "rgb(var(--c-surface) / <alpha-value>)",
        muted: "rgb(var(--c-muted) / <alpha-value>)",
        ink: "rgb(var(--c-ink) / <alpha-value>)",
        "ink-soft": "rgb(var(--c-ink-soft) / <alpha-value>)",
        "ink-faint": "rgb(var(--c-ink-faint) / <alpha-value>)",
        line: "rgb(var(--c-line) / <alpha-value>)",
        accent: "rgb(var(--c-accent) / <alpha-value>)",
        "accent-ink": "rgb(var(--c-accent-ink) / <alpha-value>)",
        positive: "rgb(var(--c-positive) / <alpha-value>)",
        caution: "rgb(var(--c-caution) / <alpha-value>)",
        negative: "rgb(var(--c-negative) / <alpha-value>)",
        "data-1": "rgb(var(--c-data-1) / <alpha-value>)",
        "data-2": "rgb(var(--c-data-2) / <alpha-value>)",
        "data-3": "rgb(var(--c-data-3) / <alpha-value>)",
        "data-4": "rgb(var(--c-data-4) / <alpha-value>)",
        "data-5": "rgb(var(--c-data-5) / <alpha-value>)",
        "data-6": "rgb(var(--c-data-6) / <alpha-value>)",
      },
      borderRadius: {
        xl: "0.75rem",
        "2xl": "1rem",
      },
      boxShadow: {
        soft: "0 1px 2px rgba(12,13,20,.04), 0 10px 30px -18px rgba(12,13,20,.14)",
        pop: "0 24px 64px -24px rgba(12,13,20,.30)",
      },
      keyframes: {
        rise: { "0%": { opacity: "0", transform: "translateY(6px)" }, "100%": { opacity: "1", transform: "translateY(0)" } },
      },
      animation: { rise: "rise .26s ease-out both" },
    },
  },
  plugins: [],
};
