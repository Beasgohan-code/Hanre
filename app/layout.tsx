import type { Metadata, Viewport } from "next";
import "@fontsource-variable/inter";
import "@fontsource-variable/jetbrains-mono";
import "@xterm/xterm/css/xterm.css";
import "./globals.css";
import "./studio.css";

export const metadata: Metadata = {
  title: {
    default: "Hanre Studio — a coding workspace for everyone",
    template: "%s · Hanre Studio",
  },
  description:
    "Write, run, and ship code from any browser. Hanre Studio bundles an editor, terminal, instant runners, GitHub import, and a clean project workspace — no installs, no setup.",
  applicationName: "Hanre Studio",
  authors: [{ name: "Hanre" }],
  keywords: ["code editor", "IDE", "browser IDE", "learn to code", "Python", "JavaScript", "Termux"],
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#07080c",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" data-theme="dark" suppressHydrationWarning>
      <body>{children}</body>
    </html>
  );
}
