import type { Config } from 'tailwindcss';

const config: Config = {
  darkMode: ['class'],
  content: ['./index.html', './src/**/*.{vue,ts,tsx}'],
  theme: {
    container: {
      center: true,
      padding: '1.5rem',
      screens: {
        '2xl': '1400px',
      },
    },
    extend: {
      colors: {
        preto: 'var(--arcco-preto)',
        carvao: {
          DEFAULT: 'var(--arcco-carvao)',
          claro: 'var(--arcco-carvao-claro)',
        },
        dourado: {
          DEFAULT: 'var(--arcco-dourado)',
          hover: 'var(--arcco-dourado-hover)',
          claro: 'var(--arcco-dourado-claro)',
        },
        marfim: 'var(--arcco-marfim)',
        superficie: 'var(--arcco-superficie)',
        branco: 'var(--arcco-branco)',
        texto: {
          DEFAULT: 'var(--arcco-texto)',
          secundario: 'var(--arcco-texto-secundario)',
        },
        borda: 'var(--arcco-borda)',
        sucesso: 'var(--arcco-sucesso)',
        alerta: 'var(--arcco-alerta)',
        erro: 'var(--arcco-erro)',
        info: 'var(--arcco-info)',
        // shadcn-vue semantic aliases mapped to ARCCO tokens
        border: 'var(--arcco-borda)',
        input: 'var(--arcco-borda)',
        ring: 'var(--arcco-dourado)',
        background: 'var(--arcco-superficie)',
        foreground: 'var(--arcco-texto)',
        primary: {
          DEFAULT: 'var(--arcco-dourado)',
          foreground: 'var(--arcco-preto)',
        },
        secondary: {
          DEFAULT: 'var(--arcco-marfim)',
          foreground: 'var(--arcco-texto)',
        },
        muted: {
          DEFAULT: 'var(--arcco-marfim)',
          foreground: 'var(--arcco-texto-secundario)',
        },
        accent: {
          DEFAULT: 'var(--arcco-marfim)',
          foreground: 'var(--arcco-texto)',
        },
        destructive: {
          DEFAULT: 'var(--arcco-erro)',
          foreground: 'var(--arcco-branco)',
        },
        popover: {
          DEFAULT: 'var(--arcco-branco)',
          foreground: 'var(--arcco-texto)',
        },
        card: {
          DEFAULT: 'var(--arcco-branco)',
          foreground: 'var(--arcco-texto)',
        },
      },
      fontFamily: {
        sans: ['Manrope', 'ui-sans-serif', 'system-ui', 'sans-serif'],
        serif: ['Manrope', 'ui-sans-serif', 'system-ui', 'sans-serif'],
      },
      borderRadius: {
        lg: '8px',
        md: '6px',
        sm: '4px',
      },
      boxShadow: {
        /* Só overlays flutuantes (dialog, menu, popover) */
        flutuante: 'var(--arcco-sombra-overlay)',
      },
      keyframes: {
        'accordion-down': {
          from: { height: '0' },
          to: { height: 'var(--radix-accordion-content-height)' },
        },
        'accordion-up': {
          from: { height: 'var(--radix-accordion-content-height)' },
          to: { height: '0' },
        },
        'fade-in': {
          from: { opacity: '0' },
          to: { opacity: '1' },
        },
      },
      animation: {
        'accordion-down': 'accordion-down 0.2s ease-out',
        'accordion-up': 'accordion-up 0.2s ease-out',
        'fade-in': 'fade-in 0.2s ease-out',
      },
    },
  },
  plugins: [],
};

export default config;
