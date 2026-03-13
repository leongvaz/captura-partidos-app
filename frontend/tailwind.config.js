/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        primary: { 600: '#1e3a5f', 700: '#152a47', 800: '#0f172a' },
      },
    },
  },
  plugins: [],
};
