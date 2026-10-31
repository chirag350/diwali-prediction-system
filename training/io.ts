import { createReadStream } from "node:fs";
import { createInterface } from "node:readline";
import { readdir } from "node:fs/promises";
import path from "node:path";
export async function* files(root: string): AsyncGenerator<string> {
  for (const e of await readdir(root, { withFileTypes: true })) {
    const p = path.join(root, e.name);
    if (e.isDirectory()) yield* files(p);
    else yield p;
  }
}
export function parse(line: string) {
  const a: string[] = [];
  let s = "",
    q = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (c === '"') {
      if (q && line[i + 1] === '"') {
        s += '"';
        i++;
      } else q = !q;
    } else if (c === "," && !q) {
      a.push(s);
      s = "";
    } else s += c;
  }
  a.push(s);
  return a;
}
export async function* csv(file: string) {
  const lines = createInterface({
    input: createReadStream(file),
    crlfDelay: Infinity,
  });
  let header: string[] | undefined;
  for await (const line of lines) {
    if (!header) {
      header = parse(line.replace(/^\uFEFF/, ""));
      continue;
    }
    if (!line.trim()) continue;
    const v = parse(line);
    if (v.length !== header.length) throw Error(`Malformed CSV ${file}`);
    yield Object.fromEntries(header.map((k, i) => [k, v[i]]));
  }
}
export function num(v: string | undefined) {
  return v !== undefined && v.trim() !== "" && Number.isFinite(Number(v))
    ? Number(v)
    : NaN;
}
export function ist(s: string) {
  return (
    Date.parse(s.includes("T") ? s : s.replace(" ", "T") + "+05:30") / 3600000
  );
}
