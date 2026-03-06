/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
      "./index.html",
      "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
      extend: {
          colors: {
              vitrus: {
                  primary: 'var(--text-primary)',
                  secondary: 'var(--text-secondary)',
                  success: 'var(--success-bg)',
                  successText: 'var(--success-text)',
                  active: 'var(--dark-active)',
                  blue: 'var(--color-blue)',
              },
              background: {
                  base: 'var(--portal-bg)'
              }
          },
          backgroundImage: {
              'gradient-highlight': 'var(--gradient-highlight)',
              'gradient-success': 'var(--gradient-success)',
              'card-surface': 'var(--card-bg)',
          },
          borderRadius: {
              'card': 'var(--radius-card)',
              'inner': 'var(--radius-inner)',
          },
          boxShadow: {
              'card': 'var(--shadow-card)',
          }
      },
  },
  plugins: [],
}
