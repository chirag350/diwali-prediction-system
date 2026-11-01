import type { MetadataRoute } from "next";
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Shwāsa — Air quality",
    short_name: "Shwāsa",
    description: "Air quality estimates for Delhi-NCR.",
    start_url: "/",
    display: "standalone",
    background_color: "#f6f6ef",
    theme_color: "#315740",
    icons: [
      { src: "/icon.svg", sizes: "any", type: "image/svg+xml", purpose: "any" },
    ],
  };
}
