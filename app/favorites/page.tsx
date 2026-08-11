import type { Metadata } from "next";
import { FavoritesPage } from "../components/FavoritesPage";

export const metadata: Metadata = { title: "Favorites", description: "Your favorite QuickKit tools, saved on this device." };
export default function Page() { return <FavoritesPage />; }
