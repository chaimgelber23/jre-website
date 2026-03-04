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
  darkBg: "#18181b",
  darkerBg: "#09090b",
  primaryRgb: "239, 128, 70",
  confettiColors: ["#EF8046", "#f59e0b", "#10b981"],
};

const womensTheme: EventTheme = {
  primary: "#B5838D", // Rose pink accent
  primaryHover: "#9B6B75",
  darkBg: "#9B6B75", // Medium rose — clearly pink, readable with white text
  darkerBg: "#7D5560",
  primaryRgb: "181, 131, 141",
  confettiColors: ["#B5838D", "#D4A5AD", "#9B6B75"],
};

const blackOrangeTheme: EventTheme = {
  primary: "#EF8046",
  primaryHover: "#d96a2f",
  darkBg: "#000000",
  darkerBg: "#000000",
  primaryRgb: "239, 128, 70",
  confettiColors: ["#EF8046", "#F5A623", "#FFD700", "#FFA500"],
};

export function getEventTheme(themeColor: string | null | undefined): EventTheme {
  switch (themeColor) {
    case "womens":
      return womensTheme;
    case "black":
      return blackOrangeTheme;
    default:
      return defaultTheme;
  }
}
