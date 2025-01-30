export function getSiteFromHostname(hostname: string): string {
  if (hostname === "localhost" || hostname === "0.0.0.0") {
    return "localhost";
  }
  return hostname.split(".")[0];
}
