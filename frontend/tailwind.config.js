/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./src/**/*.{html,ts}'],
  darkMode: 'class',
  theme: {
    extend: {
      fontFamily: {
        sans: ['"DM Sans"', 'system-ui', 'Segoe UI', 'sans-serif'],
        mono: ['"JetBrains Mono"', 'ui-monospace', 'monospace'],
      },
      colors: {
        canvas: 'rgb(var(--c-canvas) / <alpha-value>)',
        surface: 'rgb(var(--c-surface) / <alpha-value>)',
        'surface-raised': 'rgb(var(--c-surface-raised) / <alpha-value>)',
        sidebar: 'rgb(var(--c-sidebar) / <alpha-value>)',
        'sidebar-hover': 'rgb(var(--c-sidebar-hover) / <alpha-value>)',
        stroke: 'rgb(var(--c-stroke) / <alpha-value>)',
        content: 'rgb(var(--c-content) / <alpha-value>)',
        muted: 'rgb(var(--c-muted) / <alpha-value>)',
        faint: 'rgb(var(--c-faint) / <alpha-value>)',
        accent: 'rgb(var(--c-accent) / <alpha-value>)',
        'accent-hover': 'rgb(var(--c-accent-hover) / <alpha-value>)',
        danger: 'rgb(var(--c-danger) / <alpha-value>)',
        warning: 'rgb(var(--c-warning) / <alpha-value>)',
      },
      boxShadow: {
        soft: '0 1px 2px rgb(15 23 42 / 0.05), 0 6px 18px rgb(15 23 42 / 0.04)',
        'soft-dark': '0 1px 3px rgb(0 0 0 / 0.35), 0 12px 32px rgb(0 0 0 / 0.25)',
      },
    },
  },
  plugins: [],
};
