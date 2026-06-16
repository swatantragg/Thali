/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: 'class',
  content: ['./src/**/*.{js,ts,jsx,tsx,mdx}'],
  theme: {
    extend: {
      fontFamily: {
        sans:  ['Poppins', 'ui-sans-serif', 'system-ui', 'sans-serif'],
        brand: ['"Stack Sans Notch"', 'Poppins', 'ui-sans-serif', 'sans-serif'],
      },
      colors: {
        // Brand palette anchors
        cream:  '#EFE3C2',
        sage:   '#85A947',
        fern:   '#3E7B27',
        forest: '#123524',

        // Semantic tokens — values switch by theme via CSS variables (see globals.css)
        app:     'var(--app)',
        surface: {
          DEFAULT: 'var(--surface)',
          2:       'var(--surface-2)',
        },
        line: 'var(--line)',
        ink: {
          DEFAULT: 'var(--ink)',
          muted:   'var(--muted)',
        },
        primary: {
          DEFAULT: 'var(--primary)',
          hover:   'var(--primary-hover)',
          fg:      'var(--primary-fg)',
        },
        accent: {
          DEFAULT: 'var(--accent)',
          soft:    'var(--accent-soft)',
        },
        danger: 'var(--danger)',
      },
    },
  },
  plugins: [],
};
