import { execSync } from "child_process";

const DEFAULT_TIMEOUT_MS = 120000;

export interface LLMOptions {
  timeout?: number;
  model?: string;
  systemMessage?: string;
}

export async function callLLM(
  prompt: string,
  options: LLMOptions = {}
): Promise<string> {
  const { systemMessage, timeout = DEFAULT_TIMEOUT_MS, model = "opus" } = options;

  let fullPrompt = "";
  if (systemMessage) fullPrompt += systemMessage + "\n\n";
  fullPrompt += prompt;

  try {
    const env = { ...process.env };
    delete env.TELEGRAM_BOT_TOKEN;

    const result = execSync(
      `claude -p --model ${model} --output-format text`,
      {
        input: fullPrompt,
        encoding: "utf-8",
        timeout,
        maxBuffer: 2 * 1024 * 1024,
        stdio: ["pipe", "pipe", "pipe"],
        env,
      }
    );

    const content = result.trim();
    if (!content) throw new Error("Empty Claude response");
    return content;
  } catch (err: unknown) {
    const error = err as Error & { stderr?: string };
    if (error.stderr) console.error("[llm] Claude CLI error:", error.stderr.slice(0, 200));
    throw new Error(`Claude CLI error: ${error.message}`);
  }
}

export async function callLLMWithRetry(
  prompt: string,
  options: LLMOptions = {},
  maxRetries = 3
): Promise<string> {
  let lastError: Error | null = null;
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await callLLM(prompt, options);
    } catch (error) {
      lastError = error as Error;
      if (attempt < maxRetries) {
        console.log(`[llm] Retry ${attempt}/${maxRetries}: ${lastError.message}`);
        await new Promise((r) => setTimeout(r, 2000 * attempt));
      }
    }
  }
  throw lastError || new Error("callLLMWithRetry failed");
}
