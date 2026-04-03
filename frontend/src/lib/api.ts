const configuredApiBase = process.env.NEXT_PUBLIC_API_BASE_URL?.trim();

const isBrowser = typeof window !== "undefined";
const hostname = isBrowser ? window.location.hostname : "";
const isLocalHost = hostname === "localhost" || hostname === "127.0.0.1";

export const API_BASE_URL = configuredApiBase
  ? configuredApiBase.replace(/\/+$/, "")
  : isLocalHost
    ? "http://127.0.0.1:8000"
    : "";
