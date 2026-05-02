import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}", "./lib/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        paper: {
          base: "#F4ECDC",
        },
        student: {
          accent: "#D9926A",
        },
        teacher: {
          accent: "#5A6E85",
        },
        feedback: {
          pen: "#3A6FB0",
        },
      },
    },
  },
  plugins: [],
};

export default config;
