import type { Config } from 'tailwindcss';

export default {
  content: [
    './index.html',
    './src/**/*.{js,ts,jsx,tsx}',
  ],
  theme: {
    extend: {
      colors: {
        sar: {
          // SAR Official Deep Navy
          navy: {
            DEFAULT: '#002B49',
            50: '#EDF4F9',
            100: '#D7E7F2',
            200: '#B0CFE5',
            300: '#7FAED3',
            400: '#3D7CAE',
            500: '#002B49',
            600: '#002641',
            700: '#002037',
            800: '#001A2C',
            900: '#001321',
            950: '#000D16',
          },
          // SAR Official Emerald Green
          green: {
            DEFAULT: '#008269',
            50: '#E8F8F4',
            100: '#C3EFE5',
            200: '#8EDECB',
            300: '#4EC7AC',
            400: '#1FAF8E',
            500: '#008269',
            600: '#006B56',
            700: '#005443',
            800: '#003F33',
            900: '#002C23',
            950: '#001B16',
          },
          // SAR Official Gold / Desert Sand Accent
          gold: {
            DEFAULT: '#D0A85C',
            50: '#FAF5EB',
            100: '#F5EACF',
            200: '#EBD5A0',
            300: '#E0BD70',
            400: '#D0A85C',
            500: '#B88F43',
            600: '#9B7433',
            700: '#7E5B27',
            800: '#62441E',
            900: '#4A3216',
          },
          // SAR Alert & Warning Red
          red: {
            DEFAULT: '#C8102E',
            50: '#FEF3F2',
            100: '#FEE4E2',
            200: '#FECDCA',
            300: '#FDA29B',
            400: '#F04438',
            500: '#C8102E',
            600: '#A30D25',
            700: '#800A1D',
            800: '#5F0715',
            900: '#40040E',
          },
          // Background and Surface Neutral Tones
          surface: '#F4F7F9',
          card: '#FFFFFF',
          border: '#E2E8F0',
          muted: '#64748B',
        },
      },
      fontFamily: {
        sans: ['Tajawal', 'IBM Plex Sans Arabic', '-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'Roboto', 'sans-serif'],
        sar: ['Tajawal', 'IBM Plex Sans Arabic', 'sans-serif'],
        display: ['Tajawal', 'sans-serif'],
        mono: ['SFMono-Regular', 'Menlo', 'Monaco', 'Consolas', 'Courier New', 'monospace'],
      },
      boxShadow: {
        'sar-card': '0 4px 20px -2px rgba(0, 43, 73, 0.08), 0 2px 6px -1px rgba(0, 43, 73, 0.04)',
        'sar-hover': '0 10px 25px -3px rgba(0, 130, 105, 0.15), 0 4px 10px -2px rgba(0, 130, 105, 0.06)',
        'sar-modal': '0 25px 50px -12px rgba(0, 43, 73, 0.25)',
      },
      borderRadius: {
        '2xl': '1rem',
        '3xl': '1.5rem',
      }
    },
  },
  plugins: [],
} satisfies Config;
