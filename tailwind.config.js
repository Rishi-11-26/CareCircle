/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        forest: {
          DEFAULT: '#25483D',
          dark: '#1C372E',
          light: '#315D4F',
          surface: '#EBF1EE',
        },
        sage: {
          DEFAULT: '#A5B59A',
          light: '#C4D1BC',
          dark: '#7D8E73',
          surface: '#F1F4EE',
        },
        terracotta: {
          DEFAULT: '#C9795B',
          light: '#E5A086',
          dark: '#A65A3E',
          surface: '#FDF4F0',
        },
        ivory: {
          DEFAULT: '#F7F5EF',
          warm: '#FBF9F5',
        },
        stone: {
          DEFAULT: '#E7E4DA',
          light: '#F3F1EC',
          dark: '#BDB9AC',
        },
        cream: {
          DEFAULT: '#EFEBE0',
          light: '#F8F6F0',
        },
        charcoal: {
          DEFAULT: '#292D29',
          light: '#4E534E',
          muted: '#717770',
        },
      },
      fontFamily: {
        serif: ['"DM Serif Display"', 'Georgia', 'serif'],
        sans: ['"DM Sans"', 'system-ui', '-apple-system', 'sans-serif'],
      },
      boxShadow: {
        'warm-sm': '0 1px 2px 0 rgba(41, 45, 41, 0.05)',
        'warm': '0 4px 12px 0 rgba(41, 45, 41, 0.07)',
        'warm-lg': '0 10px 25px -3px rgba(41, 45, 41, 0.09), 0 4px 6px -2px rgba(41, 45, 41, 0.05)',
      },
      borderRadius: {
        'warm': '1rem',
      }
    },
  },
  plugins: [],
}
