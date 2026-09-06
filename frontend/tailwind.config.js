/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: 'class',
  content: [
    './src/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    container: {
      center: true,
      padding: '1rem',
    },
    extend: {
      colors: {
        background: { DEFAULT: 'var(--background)', secondary: 'var(--background-secondary)' },
        surface: { DEFAULT: 'var(--surface)', elevated: 'var(--surface-elevated)', glass: 'var(--surface-glass)' },
        primary: { DEFAULT: 'var(--primary)', foreground: 'var(--primary-foreground)', muted: 'var(--primary-muted)', glow: 'var(--primary-glow)' },
        accent: { DEFAULT: 'var(--accent)', foreground: 'var(--accent-foreground)', muted: 'var(--accent-muted)' },
        foreground: { DEFAULT: 'var(--foreground)', muted: 'var(--foreground-muted)', subtle: 'var(--foreground-subtle)' },
        card: { DEFAULT: 'var(--card)', foreground: 'var(--card-foreground)' },
        border: { DEFAULT: 'var(--border)', subtle: 'var(--border-subtle)' },
        destructive: { DEFAULT: 'var(--destructive)', muted: 'var(--destructive-muted)' },
        warning: { DEFAULT: 'var(--warning)', muted: 'var(--warning-muted)' },
        info: { DEFAULT: 'var(--info)', muted: 'var(--info-muted)' },
        success: { DEFAULT: 'var(--success)', muted: 'var(--success-muted)' },
      },
      borderRadius: {
        DEFAULT: 'var(--radius)',
        sm: 'var(--radius-sm)',
        lg: 'var(--radius-lg)',
        xl: '1.25rem',
        '2xl': '1.5rem',
      },
      fontFamily: {
        sans: ['var(--font-sans)', 'sans-serif'],
        display: ['var(--font-display)', 'serif'],
      },
      fontSize: {
        '2xs': ['0.625rem', { lineHeight: '0.875rem' }],
      },
      boxShadow: {
        'glass': '0 8px 32px rgba(0, 0, 0, 0.4), inset 0 1px 0 rgba(255,255,255,0.05)',
        'card': '0 4px 16px rgba(0, 0, 0, 0.3)',
        'primary': '0 4px 16px rgba(124, 58, 237, 0.3)',
        'accent': '0 4px 16px rgba(16, 185, 129, 0.3)',
      },
      backgroundImage: {
        'gradient-radial': 'radial-gradient(var(--tw-gradient-stops))',
        'gradient-chess': 'linear-gradient(135deg, #0F0F13 0%, #13101F 50%, #0F0F13 100%)',
      },
    },
  },
  plugins: [require('@tailwindcss/typography')],
};