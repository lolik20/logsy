import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ["var(--font-inter)", "system-ui", "-apple-system", "sans-serif"],
      },
      colors: {
        // Бело-голубая палитра с фирменным индиго-акцентом timeweb.cloud
        brand: {
          DEFAULT: "#4f5fe6",
          dark: "#3d4cd4",
          light: "#7480f0",
          50: "#eef0fe",
          100: "#e0e4fc",
          200: "#c4cbf9",
          600: "#4f5fe6",
          700: "#3d4cd4",
        },
      },
      boxShadow: {
        card: "0 1px 2px rgba(31, 41, 92, 0.04), 0 10px 30px rgba(31, 41, 92, 0.07)",
      },
    },
  },
  plugins: [],
};

export default config;
