"use client";

import { useEffect, useState } from "react";
import { useQuickKit } from "./AppChrome";

type Settings = { editorFontSize: number; indentation: number; rememberRecent: boolean; reduceMotion: boolean };
const defaults: Settings = { editorFontSize: 14, indentation: 2, rememberRecent: false, reduceMotion: false };

export function SettingsPage() {
  const { theme, setTheme } = useQuickKit();
  const [settings, setSettings] = useState(defaults);

  useEffect(() => {
    const frame = requestAnimationFrame(() => {
      try {
        setSettings({ ...defaults, ...JSON.parse(localStorage.getItem("quickkit.settings") ?? "{}") });
      } catch {
        setSettings(defaults);
      }
    });
    return () => cancelAnimationFrame(frame);
  }, []);

  const update = (next: Settings) => {
    setSettings(next);
    localStorage.setItem("quickkit.settings", JSON.stringify(next));
    document.documentElement.dataset.reduceMotion = next.reduceMotion ? "true" : "false";
    document.documentElement.style.setProperty("--editor-font-size", `${next.editorFontSize}px`);
  };

  return (
    <div className="page-wrap narrow">
      <header className="page-title"><p className="eyebrow">Device preferences</p><h1>Settings</h1><p>Only these preferences are saved. Tool input is not.</p></header>
      <section className="settings-card">
        <div className="setting-row"><div><strong>Theme</strong><p>Use your system setting, light, or dark.</p></div><select value={theme} onChange={(event) => setTheme(event.target.value as typeof theme)}><option value="system">System</option><option value="light">Light</option><option value="dark">Dark</option></select></div>
        <div className="setting-row"><div><strong>Editor font size</strong><p>Applied to tool inputs and outputs.</p></div><select value={settings.editorFontSize} onChange={(event) => update({ ...settings, editorFontSize: Number(event.target.value) })}><option value="13">13 px</option><option value="14">14 px</option><option value="16">16 px</option><option value="18">18 px</option></select></div>
        <div className="setting-row"><div><strong>Default indentation</strong><p>Used by JSON formatting.</p></div><select value={settings.indentation} onChange={(event) => update({ ...settings, indentation: Number(event.target.value) })}><option value="2">2 spaces</option><option value="4">4 spaces</option></select></div>
        <div className="setting-row checkbox-row"><div><strong>Remember recent tools</strong><p>Stores tool identifiers only. Never their content.</p></div><input id="remember-recent" aria-label="Remember recent tools" type="checkbox" checked={settings.rememberRecent} onChange={(event) => update({ ...settings, rememberRecent: event.target.checked })} /></div>
        <div className="setting-row checkbox-row"><div><strong>Reduce motion</strong><p>Minimizes non-essential interface movement.</p></div><input id="reduce-motion" aria-label="Reduce motion" type="checkbox" checked={settings.reduceMotion} onChange={(event) => update({ ...settings, reduceMotion: event.target.checked })} /></div>
      </section>
      <section className="storage-audit"><p className="eyebrow">Local storage audit</p><code>quickkit.theme</code><code>quickkit.favorites</code><code>quickkit.settings</code><p>No other product keys are written by this version.</p></section>
    </div>
  );
}
