import app from "../server/app.js";

export default function handler(req: any, res: any) {
  const originalPath =
    req.headers["x-matched-path"] ||
    req.headers["x-vercel-matched-path"] ||
    req.headers["x-original-url"] ||
    req.headers["x-forwarded-uri"];

  if (typeof originalPath === "string" && originalPath.startsWith("/api/")) {
    req.url = originalPath;
  } else if (req.url && !req.url.startsWith("/api/") && req.url !== "/api") {
    req.url = `/api${req.url.startsWith("/") ? "" : "/"}${req.url}`;
  }
  return app(req, res);
}
