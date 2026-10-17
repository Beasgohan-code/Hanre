import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Hanre Studio",
    short_name: "Hanre",
    description:
      "A browser-native coding workspace: editor, terminal, instant runners, previews, and GitHub import.",
    start_url: "/dashboard",
    display: "standalone",
    background_color: "#07080c",
    theme_color: "#07080c",
    categories: ["developer", "productivity", "education"],
    icons: [
      { src: "/icon.svg", sizes: "any", type: "image/svg+xml", purpose: "any" },
    ],
  };
}
