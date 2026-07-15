export function normalizeCodes(text) {
  return text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
}

export async function runWithConcurrency(items, concurrency, handler) {
  const limit = Number.parseInt(concurrency, 10);
  if (!Number.isInteger(limit) || limit < 1) {
    throw new TypeError('concurrency 必须是大于 0 的整数');
  }

  const results = new Array(items.length);
  let nextIndex = 0;

  async function worker() {
    while (true) {
      const index = nextIndex;
      nextIndex += 1;
      if (index >= items.length) return;
      results[index] = await handler(items[index], index);
    }
  }

  await Promise.all(
    Array.from({ length: Math.min(limit, items.length) }, () => worker()),
  );

  return results;
}
