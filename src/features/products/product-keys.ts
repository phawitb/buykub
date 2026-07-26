export type ParsedProductKeys = {
  keys: string[];
  blankCount: number;
  duplicateCount: number;
};

export function parseProductKeys(input: string): ParsedProductKeys {
  const keys: string[] = [];
  const seen = new Set<string>();
  let blankCount = 0;
  let duplicateCount = 0;

  for (const line of input.split(/\r?\n/)) {
    const key = line.trim();
    if (!key) {
      blankCount += 1;
      continue;
    }
    if (seen.has(key)) {
      duplicateCount += 1;
      continue;
    }
    seen.add(key);
    keys.push(key);
  }

  return { keys, blankCount, duplicateCount };
}
