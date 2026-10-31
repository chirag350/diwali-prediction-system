import type { MetadataRoute } from "next";
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Shwāsa — Air, understood.",
    short_name: "Shwāsa",
    description: "Your neighborhood air, a little ahead.",
    start_url: "/",
    display: "standalone",
    background_color: "#f6f6ef",
    theme_color: "#315740",
    icons: [
      { src: "/icon.svg", sizes: "any", type: "image/svg+xml", purpose: "any" },
    ],
  };
}
