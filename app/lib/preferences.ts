export type Theme = "system" | "light" | "dark";

const THEME_KEY = "quickkit.theme";

export function readTheme(): Theme {
  const saved = localStorage.getItem(THEME_KEY);
  return saved === "light" || saved === "dark" || saved === "system" ? saved : "system";
}

export function applyTheme(theme: Theme) {
  const dark = theme === "dark" || (theme === "system" && matchMedia("(prefers-color-scheme: dark)").matches);
  document.documentElement.dataset.theme = dark ? "dark" : "light";
  document.documentElement.style.colorScheme = dark ? "dark" : "light";
}

// Runs in <head> before page content is painted so every route starts with the
// saved device theme instead of briefly rendering (or remaining) in light mode.
export const PREFERENCE_BOOTSTRAP = `(() => {
  try {
    const saved = localStorage.getItem("${THEME_KEY}");
    const theme = saved === "light" || saved === "dark" || saved === "system" ? saved : "system";
    const dark = theme === "dark" || (theme === "system" && matchMedia("(prefers-color-scheme: dark)").matches);
    const root = document.documentElement;
    root.dataset.theme = dark ? "dark" : "light";
    root.style.colorScheme = dark ? "dark" : "light";
  } catch {}
})();`;
