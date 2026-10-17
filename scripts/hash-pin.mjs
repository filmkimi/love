import { randomBytes, scryptSync } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import { createInterface } from "node:readline/promises";
import { stdin, stdout } from "node:process";
import { resolve } from "node:path";

function createHash(pin) {
  const salt = randomBytes(16).toString("hex");
  return `${salt}:${scryptSync(pin, salt, 32).toString("hex")}`;
}

if (process.argv.includes("--set-both")) {
  let pin = "";
  for await (const chunk of stdin) pin += chunk;
  pin = pin.trim();

  if (!/^\d{6}$/.test(pin)) {
    console.error("PIN must contain exactly six digits.");
    process.exitCode = 1;
  } else {
    const envPath = resolve(process.cwd(), ".env.local");
    let contents = "";
    try {
      contents = await readFile(envPath, "utf8");
    } catch (error) {
      if (error.code !== "ENOENT") throw error;
    }

    for (const [key, value] of [
      ["USER_A_PIN_HASH", createHash(pin)],
      ["USER_B_PIN_HASH", createHash(pin)]
    ]) {
      const line = `${key}=${value}`;
      const expression = new RegExp(`^${key}=.*$`, "m");
      contents = expression.test(contents)
        ? contents.replace(expression, line)
        : `${contents}${contents && !contents.endsWith("\n") ? "\n" : ""}${line}\n`;
    }

    await writeFile(envPath, contents, { encoding: "utf8", mode: 0o600 });
    console.log("Updated both server-side PIN hashes in .env.local.");
  }
} else {
  const terminal = createInterface({ input: stdin, output: stdout });
  const pin = await terminal.question("Enter a new six-digit PIN (input is visible): ");
  terminal.close();

  if (!/^\d{6}$/.test(pin)) {
    console.error("PIN must contain exactly six digits.");
    process.exitCode = 1;
  } else {
    console.log(`Store this value in the matching server-only USER_*_PIN_HASH environment variable:\n${createHash(pin)}`);
  }
}
