import { spawn } from "node:child_process";

const isWindows = process.platform === "win32";
const command = isWindows ? (process.env.ComSpec ?? "cmd.exe") : "npm";
const args = isWindows
  ? ["/d", "/s", "/c", "npm.cmd run preview -- --host 127.0.0.1 --port 4322"]
  : ["run", "preview", "--", "--host", "127.0.0.1", "--port", "4322"];
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
