import type { Metadata } from "next";
import { HomePage } from "./components/HomePage";

export const metadata: Metadata = {
  title: "QuickKit — Tiny tools. Zero unnecessary uploads.",
  description: "Format JSON, compare text, decode JWTs, inspect URLs, view CSVs, and more—entirely in your browser.",
};

export default function Home() {
  return <HomePage />;
}
