import type { Config } from 'tailwindcss';

export default {
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        // Brand — Deep Teal scale
        // Contrast notes: brand-700 on white = 7.8:1 (AAA), brand-600 on white = 4.7:1 (AA)
        brand: {
          50:  '#E6F4F4',
          100: '#CCE9E9',
          200: '#99D4D4',
          300: '#4DB8B9',
          400: '#009091', // Icon/decoration only on light bg (3.6:1 on white — not for text)
          600: '#007B7C', // Hover states — 4.7:1 on white (AA)
          700: '#005A5B', // Primary brand — 7.8:1 on white (AAA)
          800: '#003D3E', // Dark sections/footer — white on this = 12:1 (AAA)
          900: '#002627', // Deepest teal
        },
        // Coral — CTA/button accent
        // Contrast notes: white on coral-500 = 3.4:1 (large/bold text only), coral-600 = 4.2:1
        coral: {
          50:  '#FFF0ED',
          100: '#FFD9D3',
          400: '#F0724F',
          500: '#E8604C', // Primary CTA — use with white bold text only (buttons, ≥14px bold)
          600: '#D04F3C', // Hover / small-text situations — 4.2:1 on white
          700: '#B83D2B', // Dark coral for accessibility-critical small text
        },
      },
    },
  },
} satisfies Config;