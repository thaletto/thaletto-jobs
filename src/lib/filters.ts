import type { SearchOptions } from "../schema/index.ts";

/**
 * Escapes single quotes in a filter value to prevent injection
 * @param v 
 * @returns string
 */
const esc = (v: string) => v.replace(/\\/g, "\\\\").replace(/'/g, "\\'");

export function buildFilter(options: SearchOptions) {
    const parts: string[] = [];

    if (options.category) {
        parts.push(`category = '${esc(options.category)}'`);
    }

    for (const tag of options.tags ?? []) {
        const p = esc(tag);
        parts.push(`tags LIKE '%${p}%'`);
    }

    // TTL guard - always present; -1 means no expiration
    parts.push(`(expires_at = -1 OR expires_at > ${Date.now()})`);

    return parts.join(" AND ");
}