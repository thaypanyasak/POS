/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        primary: {
          DEFAULT: 'rgb(var(--primary) / <alpha-value>)',
          hover: 'rgb(var(--primary-hover) / <alpha-value>)',
          light: 'rgb(var(--primary-light) / <alpha-value>)',
          border: 'rgb(var(--primary-border) / <alpha-value>)',
          foreground: 'rgb(var(--primary-foreground) / <alpha-value>)',
          deep: 'rgb(var(--primary-deep) / <alpha-value>)',
        },
        brand: {
          logo: 'rgb(var(--brand-logo) / <alpha-value>)',
        },
        'unit-btn': {
          DEFAULT: 'rgb(var(--btn-unit-bg) / <alpha-value>)',
          border: 'rgb(var(--btn-unit-border) / <alpha-value>)',
          text: 'rgb(var(--btn-unit-text) / <alpha-value>)',
          hover: 'rgb(var(--btn-unit-hover) / <alpha-value>)',
        }
      },
    },
  },
  plugins: [],
};

