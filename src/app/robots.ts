import type { MetadataRoute } from "next";

/** Index the marketing/landing surface; keep the authed app + API out. */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: ["/dashboard", "/api", "/studio", "/wiki"],
      },
    ],
  };
}
