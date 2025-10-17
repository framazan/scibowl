/** @type {import('tailwindcss').Config} */
export default {
  darkMode: 'class',
  content: [
    './index.html',
    './src/**/*.{js,jsx,ts,tsx}'
  ],
  theme: {
    extend: {
      colors: {
        base: '#0a0a0a',
        text: '#0b0b0c',
        subtle: '#1c1c1e',
        card: '#ffffff',
        tint: '#0071e3',
        darkbg: '#18181b',
        darkcard: '#232326',
      },
      fontFamily: {
        sans: ['-apple-system', 'SF Pro Text', 'system-ui', 'Segoe UI', 'Roboto', 'Helvetica Neue', 'Arial', 'Noto Sans', 'Apple Color Emoji', 'Segoe UI Emoji', 'Segoe UI Symbol', 'Noto Color Emoji']
      },
      boxShadow: {
        card: '0 1px 3px rgba(0,0,0,0.06), 0 8px 24px rgba(0,0,0,0.08)'
      }
    }
  },
  plugins: []
}
