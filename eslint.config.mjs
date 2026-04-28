import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
  ]),
  // Campaign pages: no decorative emoji-like icons (hearts, flames, trophies, sparkles, etc.).
  // Functional UI icons (Search, Share2, Copy, Check, ArrowLeft, MessageCircle, Mail, Users) are allowed.
  // Bumping into this rule? Don't add the icon — write text instead.
  {
    files: ["src/app/campaign/**/*.{ts,tsx}"],
    rules: {
      "no-restricted-imports": ["error", {
        paths: [{
          name: "lucide-react",
          importNames: [
            "Heart", "Flame", "Trophy", "Sparkles", "Star", "Award",
            "PartyPopper", "Gift", "Crown", "Medal", "Zap",
          ],
          message: "Decorative emoji-like icons are not allowed on campaign pages. Use text instead.",
        }],
      }],
      "no-restricted-syntax": ["error", {
        selector: "Literal[value=/[\\u{1F300}-\\u{1FAFF}\\u{2600}-\\u{27BF}\\u{2700}-\\u{27BF}]/u]",
        message: "Emoji characters are not allowed on campaign pages.",
      }, {
        selector: "JSXText[value=/[\\u{1F300}-\\u{1FAFF}\\u{2600}-\\u{27BF}\\u{2700}-\\u{27BF}]/u]",
        message: "Emoji characters are not allowed on campaign pages.",
      }, {
        selector: "TemplateElement[value.raw=/[\\u{1F300}-\\u{1FAFF}\\u{2600}-\\u{27BF}\\u{2700}-\\u{27BF}]/u]",
        message: "Emoji characters are not allowed on campaign pages.",
      }],
    },
  },
]);

export default eslintConfig;
