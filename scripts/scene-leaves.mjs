import { readFile } from 'node:fs/promises';

// Walk the published scene index, including nested groups and file references.
export async function leafIds(spec, base, ancestors = []) {
  if (typeof spec === 'string') {
    const url = new URL(spec, base);
    if (ancestors.includes(url.href)) throw Error('Circular design ' + spec);
    return leafIds(JSON.parse(await readFile(url, "utf8")), url, [...ancestors, url.href]);
  }
  return (await Promise.all(spec.layers.map(l => l.id ?? leafIds(l.design, base, ancestors)))).flat();
}
