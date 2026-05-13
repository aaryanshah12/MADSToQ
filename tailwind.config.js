/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      fontFamily: {
        display: ['var(--font-rajdhani)', 'sans-serif'],
        mono:    ['var(--font-share-tech-mono)', 'monospace'],
        body:    ['var(--font-exo2)', 'sans-serif'],
      },
      colors: {
        bg:      'var(--color-bg)',
        panel:   'var(--color-panel)',
        border:  'var(--color-border)',
        owner:   'var(--color-owner)',
        inputer: 'var(--color-inputer)',
        chemist: 'var(--color-chemist)',
        muted:   'var(--color-muted)',
        surface: 'var(--color-surface)',
        text:    'var(--color-text)',
      },
      animation: {
        'fade-up':    'fadeUp 0.5s ease both',
        'fade-down':  'fadeDown 0.5s ease both',
        'pulse-slow': 'pulse 3s infinite',
      },
      keyframes: {
        fadeUp:   { from: { opacity: '0', transform: 'translateY(12px)'  }, to: { opacity: '1', transform: 'translateY(0)' } },
        fadeDown: { from: { opacity: '0', transform: 'translateY(-12px)' }, to: { opacity: '1', transform: 'translateY(0)' } },
      },
    },
  },
  plugins: [],
}
