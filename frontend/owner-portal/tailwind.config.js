/** @type {import('tailwindcss').Config} */
export default {
    content: [
        "./index.html",
        "./src/**/*.{js,ts,jsx,tsx}",
    ],
    theme: {
        extend: {
            colors: {
                primary: "#2563EB",
                secondary: "#1E40AF",
                accent: "#F59E0B",
                background: "#F3F4F6",
                surface: "#FFFFFF",
            },
        },
    },
    plugins: [],
}
