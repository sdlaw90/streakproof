import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        bg: "#0e1116",
        panel: "#171c24",
        panel2: "#1e2530",
        line: "#2a323f",
        ink: "#e8edf4",
        muted: "#93a1b5",
        faint: "#6b7889",
        accent: "#4fd08a",
        accent2: "#3aa6ff",
        hot: "#ff7a59",
        gold: "#ffcf5c",
      },
    },
  },
  plugins: [],
};
export default config;
