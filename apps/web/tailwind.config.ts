import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}", "./lib/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        paper: {
          base: "#F4ECDC",
          surface: "#FFFAF0",
          soft: "#FBF6E9",
          sunk: "#EFE5CD",
        },
        ink: {
          900: "#2E2A24",
          700: "#5A5247",
          500: "#8B8170",
          300: "#A89C85",
          200: "#C9B998",
          100: "#E8DEC7",
        },
        student: {
          accent: "#D9926A",
          soft: "#FAE6D5",
          deep: "#8A4B2B",
        },
        teacher: {
          accent: "#5A6E85",
          soft: "#E1E9F2",
          deep: "#3A4A60",
        },
        feedback: {
          pen: "#3A6FB0",
          soft: "#E5EDF7",
        },
        status: {
          notStarted: "#A89C85",
          writing: "#C8924A",
          submitted: "#7A8FA6",
          feedbackDone: "#6B8C5A",
          error: "#B0533A",
        },
      },
    },
  },
  plugins: [],
};

export default config;
