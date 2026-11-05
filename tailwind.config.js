/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        sib: { blue: '#0057B9', navy: '#071A36', orange: '#FF7800' },
      },
    },
  },
  plugins: [],
}
