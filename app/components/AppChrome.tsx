"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { applyTheme, readTheme, type Theme } from "../lib/preferences";
import { searchTools, tools, type ToolId } from "../lib/tools";

type QuickKitContextValue = {
  favorites: ToolId[];
  toggleFavorite: (id: ToolId) => void;
  theme: Theme;
  setTheme: (theme: Theme) => void;
  openPalette: () => void;
};

const QuickKitContext = createContext<QuickKitContextValue | null>(null);

export function useQuickKit() {
  const value = useContext(QuickKitContext);
  if (!value) throw new Error("QuickKit context is unavailable.");
  return value;
}

function readFavorites(): ToolId[] {
  try {
    const saved = JSON.parse(localStorage.getItem("quickkit.favorites") ?? "[]") as string[];
    return saved.filter((id): id is ToolId => tools.some((tool) => tool.id === id));
  } catch {
    return [];
  }
}

function CommandPalette({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [query, setQuery] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const results = useMemo(() => searchTools(query).slice(0, 7), [query]);

  useEffect(() => {
    if (!open) return;
    requestAnimationFrame(() => inputRef.current?.focus());
  }, [open]);

  if (!open) return null;

  const navigate = (route: string) => {
    onClose();
    window.location.assign(route);
  };

  return (
    <div className="palette-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
      <dialog
        open
        className="palette"
        aria-modal="true"
        aria-label="QuickKit command palette"
      >
        <div className="palette-search">
          <span aria-hidden="true">⌘</span>
          <input
            ref={inputRef}
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Escape") onClose();
              if (event.key === "Enter" && results[0]) navigate(results[0].route);
            }}
            placeholder="Find a tool or command…"
            aria-label="Search tools and commands"
          />
          <kbd>esc</kbd>
        </div>
        <div className="palette-list" role="listbox">
          <p className="eyebrow">Tools</p>
          {results.length ? (
            results.map((tool, index) => (
              <button
                key={tool.id}
                className={`palette-result ${index === 0 ? "is-active" : ""}`}
                onClick={() => navigate(tool.route)}
                role="option"
                aria-selected={index === 0}
              >
                <span className="tool-glyph" aria-hidden="true">{tool.icon}</span>
                <span><strong>{tool.shortName}</strong><small>{tool.description}</small></span>
                <span className="palette-category">{tool.category}</span>
              </button>
            ))
          ) : (
            <div className="palette-empty">No tools match “{query}”.</div>
          )}
        </div>
        <footer className="palette-footer">
          <span><kbd>↵</kbd> open</span><span><kbd>esc</kbd> close</span>
        </footer>
      </dialog>
    </div>
  );
}

function ServiceWorkerRegistration() {
  useEffect(() => {
    if ("serviceWorker" in navigator && process.env.NODE_ENV === "production") {
      navigator.serviceWorker.register("/sw.js").catch(() => undefined);
    }
  }, []);
  return null;
}

export function AppChrome({ children }: { children: ReactNode }) {
  const [favorites, setFavorites] = useState<ToolId[]>([]);
  const [theme, setThemeState] = useState<Theme>("system");
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [online, setOnline] = useState(true);
  const [pathname, setPathname] = useState("");

  useEffect(() => {
    const frame = requestAnimationFrame(() => {
      setFavorites(readFavorites());
      const savedTheme = readTheme();
      setThemeState(savedTheme);
      applyTheme(savedTheme);
      setOnline(navigator.onLine);
      setPathname(window.location.pathname);
    });

    const media = matchMedia("(prefers-color-scheme: dark)");
    const syncTheme = () => {
      const current = readTheme();
      setThemeState(current);
      applyTheme(current);
    };
    const onSystemChange = () => {
      const current = readTheme();
      if (current === "system") applyTheme(current);
    };
    const onStorage = (event: StorageEvent) => {
      if (event.key === "quickkit.theme") syncTheme();
    };
    const onOnline = () => setOnline(true);
    const onOffline = () => setOnline(false);
    media.addEventListener("change", onSystemChange);
    window.addEventListener("pageshow", syncTheme);
    window.addEventListener("storage", onStorage);
    window.addEventListener("online", onOnline);
    window.addEventListener("offline", onOffline);
    return () => {
      cancelAnimationFrame(frame);
      media.removeEventListener("change", onSystemChange);
      window.removeEventListener("pageshow", syncTheme);
      window.removeEventListener("storage", onStorage);
      window.removeEventListener("online", onOnline);
      window.removeEventListener("offline", onOffline);
    };
  }, []);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setPaletteOpen(true);
      }
      if (event.key === "Escape") setPaletteOpen(false);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  const toggleFavorite = useCallback((id: ToolId) => {
    setFavorites((current) => {
      const next = current.includes(id) ? current.filter((item) => item !== id) : [...current, id];
      localStorage.setItem("quickkit.favorites", JSON.stringify(next));
      return next;
    });
  }, []);

  const setTheme = useCallback((nextTheme: Theme) => {
    setThemeState(nextTheme);
    localStorage.setItem("quickkit.theme", nextTheme);
    applyTheme(nextTheme);
  }, []);

  const value = useMemo(
    () => ({ favorites, toggleFavorite, theme, setTheme, openPalette: () => setPaletteOpen(true) }),
    [favorites, toggleFavorite, theme, setTheme],
  );

  return (
    <QuickKitContext.Provider value={value}>
      <ServiceWorkerRegistration />
      <div className="app-shell">
        <header className="site-header">
          <a href="/" className="brand" aria-label="QuickKit home">
            <span className="brand-mark" aria-hidden="true">QK</span>
            <span>QuickKit</span>
          </a>
          <nav aria-label="Primary navigation">
            <a className={pathname === "/" ? "is-current" : ""} href="/">Tools</a>
            <a className={pathname === "/favorites" ? "is-current" : ""} href="/favorites">
              Favorites <span className="nav-count">{favorites.length}</span>
            </a>
            <a className={pathname === "/about" ? "is-current" : ""} href="/about">About</a>
          </nav>
          <div className="header-actions">
            {!online && <span className="offline-pill">Offline · tools still work</span>}
            <button className="shortcut-button" onClick={() => setPaletteOpen(true)} aria-label="Open command palette">
              <span>Search</span><kbd>⌘ K</kbd>
            </button>
            <a className="icon-link" href="/settings" aria-label="Open settings">⚙</a>
          </div>
        </header>
        <main>{children}</main>
        <footer className="site-footer">
          <div><span className="status-dot" aria-hidden="true" /> All core tools process data locally.</div>
          <div className="footer-links"><a href="/privacy">Privacy</a><a href="/about#architecture">Architecture</a><span>v0.1.2</span></div>
        </footer>
      </div>
      <CommandPalette key={paletteOpen ? "palette-open" : "palette-closed"} open={paletteOpen} onClose={() => setPaletteOpen(false)} />
    </QuickKitContext.Provider>
  );
}
