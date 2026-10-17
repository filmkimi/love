import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./app/**/*.{js,ts,jsx,tsx,mdx}", "./components/**/*.{js,ts,jsx,tsx,mdx}"],
  theme: {
    extend: {
      colors: {
        ink: "#332b38",
        plum: "#78546f",
        blush: "#f7e8eb",
        cream: "#fcf8f2",
        sage: "#8fa88e"
      },
      fontFamily: {
        sans: ["var(--font-body)", "sans-serif"],
        display: ["var(--font-display)", "serif"]
      },
      boxShadow: {
        soft: "0 18px 55px rgba(88, 61, 76, 0.09)"
      }
    }
  },
  plugins: []
};

export default config;
