/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './pages/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
    './app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        gold: {
          DEFAULT: '#FFD700',
          50:  'rgba(255, 215, 0, 0.05)',
          100: 'rgba(255, 215, 0, 0.10)',
          200: 'rgba(255, 215, 0, 0.20)',
          300: 'rgba(255, 215, 0, 0.30)',
          400: 'rgba(255, 215, 0, 0.40)',
          500: '#FFD700',
        },
        cyan: {
          DEFAULT: '#00FFFF',
          50:  'rgba(0, 255, 255, 0.05)',
          100: 'rgba(0, 255, 255, 0.10)',
          200: 'rgba(0, 255, 255, 0.20)',
          300: 'rgba(0, 255, 255, 0.30)',
          400: 'rgba(0, 255, 255, 0.40)',
          500: '#00FFFF',
        },
        sovereign: {
          bg:  '#080B0F',
          bg2: '#0D1117',
          bg3: '#111827',
          text: '#E8EAF0',
          muted: '#6B7280',
        },
      },
      fontFamily: {
        sans: ['Space Grotesk', 'system-ui', 'sans-serif'],
        mono: ['JetBrains Mono', 'Fira Code', 'Consolas', 'monospace'],
      },
      animation: {
        'spin-slow':    'spin 8s linear infinite',
        'float':        'float 3s ease-in-out infinite',
        'pulse-gold':   'pulseGold 2s ease-in-out infinite',
        'scan':         'scan 3s ease-in-out infinite',
        'flicker':      'flicker 4s linear infinite',
      },
      keyframes: {
        float: {
          '0%, 100%': { transform: 'translateY(0)' },
          '50%':      { transform: 'translateY(-6px)' },
        },
        pulseGold: {
          '0%, 100%': { opacity: '1' },
          '50%':      { opacity: '0.4' },
        },
        scan: {
          '0%':   { transform: 'translateY(-100%)' },
          '100%': { transform: 'translateY(100%)' },
        },
        flicker: {
          '0%, 100%': { opacity: '1' },
          '41%, 43%': { opacity: '0.8' },
          '75%, 76%': { opacity: '0.9' },
          '77%, 78%': { opacity: '0.6' },
          '79%':      { opacity: '1' },
        },
      },
      backdropBlur: {
        xs: '2px',
      },
      boxShadow: {
        'glow-gold': '0 0 20px rgba(255, 215, 0, 0.15)',
        'glow-cyan': '0 0 20px rgba(0, 255, 255, 0.15)',
        'glow-gold-lg': '0 0 40px rgba(255, 215, 0, 0.25)',
        'glow-cyan-lg':  '0 0 40px rgba(0, 255, 255, 0.25)',
      },
    },
  },
  plugins: [],
};
