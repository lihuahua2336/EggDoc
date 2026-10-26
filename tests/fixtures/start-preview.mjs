import { spawn } from "node:child_process";

const isWindows = process.platform === "win32";
const command = isWindows ? (process.env.ComSpec ?? "cmd.exe") : "npm";
const testPort = Number(process.env.EGGDOC_TEST_PORT ?? 4322);
if (!Number.isInteger(testPort) || testPort < 1 || testPort > 65535) {
  throw new Error("EGGDOC_TEST_PORT must be a valid TCP port");
}
const args = isWindows
  ? ["/d", "/s", "/c", `npm.cmd run preview -- --host 127.0.0.1 --port ${testPort}`]
  : ["run", "preview", "--", "--host", "127.0.0.1", "--port", String(testPort)];
const child = spawn(command, args, {
  stdio: "inherit",
});

function shutdown(signal) {
  child.kill(signal);
}

process.once("SIGTERM", () => shutdown("SIGTERM"));
process.once("SIGINT", () => shutdown("SIGINT"));
child.once("exit", (code, signal) => {
  process.exit(code ?? (signal ? 1 : 0));
});
