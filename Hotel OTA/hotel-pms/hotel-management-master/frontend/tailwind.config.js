/**
 * Hotel PMS Frontend Tailwind Config
 *
 * Uses REZ Brand Tokens for consistent styling across all apps.
 */

/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        // Primary Mustard
        primary: {
          50: '#FFF9E6',
          100: '#FFF3CC',
          200: '#FFE799',
          300: '#FFDB66',
          400: '#FFD433',
          500: '#ffcd57',
          600: '#ffcd57',
          700: '#E6B84E',
          800: '#CCA345',
          900: '#B38F3C',
        },
        // Secondary Nile Blue
        secondary: {
          50: '#E8EEF3',
          100: '#D1DDE7',
          200: '#A3BBCF',
          300: '#7599B7',
          400: '#47779F',
          500: '#2A5577',
          600: '#1a3a52',
          700: '#163148',
          800: '#12283D',
          900: '#0E1F33',
        },
        // Brand shortcuts
        mustard: '#ffcd57',
        nile: '#1a3a52',
        nileBlue: '#1a3a52',
        linen: '#faf1e0',
        peach: '#ffd7b5',
        lavender: '#dfebf7',
        gold: '#ffcd57',
      },
    },
  },
  plugins: [],
}
