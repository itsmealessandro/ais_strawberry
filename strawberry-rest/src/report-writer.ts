// Writes JSON and Markdown reports for extracted data.
import fs from "fs";
import path from "path";
import type { Dependency, OperationShape } from "./types.js";

// Ensure the output directory exists.
const ensureDir = (dir: string) => {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
};

// Serialize the full report as JSON.
export const writeJsonReport = (outputDir: string, data: unknown) => {
  ensureDir(outputDir);
  fs.writeFileSync(path.join(outputDir, "dependencies.json"), JSON.stringify(data, null, 2));
};

// Render a human-readable Markdown summary.
const formatDependencyLine = (dep: Dependency) => {
  const score = dep.confidence.toFixed(2);
  const status = dep.verification ? `, ${dep.verification}` : "";
  return `- ${dep.fromOperation} -> ${dep.toOperation} [${dep.kind}] ${dep.field}:${dep.type} (${dep.reason}, ${score}${status})`;
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
      lines.push(formatDependencyLine(dep));
    }
  }
  lines.push("");
  fs.writeFileSync(path.join(outputDir, "summary.md"), lines.join("\n"));
};

export const writeRefinementDiff = (
  outputDir: string,
  dependencies: Dependency[],
  changes: Array<{ dependency: Dependency; before: "verified" | "unverified"; after: "verified" | "unverified" }>
) => {
  ensureDir(outputDir);
  const lines: string[] = [];
  const changed = changes.filter((item) => item.before !== item.after);
  const verified = dependencies.filter((dep) => dep.verification === "verified").length;
  lines.push("# StrawBerry-REST Refinement Diff");
  lines.push("");
  lines.push(`Total dependencies: ${dependencies.length}`);
  lines.push(`Verified after refinement: ${verified}`);
  lines.push(`Changed after refinement: ${changed.length}`);
  lines.push("");
  lines.push("## Changes");
  lines.push("");
  if (changed.length === 0) {
    lines.push("No dependencies changed after refinement.");
  } else {
    for (const item of changed) {
      lines.push(`- ${item.before} -> ${item.after}: ${formatDependencyLine(item.dependency).slice(2)}`);
    }
  }
  lines.push("");
  lines.push("## Verified Dependencies");
  lines.push("");
  for (const dep of dependencies.filter((dep) => dep.verification === "verified")) {
    lines.push(formatDependencyLine(dep));
  }
  lines.push("");
  lines.push("## Unverified Dependencies");
  lines.push("");
  const unverified = dependencies.filter((dep) => dep.verification !== "verified");
  if (unverified.length === 0) {
    lines.push("All dependencies verified.");
  } else {
    for (const dep of unverified) {
      lines.push(formatDependencyLine(dep));
    }
  }
  lines.push("");
  fs.writeFileSync(path.join(outputDir, "refinement-diff.md"), lines.join("\n"));
};
