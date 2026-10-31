/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        ink: "#09090F",
        midnight: "#171326",
        violet: "#8B5CF6",
        antique: "#D6AE70",
        candle: "#F4EBDD",
        ember: "#A33B46",
      },
      fontFamily: {
        display: ["Playfair Display", "serif"],
        sans: ["DM Sans", "sans-serif"],
      },
    },
  },
  plugins: [],
};
