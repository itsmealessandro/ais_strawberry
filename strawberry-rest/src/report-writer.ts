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

export const writeAnalysisReport = (
  outputDir: string,
  meta: {
    specPath: string;
    operations: OperationShape[];
    dependencies: Dependency[];
  }
) => {
  ensureDir(outputDir);
  const operationsCount = meta.operations.length;
  const dependenciesCount = meta.dependencies.length;
  const byKind = meta.dependencies.reduce<Record<string, number>>((acc, dep) => {
    acc[dep.kind] = (acc[dep.kind] ?? 0) + 1;
    return acc;
  }, {});
  const byReason = meta.dependencies.reduce<Record<string, number>>((acc, dep) => {
    acc[dep.reason] = (acc[dep.reason] ?? 0) + 1;
    return acc;
  }, {});
  const verified = meta.dependencies.filter((dep) => dep.verification === "verified").length;
  const unverified = meta.dependencies.filter((dep) => dep.verification === "unverified").length;
  const lines: string[] = [];
  lines.push("# StrawBerry-REST Analysis Report");
  lines.push("");
  lines.push("## Analyzed Application");
  lines.push("");
  lines.push(`- Spec: ${meta.specPath}`);
  lines.push("");
  lines.push("## Pipeline Steps");
  lines.push("");
  lines.push("1. Load and validate the OpenAPI spec.");
  lines.push("2. Resolve $ref and merge schemas (allOf/oneOf/anyOf).");
  lines.push("3. Extract operations and flatten request/response shapes.");
  lines.push("4. Infer dependencies with heuristics and confidence.");
  lines.push("5. Write JSON/Markdown reports.");
  lines.push("");
  lines.push("## Results");
  lines.push("");
  lines.push(`- Operations: ${operationsCount}`);
  lines.push(`- Dependencies: ${dependenciesCount}`);
  if (meta.dependencies.some((dep) => dep.verification)) {
    lines.push(`- Verified: ${verified}`);
    lines.push(`- Unverified: ${unverified}`);
  }
  lines.push("");
  lines.push("## Dependencies by Kind");
  lines.push("");
  for (const [kind, count] of Object.entries(byKind)) {
    lines.push(`- ${kind}: ${count}`);
  }
  lines.push("");
  lines.push("## Dependencies by Reason");
  lines.push("");
  for (const [reason, count] of Object.entries(byReason)) {
    lines.push(`- ${reason}: ${count}`);
  }
  lines.push("");
  lines.push("## Operations");
  lines.push("");
  for (const op of meta.operations) {
    lines.push(`- ${op.id} (${op.method.toUpperCase()} ${op.path})`);
  }
  lines.push("");
  lines.push("## Outputs");
  lines.push("");
  lines.push("- output/dependencies.json");
  lines.push("- output/summary.md");
  lines.push("- output/analysis.md");
  lines.push("");
  fs.writeFileSync(path.join(outputDir, "analysis.md"), lines.join("\n"));
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
