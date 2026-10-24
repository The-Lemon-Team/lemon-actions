import type { Config } from 'tailwindcss';

/**
 * "Lemon Seasons" theme: tokens from DESIGN.md merged with the
 * tailwind.config block of the code.html prototype.
 */
/**
 * Color tokens are CSS variables (RGB triplets) defined per theme in src/styles.css
 * (`:root` = Atom "One Light", `.dark` = Atom "One Dark"), so utilities like
 * `bg-primary-container/40` keep working in both themes.
 */
const COLOR_TOKENS = [
  'surface', 'surface-dim', 'surface-bright', 'surface-variant', 'surface-tint',
  'surface-container-lowest', 'surface-container-low', 'surface-container',
  'surface-container-high', 'surface-container-highest',
  'on-surface', 'on-surface-variant', 'inverse-surface', 'inverse-on-surface',
  'outline', 'outline-variant', 'background', 'on-background',
  'primary', 'on-primary', 'primary-container', 'on-primary-container', 'inverse-primary',
  'primary-fixed', 'primary-fixed-dim', 'on-primary-fixed', 'on-primary-fixed-variant',
  'secondary', 'on-secondary', 'secondary-container', 'on-secondary-container',
  'secondary-fixed', 'secondary-fixed-dim', 'on-secondary-fixed', 'on-secondary-fixed-variant',
  'tertiary', 'on-tertiary', 'tertiary-container', 'on-tertiary-container',
  'tertiary-fixed', 'tertiary-fixed-dim', 'on-tertiary-fixed', 'on-tertiary-fixed-variant',
  'error', 'on-error', 'error-container', 'on-error-container',
  'success', 'success-container', 'on-success-container',
  'warning', 'warning-container', 'on-warning-container',
];
const font = (family: string, size: string, lineHeight: string, fontWeight: string, letterSpacing?: string) =>
  [size, { lineHeight, fontWeight, ...(letterSpacing ? { letterSpacing } : {}) }] as [
    string,
    Record<string, string>,
  ];

const config: Config = {
  content: ['./src/**/*.{html,ts}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: Object.fromEntries(COLOR_TOKENS.map((t) => [t, `rgb(var(--c-${t}) / <alpha-value>)`])),
      borderRadius: {
        DEFAULT: '0.375rem',
        lg: '0.625rem',
        xl: '1rem',
        full: '9999px',
      },
      spacing: {
        'space-xs': '0.25rem',
        'space-sm': '0.5rem',
        'space-md': '1rem',
        'space-lg': '1.5rem',
        'space-xl': '2.5rem',
        gutter: '1.5rem',
        'gutter-mobile': '1rem',
        margin: '2rem',
        'margin-mobile': '1rem',
      },
      fontFamily: {
        'headline-xl': ['Nunito', 'system-ui', 'sans-serif'],
        'headline-xl-mobile': ['Nunito', 'system-ui', 'sans-serif'],
        'headline-lg': ['Nunito', 'system-ui', 'sans-serif'],
        'headline-lg-mobile': ['Nunito', 'system-ui', 'sans-serif'],
        'headline-md': ['Nunito', 'system-ui', 'sans-serif'],
        'headline-sm': ['Nunito', 'system-ui', 'sans-serif'],
        'body-lg': ['Nunito', 'system-ui', 'sans-serif'],
        'body-md': ['Nunito', 'system-ui', 'sans-serif'],
        'body-sm': ['Nunito', 'system-ui', 'sans-serif'],
        'label-ui': ['Nunito', 'system-ui', 'sans-serif'],
        'label-code-md': ['DM Mono', 'ui-monospace', 'monospace'],
        'label-code-sm': ['DM Mono', 'ui-monospace', 'monospace'],
      },
      fontSize: {
        'headline-xl': font('Hanken Grotesk', '40px', '48px', '700', '-0.02em'),
        'headline-xl-mobile': font('Hanken Grotesk', '32px', '40px', '700', '-0.015em'),
        'headline-lg': font('Hanken Grotesk', '30px', '38px', '600', '-0.015em'),
        'headline-lg-mobile': font('Hanken Grotesk', '24px', '32px', '600', '-0.01em'),
        'headline-md': font('Hanken Grotesk', '22px', '30px', '600', '-0.01em'),
        'headline-sm': font('Hanken Grotesk', '18px', '26px', '600'),
        'body-lg': font('Inter', '16px', '24px', '400'),
        'body-md': font('Inter', '14px', '20px', '400'),
        'body-sm': font('Inter', '12px', '18px', '400'),
        'label-ui': font('Inter', '12px', '16px', '600', '0.04em'),
        'label-code-md': font('JetBrains Mono', '13px', '18px', '500', '-0.01em'),
        'label-code-sm': font('JetBrains Mono', '11px', '16px', '500', '0.02em'),
      },
      boxShadow: {
        xs: '0 1px 2px rgba(30, 41, 59, 0.05)',
      },
    },
  },
  plugins: [],
};

export default config;
