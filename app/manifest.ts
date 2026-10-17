import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "โลกใบเล็กของเรา",
    short_name: "โลกของเรา",
    description: "พื้นที่เล็ก ๆ สำหรับเราสองคน",
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
