/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        bg: '#f4f7fb',
        surface: '#ffffff',
        surface2: '#eef3f9',
        surface3: '#e2e8f0',
        border: '#d6deea',
        border2: '#b9c7da',
        accent: '#4f8ef7',
        accent5: '#a78bfa',
        text: '#0f172a',
        text2: '#475569',
        text3: '#64748b',
        success: '#6ee7b7',
        warning: '#f59e0b',
        danger: '#f87171',
        info: '#60a5fa',
      },
      fontFamily: {
        sans: ['DM Sans', 'sans-serif'],
        mono: ['DM Mono', 'monospace'],
      },
    },
  },
  plugins: [],
}
