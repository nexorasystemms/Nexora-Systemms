/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        'brand-navy': '#1e3a8a',
        'brand-navy-light': '#3b82f6',
        'brand-blue': '#2563eb',
        'brand-surface': '#ffffff',
        'brand-border': '#e5e7eb',
        'brand-muted': '#6b7280',
        primary: '#2563eb',
        secondary: '#64748b',
        background: '#ffffff',
        surface: '#f8fafc',
        'on-surface': '#1e293b',
        'on-surface-variant': '#64748b',
        'surface-container': '#f1f5f9',
        'surface-container-low': '#f8fafc',
        'surface-container-lowest': '#ffffff',
        'surface-container-high': '#e2e8f0',
        'surface-container-highest': '#cbd5e1',
        'primary-container': '#dbeafe',
        'on-primary': '#ffffff',
        'on-primary-container': '#1e40af',
        'secondary-container': '#f1f5f9',
        'on-secondary-container': '#475569',
        'tertiary-container': '#dcfce7',
        'tertiary-fixed': '#bbf7d0',
        'on-tertiary-container': '#166534',
        'error': '#dc2626',
        'error-container': '#fef2f2',
        'on-error-container': '#991b1b',
        'outline-variant': '#d1d5db'
      },
      spacing: {
        'space-xs': '0.25rem',
        'space-sm': '0.5rem',
        'space-md': '1rem',
        'space-lg': '1.5rem',
        'space-xl': '2rem',
        'gutter': '1rem',
        'gutter-desktop': '1.5rem',
        'margin-desktop': '2rem'
      }
    },
  },
  plugins: [],
}