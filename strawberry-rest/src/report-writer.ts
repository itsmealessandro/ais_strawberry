import fs from "fs";
import path from "path";
import type { Dependency, OperationShape } from "./types.js";

const ensureDir = (dir: string) => {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
};

export const writeJsonReport = (outputDir: string, data: unknown) => {
  ensureDir(outputDir);
  fs.writeFileSync(path.join(outputDir, "dependencies.json"), JSON.stringify(data, null, 2));
};

export const writeMarkdownSummary = (outputDir: string, operations: OperationShape[], dependencies: Dependency[]) => {
  ensureDir(outputDir);
  const lines: string[] = [];
  lines.push("# StrawBerry-REST Summary");
  lines.push("");
  lines.push("## Operations");
  lines.push("");
  for (const op of operations) {
    lines.push(`- ${op.id} (${op.method.toUpperCase()} ${op.path})`);
  }
  lines.push("");
  lines.push("## Dependencies");
  lines.push("");
  if (dependencies.length === 0) {
    lines.push("No dependencies found.");
  } else {
    for (const dep of dependencies) {
      lines.push(`- ${dep.fromOperation} -> ${dep.toOperation} [${dep.kind}] ${dep.field}:${dep.type} (${dep.reason})`);
    }
  }
  lines.push("");
  fs.writeFileSync(path.join(outputDir, "summary.md"), lines.join("\n"));
};
