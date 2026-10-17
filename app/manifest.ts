import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Our Little World",
    short_name: "Our World",
    description: "A little place for the two of us.",
    start_url: "/",
    display: "standalone",
    background_color: "#fcf8f2",
    theme_color: "#fcf8f2",
    orientation: "portrait",
    icons: [
      {
        src: "/icon.svg",
        sizes: "any",
        type: "image/svg+xml",
        purpose: "maskable"
      }
    ]
  };
}
