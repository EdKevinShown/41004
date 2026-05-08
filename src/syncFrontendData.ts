import { copyFile } from "node:fs/promises";
import { resolve } from "node:path";

export async function syncFrontendDataFromRoot(cwd: string = process.cwd()): Promise<{
  source: string;
  target: string;
}> {
  const source = resolve(cwd, "normalized-records.json");
  const target = resolve(cwd, "frontend", "public", "normalized-records.json");
  await copyFile(source, target);
  return { source, target };
}

