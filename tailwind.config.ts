import type { Config } from 'tailwindcss';

export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        cream: '#fbf3e7',
        paper: '#fffaf1',
        blush: '#f7b7c7',
        roseDust: '#d88a9a',
        skySoft: '#a9cde8',
        ink: '#35291f',
        coffee: '#7a5639',
        chalk: '#385b58',
      },
      fontFamily: {
        sans: ['Poppins', 'Be Vietnam Pro', 'ui-sans-serif', 'system-ui', 'sans-serif'],
        hand: ['Mali', 'Be Vietnam Pro', 'cursive'],
        display: ['Saira Condensed', 'Be Vietnam Pro', 'Impact', 'sans-serif'],
      },
      boxShadow: {
        paper: '0 18px 45px rgba(84, 57, 35, 0.16)',
        glass: '0 20px 50px rgba(72, 48, 31, 0.14)',
        glow: '0 0 42px rgba(247, 183, 199, 0.36)',
      },
      backgroundImage: {
        grain:
          "radial-gradient(circle at 20% 20%, rgba(255,255,255,.45) 0 1px, transparent 1px), radial-gradient(circle at 80% 10%, rgba(70,45,26,.08) 0 1px, transparent 1px), radial-gradient(circle at 50% 80%, rgba(56,91,88,.08) 0 1px, transparent 1px)",
        paper:
          'linear-gradient(115deg, rgba(255,255,255,.74), rgba(255,246,229,.78)), radial-gradient(circle at top left, rgba(247,183,199,.24), transparent 35%), radial-gradient(circle at bottom right, rgba(169,205,232,.25), transparent 38%)',
      },
      screens: {
        xs: '420px',
        '3xl': '1800px',
      },
    },
  },
  plugins: [],
} satisfies Config;
