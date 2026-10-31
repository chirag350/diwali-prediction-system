import { readFile, writeFile, mkdir, rename } from "node:fs/promises";
import path from "node:path";
import { createHash, randomUUID } from "node:crypto";
type Entry = {
  id: string;
  h3: string;
  kind: string;
  at: string;
  device: string;
};
type Store = { reports: Entry[]; pledges: Entry[] };
const directory =
  process.env.LOCAL_DATA_DIR ?? path.join(process.cwd(), ".local-data");
let queue: Promise<unknown> = Promise.resolve();
async function read(): Promise<Store> {
  try {
    return JSON.parse(
      await readFile(path.join(directory, "community.json"), "utf8"),
    );
  } catch (e) {
    if ((e as NodeJS.ErrnoException).code === "ENOENT")
      return { reports: [], pledges: [] };
    throw e;
  }
}
export function device(request: Request) {
  const existing = request.headers
    .get("cookie")
    ?.match(/(?:^|;\s*)shwasa_device=([a-f0-9-]{36})(?:;|$)/)?.[1];
  const id = existing ?? randomUUID();
  return {
    hash: createHash("sha256").update(id).digest("hex"),
    cookie: `shwasa_device=${id}; Path=/; HttpOnly; SameSite=Strict; Max-Age=31536000${process.env.NODE_ENV === "production" ? "; Secure" : ""}`,
  };
}
export async function community(h3: string) {
  const store = await read();
  const since = Date.now() - 86400000;
  const recent = store.reports.filter(
    (x) => x.h3 === h3 && Date.parse(x.at) > since,
  );
  const groups = ["haze", "smoke", "burning", "dust"].map((kind) => ({
    kind,
    count: new Set(recent.filter((r) => r.kind === kind).map((r) => r.device))
      .size,
  }));
  return {
    reports: groups,
    pledges: store.pledges.length,
    storage: "local-single-instance",
    modelInfluence: false,
  };
}
export function contribute(
  type: "reports" | "pledges",
  h3: string,
  kind: string,
  hash: string,
): Promise<{ id: string; duplicate?: boolean }> {
  const operation = queue.then(async () => {
    const store = await read();
    const now = Date.now();
    const existing = store[type].find(
      (x) =>
        x.device === hash &&
        (type === "pledges" || now - Date.parse(x.at) < 3600000),
    );
    if (existing) {
      if (type === "pledges") return { id: existing.id, duplicate: true };
      throw Error("Please wait one hour before sending another report.");
    }
    const id = randomUUID();
    store[type].push({
      id,
      h3,
      kind,
      at: new Date().toISOString(),
      device: hash,
    });
    if (type === "reports")
      store.reports = store.reports.filter(
        (x) => now - Date.parse(x.at) < 7 * 86400000,
      );
    await mkdir(directory, { recursive: true });
    const temp = path.join(directory, `${randomUUID()}.tmp`);
    await writeFile(temp, JSON.stringify(store), { mode: 0o600 });
    await rename(temp, path.join(directory, "community.json"));
    return { id };
  });
  queue = operation.catch(() => {});
  return operation;
}
