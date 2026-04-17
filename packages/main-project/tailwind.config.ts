import type { Config } from 'tailwindcss';

const config: Config = {
  content: [
    './src/**/*.{js,ts,jsx,tsx,md,mdx}',
    './app/**/*.{js,ts,jsx,tsx,md,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        primary: {
          DEFAULT: '#1e3a5f',
          50: '#f0f5ff',
          100: '#e0ebff',
          200: '#c7d7ff',
          300: '#a3c0ff',
          400: '#7aa3ff',
          500: '#5b8bff',
          600: '#3d6eff',
          700: '#1e3a5f',
          800: '#162d4d',
          900: '#0f1f35',
        },
        accent: {
          gold: '#d4a017',
        },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
        chinese: ['Noto Sans SC', 'system-ui', 'sans-serif'],
      },
      borderRadius: {
        DEFAULT: '8px',
        card: '12px',
        module: '16px',
      },
    },
  },
  plugins: [],
};

export default config;