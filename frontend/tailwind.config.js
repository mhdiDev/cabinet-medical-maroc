/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./src/**/*.{js,ts,jsx,tsx,mdx}'],
  theme: {
    extend: {
      colors: {
        primary: { 50: '#eff6ff', 100: '#dbeafe', 200: '#bfdbfe', 500: '#3b82f6', 600: '#2563eb', 700: '#1d4ed8', 800: '#1e40af', 900: '#1e3a8a' },
        medical: { green: '#10b981', red: '#ef4444', orange: '#f59e0b' },
      },
      fontFamily: { arabic: ['Noto Kufi Arabic', 'sans-serif'] },
    },
  },
  plugins: [],
};
