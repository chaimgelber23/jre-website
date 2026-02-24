/**
 * Event theme colors based on event type.
 * Default = standard orange brand colors.
 * "womens" = dusty rose for women's events.
 */

export interface EventTheme {
  /** Primary accent color (buttons, icons, highlights) */
  primary: string;
  /** Darker shade for hover states */
  primaryHover: string;
  /** Dark background (hero, footer) */
  darkBg: string;
  /** Even darker background (gradient end) */
  darkerBg: string;
  /** Primary as RGB values for rgba() usage */
  primaryRgb: string;
  /** Confetti celebration colors */
  confettiColors: string[];
}

const defaultTheme: EventTheme = {
  primary: "#EF8046",
  primaryHover: "#d96a2f",
  darkBg: "#2d3748",
  darkerBg: "#1a202c",
  primaryRgb: "239, 128, 70",
  confettiColors: ["#EF8046", "#f59e0b", "#10b981"],
};

const womensTheme: EventTheme = {
  primary: "#B5838D",
  primaryHover: "#9B6B75",
  darkBg: "#5A3D42",
  darkerBg: "#3D2A2E",
  primaryRgb: "181, 131, 141",
  confettiColors: ["#B5838D", "#D4A5AD", "#9B6B75"],
};

export function getEventTheme(themeColor: string | null | undefined): EventTheme {
  switch (themeColor) {
    case "womens":
      return womensTheme;
    default:
      return defaultTheme;
  }
}
