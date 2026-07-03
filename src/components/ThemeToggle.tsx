import { Monitor, Moon, Sun } from "lucide-react";
import { useEffect, useState } from "react";

import { Button } from "@/components/ui/button";

type Theme = "light" | "dark" | "system";

const themes: Array<{ value: Theme; label: string; icon: typeof Sun }> = [
  { value: "light", label: "浅色", icon: Sun },
  { value: "dark", label: "深色", icon: Moon },
  { value: "system", label: "系统", icon: Monitor },
];

function applyTheme(theme: Theme) {
  const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
  const shouldUseDark = theme === "dark" || (theme === "system" && prefersDark);
  document.documentElement.classList.toggle("dark", shouldUseDark);
}

export function ThemeToggle() {
  const [theme, setTheme] = useState<Theme>("system");

  useEffect(() => {
    const storedTheme = window.localStorage.getItem("theme") as Theme | null;
    const initialTheme = storedTheme ?? "system";
    setTheme(initialTheme);
    applyTheme(initialTheme);
  }, []);

  useEffect(() => {
    const media = window.matchMedia("(prefers-color-scheme: dark)");
    const syncSystemTheme = () => {
      if (theme === "system") {
        applyTheme("system");
      }
    };

    media.addEventListener("change", syncSystemTheme);
    return () => media.removeEventListener("change", syncSystemTheme);
  }, [theme]);

  function cycleTheme() {
    const currentIndex = themes.findIndex((item) => item.value === theme);
    const nextTheme = themes[(currentIndex + 1) % themes.length].value;
    setTheme(nextTheme);
    window.localStorage.setItem("theme", nextTheme);
    applyTheme(nextTheme);
  }

  const activeTheme = themes.find((item) => item.value === theme) ?? themes[2];
  const Icon = activeTheme.icon;

  return (
    <Button
      aria-label={`切换主题，当前为${activeTheme.label}`}
      onClick={cycleTheme}
      size="icon"
      title={`切换主题，当前为${activeTheme.label}`}
      type="button"
      variant="ghost"
    >
      <Icon className="h-4 w-4" />
    </Button>
  );
}
