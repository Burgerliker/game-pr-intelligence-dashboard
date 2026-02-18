/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './app/**/*.{js,jsx,ts,tsx}',
    './components/**/*.{js,jsx,ts,tsx}',
    './lib/**/*.{js,jsx,ts,tsx}',
  ],
  theme: {
    extend: {
      colors: {
        bg: '#edf2f8',
        card: '#ffffff',
        line: '#d7deeb',
        text: '#0f172a',
        muted: '#64748b',
        primary: '#1d4ed8',
      },
      boxShadow: {
        soft: '0 12px 36px rgba(15, 23, 42, 0.10)',
      },
      borderRadius: {
        xl: '1rem',
        '2xl': '1.25rem',
      },
    },
  },
  corePlugins: {
    preflight: false,
  },
  plugins: [],
};
