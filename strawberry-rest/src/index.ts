// CLI entrypoint: loads OpenAPI, extracts operations/dependencies, writes reports.
import path from "path";
import yargs from "yargs";
import { hideBin } from "yargs/helpers";
import { loadOpenApiSpec } from "./openapi-loader.js";
import { validateOpenApiSpec } from "./openapi-validator.js";
import { extractOperations } from "./operation-extractor.js";
import { extractDependencies } from "./dependency-extractor.js";
import { writeAnalysisReport, writeJsonReport, writeMarkdownSummary } from "./report-writer.js";

// Parse CLI arguments for spec path and output directory.
const argv = yargs(hideBin(process.argv))
  .option("spec", {
    type: "string",
    demandOption: true,
    describe: "Path to OpenAPI spec (YAML or JSON)"
  })
  .option("out", {
    type: "string",
    default: "output",
    describe: "Output directory for reports"
  })
  .parseSync();

const specPath = argv.spec;
const outputBaseDir = argv.out;

const getAppSlug = (spec: string) => {
  const specDir = path.dirname(spec);
  const dirName = path.basename(specDir);
  if (dirName && dirName !== "." && dirName !== "src" && dirName !== "resources") {
    return dirName;
  }
  return path.basename(spec).replace(/\.(yaml|yml|json)$/i, "");
};

const formatTimestamp = (date: Date) => {
  const pad = (value: number) => value.toString().padStart(2, "0");
  return `${date.getFullYear()}${pad(date.getMonth() + 1)}${pad(date.getDate())}-${pad(date.getHours())}${pad(date.getMinutes())}${pad(date.getSeconds())}`;
};

const outputDir = path.join(outputBaseDir, `${getAppSlug(specPath)}-${formatTimestamp(new Date())}`);

// Run the core pipeline: load spec -> extract operations -> infer dependencies.
const spec = loadOpenApiSpec(specPath);
const validation = validateOpenApiSpec(spec);
if (validation.errors.length > 0) {
  for (const message of validation.errors) {
    console.error(`Validation error: ${message}`);
  }
  process.exit(1);
}
for (const message of validation.warnings) {
  console.warn(`Validation warning: ${message}`);
}
const operations = extractOperations(spec);
const dependencies = extractDependencies(operations);

// Emit JSON and Markdown reports.
writeJsonReport(outputDir, { operations, dependencies });
writeMarkdownSummary(outputDir, operations, dependencies);
writeAnalysisReport(outputDir, {
  specPath,
  operations,
  dependencies,
  validation
});

console.log(`Extracted ${operations.length} operations and ${dependencies.length} dependencies.`);
console.log(`Reports written to ${outputDir}`);
