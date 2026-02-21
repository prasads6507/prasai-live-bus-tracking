/** @type {import('tailwindcss').Config} */
module.exports = {
    content: [
        "./index.html",
        "./src/**/*.{js,ts,jsx,tsx}",
    ],
    theme: {
        extend: {
            colors: {
                primary: {
                    50: '#eff6ff',
                    100: '#dbeafe',
                    500: '#3b82f6',
                    600: '#2563eb',
                    700: '#1d4ed8',
                    900: '#1e3a8a',
                },
                dashboard: {
                    bg: '#F6F8FB',
                    surface: '#FFFFFF',
                    border: '#E9EEF5',
                    text: '#1F2A37',
                    secondary: '#6B7280',
                    muted: '#A8B3C2',
                    primary: '#2EA7FF',
                    success: '#49D17D',
                    warning: '#FF8A3D'
                }
            },
            boxShadow: {
                soft: '0 10px 40px -10px rgba(0,0,0,0.08)',
            }
        },
    },
    plugins: [],
}
