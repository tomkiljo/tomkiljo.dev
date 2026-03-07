import { generateKeyPairSync } from "node:crypto";
import { createServer as createHttpServer } from "node:http";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import pty from "@homebridge/node-pty-prebuilt-multiarch";
import ssh2 from "ssh2";

const { Server } = ssh2;

const appRoot = resolve(fileURLToPath(new URL("..", import.meta.url)));

const parsePort = (value: string | undefined, fallback: number) => {
  const parsed = Number.parseInt(value ?? "", 10);
  if (!Number.isFinite(parsed) || parsed < 1 || parsed > 65535) {
    return fallback;
  }

  return parsed;
};

const sshHost = process.env.SSH_LISTEN_HOST ?? "0.0.0.0";
const sshPort = parsePort(process.env.SSH_LISTEN_PORT, 2222);
const statusHost = process.env.SSH_STATUS_HOST ?? "127.0.0.1";
const statusPort = parsePort(process.env.SSH_STATUS_PORT, 39217);
const hostKeyPath = process.env.SSH_HOST_KEY_PATH ?? resolve(appRoot, ".data/tui-ssh-host-key.pem");
const tuiCommand = process.env.TUI_SSH_COMMAND ?? "bun run src/main.tsx";

const toSpawnEnv = (): Record<string, string> => {
  const env: Record<string, string> = {};
  for (const [key, value] of Object.entries(process.env)) {
    if (value !== undefined) {
      env[key] = value;
    }
  }

  env.TUI_SSH_STATUS_URL = `http://${statusHost}:${statusPort}/status`;
  return env;
};

const ensureHostKey = async () => {
  try {
    return await readFile(hostKeyPath);
  } catch (error) {
    if (!(error instanceof Error) || !("code" in error) || error.code !== "ENOENT") {
      throw error;
    }
  }

  await mkdir(dirname(hostKeyPath), { recursive: true });
  const { privateKey } = generateKeyPairSync("rsa", {
    modulusLength: 3072,
    publicExponent: 0x10001,
  });

  const privatePem = privateKey.export({ type: "pkcs1", format: "pem" });
  await writeFile(hostKeyPath, privatePem, { mode: 0o600 });
  return Buffer.isBuffer(privatePem) ? privatePem : Buffer.from(privatePem);
};

const hostKey = await ensureHostKey();

const sessions = new Map<number, pty.IPty>();
let nextSessionId = 1;
let totalSshSessionsServed = 0;
const startedAt = Date.now();

const statusServer = createHttpServer((request, response) => {
  if (request.method === "GET" && request.url === "/status") {
    response.writeHead(200, { "content-type": "application/json" });
    response.end(JSON.stringify({ activeSshSessions: sessions.size }));
    return;
  }

  if (request.method === "GET" && request.url === "/health") {
    response.writeHead(200, { "content-type": "application/json" });
    response.end(
      JSON.stringify({
        status: "ok",
        uptimeSeconds: Math.floor((Date.now() - startedAt) / 1000),
        activeSshSessions: sessions.size,
        totalSshSessionsServed,
      })
    );
    return;
  }

  response.writeHead(404, { "content-type": "application/json" });
  response.end(JSON.stringify({ error: "Not Found" }));
});

const sshServer = new Server({ hostKeys: [hostKey] }, (client) => {
  client.on("authentication", (context) => {
    context.accept();
  });

  client.on("session", (accept) => {
    const session = accept();
    let cols = 80;
    let rows = 24;
    let shell: pty.IPty | null = null;
    let sessionId: number | null = null;
    let cleanedUp = false;

    const cleanup = () => {
      if (cleanedUp) {
        return;
      }

      cleanedUp = true;
      if (sessionId !== null) {
        sessions.delete(sessionId);
      }

      if (shell) {
        shell.kill();
      }
    };

    session.on("pty", (acceptPty, _rejectPty, info) => {
      cols = Math.max(info.cols || cols, 1);
      rows = Math.max(info.rows || rows, 1);
      acceptPty?.();
    });

    session.on("window-change", (acceptWindowChange, _rejectWindowChange, info) => {
      cols = Math.max(info.cols || cols, 1);
      rows = Math.max(info.rows || rows, 1);
      if (shell) {
        shell.resize(cols, rows);
      }
      acceptWindowChange?.();
    });

    session.on("shell", (acceptShell, rejectShell) => {
      const stream = acceptShell();
      if (!stream) {
        rejectShell?.();
        return;
      }

      sessionId = nextSessionId;
      nextSessionId += 1;
      totalSshSessionsServed += 1;

      shell = pty.spawn("/bin/sh", ["-lc", tuiCommand], {
        name: "xterm-256color",
        cols,
        rows,
        cwd: appRoot,
        env: toSpawnEnv(),
      });
      sessions.set(sessionId, shell);

      shell.onData((data) => {
        if (!stream.destroyed) {
          stream.write(data);
        }
      });

      shell.onExit(({ exitCode }) => {
        if (!stream.destroyed) {
          stream.exit(exitCode ?? 0);
          stream.end();
        }
        cleanup();
      });

      stream.on("data", (data: Buffer) => {
        if (shell) {
          shell.write(data.toString("utf8"));
        }
      });

      stream.on("close", cleanup);
      stream.on("error", cleanup);
    });

    session.on("exec", (_acceptExec, rejectExec) => {
      rejectExec?.();
    });
    session.on("subsystem", (_acceptSubsystem, rejectSubsystem) => {
      rejectSubsystem?.();
    });
    session.on("sftp", (_acceptSftp, rejectSftp) => {
      rejectSftp?.();
    });
    session.on("close", cleanup);
  });
});

const shutdown = () => {
  for (const shell of sessions.values()) {
    shell.kill();
  }
  sessions.clear();

  sshServer.close();
  statusServer.close();
};

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);

statusServer.listen(statusPort, statusHost, () => {
  console.log(`[tui-ssh] Status endpoint listening on http://${statusHost}:${statusPort}/status`);
});

sshServer.listen(sshPort, sshHost, () => {
  console.log(`[tui-ssh] SSH server listening on ${sshHost}:${sshPort}`);
  console.log(`[tui-ssh] Host key path: ${hostKeyPath}`);
  console.log(`[tui-ssh] TUI command: ${tuiCommand}`);
});