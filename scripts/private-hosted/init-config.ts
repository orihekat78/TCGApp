import { stdin, stdout } from "node:process";
import { createInterface } from "node:readline/promises";
import { dirname, isAbsolute, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import {
  createOperatorConfig,
  defaultOperatorConfigPath,
  MAX_APPROVED_EMAILS,
  writeNewOperatorConfig,
  type OperatorConfigAnswers,
} from "./operator-config.js";

const MODULE_REPOSITORY_ROOT = resolve(
  dirname(fileURLToPath(import.meta.url)),
  "..",
  "..",
);

function fail(message: string): never {
  throw new Error(`private hosted config initialization rejected: ${message}`);
}

export function parseInitConfigArgs(
  args: readonly string[],
  environment: NodeJS.ProcessEnv = process.env,
): { outputPath: string } {
  if (args.length === 0) {
    return { outputPath: defaultOperatorConfigPath(environment) };
  }
  if (args.length !== 2 || args[0] !== "--output" || !isAbsolute(args[1]!)) {
    fail("usage: private-hosted:init -- [--output <absolute-path>]");
  }
  return { outputPath: resolve(args[1]!) };
}

export async function promptOperatorConfigAnswers(
  question: (prompt: string) => Promise<string>,
): Promise<OperatorConfigAnswers> {
  const accountId = await question("Cloudflare account ID (32 hex): ");
  const teamName = await question("Zero Trust team name: ");
  const operatorEmail = await question("Operator email: ");
  const approvedEmails: string[] = [];
  while (approvedEmails.length < MAX_APPROVED_EMAILS - 1) {
    const next = await question(
      `Additional approved individual email (blank to finish, ${MAX_APPROVED_EMAILS} total max): `,
    );
    if (next.trim() === "") break;
    approvedEmails.push(next);
  }
  return { accountId, teamName, operatorEmail, approvedEmails };
}

export async function runInitConfigCli(
  args: readonly string[] = process.argv.slice(2),
  environment: NodeJS.ProcessEnv = process.env,
): Promise<void> {
  const { outputPath } = parseInitConfigArgs(args, environment);
  const reader = createInterface({ input: stdin, output: stdout });
  try {
    const answers = await promptOperatorConfigAnswers((prompt) => reader.question(prompt));
    const config = createOperatorConfig(answers);
    await writeNewOperatorConfig(outputPath, config, {
      repoRoot: MODULE_REPOSITORY_ROOT,
    });
    process.stdout.write(
      `Created private operator config at ${outputPath}\nProject: ${config.projectName}\n`,
    );
  } finally {
    reader.close();
  }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  await runInitConfigCli();
}
