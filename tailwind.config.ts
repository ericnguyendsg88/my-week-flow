import type { Config } from "tailwindcss";

export default {
  darkMode: ["class"],
  content: ["./pages/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}", "./app/**/*.{ts,tsx}", "./src/**/*.{ts,tsx}"],
  prefix: "",
  theme: {
    container: {
      center: true,
      padding: "2rem",
      screens: {
        "2xl": "1400px",
      },
    },
    extend: {
      fontFamily: {
        sans: ['"Inter"', "system-ui", "sans-serif"],
      },
      fontSize: {
        "section-label": ["9px", { lineHeight: "1.4", fontWeight: 500, letterSpacing: "0.07em" }],
        "event-title": ["12px", { lineHeight: "1.25", fontWeight: 500 }],
        "event-meta": ["10px", { lineHeight: "1.4", fontWeight: 400 }],
        "tag-pill": ["9px", { lineHeight: "1.2", fontWeight: 500 }],
        "body": ["13px", { lineHeight: "1.4", fontWeight: 400 }],
        "body-lg": ["14px", { lineHeight: "1.4", fontWeight: 400 }],
        "app-name": ["18px", { lineHeight: "1.3", fontWeight: 500 }],
        "day-title": ["14px", { lineHeight: "1.3", fontWeight: 500 }],
        "day-subtitle": ["11px", { lineHeight: "1.3", fontWeight: 500 }],
        "gap": ["10px", { lineHeight: "1.4", fontWeight: 400 }],
      },
      colors: {
        /* Page & Panel backgrounds */
        "bg-page": "#F4F4F6",
        "bg-panel": "#FFFFFF",
        "bg-secondary": "#FAFAFA",

        /* Primary Purple Ramp */
        "purple": {
          pale: "#EEEDFE",
          light: "#CECBF6",
          mid: "#AFA9EC",
          strong: "#534AB7",
          dark: "#3C3489",
          darkest: "#26215C",
        },

        /* Teal Ramp (deepwork/success) */
        "teal": {
          pale: "#E1F5EE",
          mid: "#9FE1CB",
          strong: "#0F6E56",
          text: "#085041",
        },

        /* Blue Ramp (study) */
        "blue": {
          pale: "#E6F1FB",
          mid: "#B5D4F4",
          strong: "#185FA5",
          text: "#0C447C",
        },

        /* Pink Ramp (personal) */
        "pink": {
          pale: "#FBEAF0",
          mid: "#F4C0D1",
          strong: "#993556",
          text: "#72243E",
        },

        /* Amber Ramp (social) */
        "amber": {
          pale: "#FAEEDA",
          mid: "#FAC775",
          strong: "#854F0B",
          text: "#633806",
        },

        /* Coral Ramp (work calls/alerts) */
        "coral": {
          pale: "#FAECE7",
          mid: "#F5C4B3",
          strong: "#993C1D",
          text: "#712B13",
        },

        /* Green Ramp (completed) */
        "green": {
          pale: "#EAF3DE",
          mid: "#C0DD97",
          strong: "#3B6D11",
          text: "#27500A",
          dark: "#173404",
        },

        /* Gray Ramp (skipped/neutral) */
        "gray": {
          pale: "#F1EFE8",
          mid: "#D3D1C7",
          strong: "#5F5E5A",
          text: "#444441",
          skipped: "#2C2C2A",
        },

        /* Gap indicator */
        "gap": {
          bg: "#F1EFE8",
          border: "#D3D1C7",
          text: "#5F5E5A",
          dot: "#B4B2A9",
        },

        /* Weekend tints */
        "weekend": {
          bg: "#E1F5EE",
          border: "#5DCAA5",
          text: "#085041",
        },
        "sunday": {
          bg: "#FAEEDA",
          border: "#EF9F27",
          text: "#633806",
        },

        /* Now marker */
        "now": {
          DEFAULT: "#534AB7",
          halo: "#CECBF6",
          line: "#AFA9EC",
          pill: "#EEEDFE",
        },

        border: "hsl(var(--border))",
        input: "hsl(var(--input))",
        ring: "hsl(var(--ring))",
        background: "hsl(var(--background))",
        foreground: "hsl(var(--foreground))",
        primary: {
          DEFAULT: "hsl(var(--primary))",
          foreground: "hsl(var(--primary-foreground))",
          glow: "hsl(var(--primary-glow))",
        },
        secondary: {
          DEFAULT: "hsl(var(--secondary))",
          foreground: "hsl(var(--secondary-foreground))",
        },
        destructive: {
          DEFAULT: "hsl(var(--destructive))",
          foreground: "hsl(var(--destructive-foreground))",
        },
        muted: {
          DEFAULT: "hsl(var(--muted))",
          foreground: "hsl(var(--muted-foreground))",
        },
        accent: {
          DEFAULT: "hsl(var(--accent))",
          foreground: "hsl(var(--accent-foreground))",
        },
        popover: {
          DEFAULT: "hsl(var(--popover))",
          foreground: "hsl(var(--popover-foreground))",
        },
        card: {
          DEFAULT: "hsl(var(--card))",
          foreground: "hsl(var(--card-foreground))",
        },
        sidebar: {
          DEFAULT: "hsl(var(--sidebar-background))",
          foreground: "hsl(var(--sidebar-foreground))",
          primary: "hsl(var(--sidebar-primary))",
          "primary-foreground": "hsl(var(--sidebar-primary-foreground))",
          accent: "hsl(var(--sidebar-accent))",
          "accent-foreground": "hsl(var(--sidebar-accent-foreground))",
          border: "hsl(var(--sidebar-border))",
          ring: "hsl(var(--sidebar-ring))",
        },
        tag: {
          work: { DEFAULT: "#AFA9EC", text: "#3C3489", sub: "#534AB7" },
          deepwork: { DEFAULT: "#9FE1CB", text: "#085041", sub: "#0F6E56" },
          study: { DEFAULT: "#B5D4F4", text: "#0C447C", sub: "#185FA5" },
          personal: { DEFAULT: "#F4C0D1", text: "#72243E", sub: "#993556" },
          social: { DEFAULT: "#FAC775", text: "#633806", sub: "#854F0B" },
          health: { DEFAULT: "#C0DD97", text: "#27500A", sub: "#3B6D11" },
          errand: { DEFAULT: "#F5C4B3", text: "#712B13", sub: "#993C1D" },
          neutral: { DEFAULT: "#D3D1C7", text: "#444441", sub: "#5F5E5A" },
          completed: { bg: "#EAF3DE", sub: "#C0DD97", text: "#27500A", badge: "#3B6D11", dark: "#173404" },
          skipped: { bg: "#D3D1C7", badge: "#5F5E5A", text: "#444441", strikethrough: "#2C2C2A" },
          tentative: { bg: "#EEEDFE", border: "#534AB7", badge: "#534AB7", pill: "#CECBF6", pillText: "#3C3489" },
        },
        chip: {
          thought: { bg: "#EEEDFE", text: "#3C3489" },
          link: { bg: "#E6F1FB", text: "#0C447C" },
          file: { bg: "#EAF3DE", text: "#27500A" },
          ref: { bg: "#FAEEDA", text: "#633806" },
          task: { bg: "#FBEAF0", text: "#72243E" },
          meal: { bg: "#FAEEDA", text: "#EF9F27" },
        },
        "text-tertiary": "#888580",
      },
      borderRadius: {
        lg: "var(--radius)",
        md: "calc(var(--radius) - 2px)",
        sm: "calc(var(--radius) - 4px)",
        "4xl": "2rem",
        bubble: "1.75rem",
        "card": "12px",
        "pill": "20px",
        "chip": "20px",
        "backpack": "10px",
        "icon-box": "4px",
        "badge": "50%",
        "gap": "8px",
        "btn": "14px",
      },
      spacing: {
        "panel": "24px",
        "panel-gap": "16px",
        "section": "16px",
        "section-lg": "24px",
      },
      boxShadow: {
        "panel": "0 1px 3px rgba(0,0,0,0.06)",
        "bubble": "0 4px 16px -6px rgba(80,70,180,0.14), 0 1px 4px -2px rgba(80,70,180,0.07)",
      },
      keyframes: {
        "accordion-down": {
          from: { height: "0" },
          to: { height: "var(--radix-accordion-content-height)" },
        },
        "accordion-up": {
          from: { height: "var(--radix-accordion-content-height)" },
          to: { height: "0" },
        },
        "fade-in": {
          "0%": { opacity: "0", transform: "translateY(6px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
      },
      animation: {
        "accordion-down": "accordion-down 0.2s ease-out",
        "accordion-up": "accordion-up 0.2s ease-out",
        "fade-in": "fade-in 0.3s ease-out",
      },
    },
  },
  plugins: [require("tailwindcss-animate")],
} satisfies Config;