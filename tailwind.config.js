/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        navy: {
          900: "#070d1e",
          850: "#0b132b",
          800: "#111c38",
          700: "#1c2541",
          600: "#273859",
        },
        veriblue: {
          500: "#2563eb",
          600: "#1d4ed8",
          400: "#38bdf8",
          300: "#7dd3fc",
        },
        vericyan: "#06b6d4",
        verigreen: "#10b981",
        verired: "#ef4444",
        veriamber: "#f59e0b",
      },
    },
  },
  plugins: [],
};
