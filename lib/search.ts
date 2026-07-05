// Turn a raw user search term into a case-insensitive "contains" pattern
// for SQL ILIKE. The LIKE wildcards (% and _) and the escape character
// itself are escaped so a term like "50%" or "a_b" matches those literal
// characters instead of acting as a wildcard. Postgres uses backslash as
// the default LIKE escape character, which is what we lean on here.
export function likeContains(term: string): string {
  const escaped = term.replace(/[\\%_]/g, (ch) => `\\${ch}`);
  return `%${escaped}%`;
}
