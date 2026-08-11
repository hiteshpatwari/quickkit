import type { Metadata } from "next";
import { SettingsPage } from "../components/SettingsPage";

export const metadata: Metadata = { title: "Settings", description: "Device-local QuickKit preferences." };
export default function Page() { return <SettingsPage />; }
