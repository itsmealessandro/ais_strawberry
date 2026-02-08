// CLI entrypoint: loads OpenAPI, extracts operations/dependencies, writes reports.
import yargs from "yargs";
import { hideBin } from "yargs/helpers";
import { loadOpenApiSpec } from "./openapi-loader.js";
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
const outputDir = argv.out;

// Run the core pipeline: load spec -> extract operations -> infer dependencies.
const spec = loadOpenApiSpec(specPath);
const operations = extractOperations(spec);
const dependencies = extractDependencies(operations);

// Emit JSON and Markdown reports.
writeJsonReport(outputDir, { operations, dependencies });
writeMarkdownSummary(outputDir, operations, dependencies);
writeAnalysisReport(outputDir, {
  specPath,
  operations,
  dependencies
});

console.log(`Extracted ${operations.length} operations and ${dependencies.length} dependencies.`);
console.log(`Reports written to ${outputDir}`);
