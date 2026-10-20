import type { MetadataRoute } from "next";

// Colors and icons are intentionally absent: DESIGN.md marks them UNDECIDED.
// Icon files go in public/icons/ and get listed here once approved. No offline caching in T-00.
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "jobLog",
    short_name: "jobLog",
    start_url: "/",
    display: "standalone",
    icons: [],
  };
}
