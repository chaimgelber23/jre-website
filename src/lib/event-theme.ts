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

// Warm sunrise theme — pairs with sunset/sky/orange-gold flyers.
// Uses a cream hero bg (triggers the light-hero code path) and a bold pumpkin primary.
const sunriseTheme: EventTheme = {
  primary: "#E8743A", // Pumpkin (matches flyer CTA buttons)
  primaryHover: "#C85F28",
  darkBg: "#fafafa", // Warm near-white — activates isLightHero mode
  darkerBg: "#F5E4CE", // Soft peach gradient end
  primaryRgb: "232, 116, 58",
  confettiColors: ["#E8743A", "#F5B970", "#E8A05C", "#C5A158", "#3E5A6B"],
};

export function getEventTheme(themeColor: string | null | undefined): EventTheme {
  switch (themeColor) {
    case "womens":
      return womensTheme;
    case "black":
      return blackOrangeTheme;
    case "sunrise":
      return sunriseTheme;
    default:
      return defaultTheme;
  }
}
