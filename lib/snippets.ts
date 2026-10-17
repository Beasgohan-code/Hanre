export function normalizeTags(input: unknown): string[] {
  if (!Array.isArray(input)) return [];
  return [...new Set(
    input
      .map((tag) => String(tag).trim().toLowerCase().replace(/^#/, ""))
      .filter((tag) => tag.length > 0 && tag.length <= 24),
  )].slice(0, 8);
}
