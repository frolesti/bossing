/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        // Notebook paper and kraft
        surface: {
          50: '#fbf7ed',
          100: '#f2ecdc',
          200: '#e8dfcb',
          300: '#d6cbb7',
          400: '#b9ad96',
          500: '#81785f',
        },
        // Market-bag green ink
        brand: {
          50: '#f0f3e8',
          100: '#e5ecd9',
          200: '#cbd8bb',
          300: '#a7bc98',
          400: '#789475',
          500: '#527456',
          600: '#294c3b',
          700: '#203d2f',
        },
        // Text
        ink: {
          DEFAULT: '#292e25',
          secondary: '#605b4e',
          muted: '#766f60',
        },
        // Semantic
        success: {
          50: '#f0fdf4',
          500: '#22c55e',
          600: '#16a34a',
          700: '#15803d',
        },
        danger: {
          50: '#fef2f2',
          400: '#f87171',
          500: '#ef4444',
          600: '#dc2626',
        },
        warn: {
          50: '#fffbeb',
          100: '#fef3c7',
          500: '#f59e0b',
          600: '#d97706',
        },
      },
      fontFamily: {
        sans: ['"Trebuchet MS"', 'Arial', 'sans-serif'],
        heading: ['Georgia', '"Times New Roman"', 'serif'],
      },
      boxShadow: {
        'card': '0 1px 3px rgba(0,0,0,0.06), 0 1px 2px rgba(0,0,0,0.04)',
        'card-hover': '0 4px 12px rgba(0,0,0,0.08), 0 2px 4px rgba(0,0,0,0.04)',
        'float': '0 8px 24px rgba(0,0,0,0.1)',
      },
    },
  },
  plugins: [],
};
