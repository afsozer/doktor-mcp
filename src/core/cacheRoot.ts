import { homedir } from "node:os";
import { join } from "node:path";

/**
 * Root directory for on-disk caches (legislation, legislation documents,
 * precedents).
 *
 * The server is usually started by an MCP client through `npx`, so the
 * working directory is not predictable (Claude Desktop on macOS starts it in
 * `/`, which is not writable). Caches therefore live in a per-user directory:
 * `DOKTOR_MCP_CACHE_DIR` if set, otherwise `$XDG_CACHE_HOME/doktor-mcp`,
 * otherwise `~/.cache/doktor-mcp`.
 */
export function cacheRoot(): string {
  const explicit = process.env.DOKTOR_MCP_CACHE_DIR?.trim();
  if (explicit) return explicit;
  const xdg = process.env.XDG_CACHE_HOME?.trim();
  return join(xdg || join(homedir(), ".cache"), "doktor-mcp");
}
