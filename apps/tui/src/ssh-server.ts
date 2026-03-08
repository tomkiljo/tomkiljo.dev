import { generateKeyPairSync } from "node:crypto";
import { createServer as createHttpServer } from "node:http";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { openSync, closeSync, writeSync, createReadStream } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { spawn as nodeSpawn } from "node:child_process";
import { dlopen, FFIType, ptr } from "bun:ffi";
import ssh2 from "ssh2";

const { Server } = ssh2;

// --- Bun-native PTY (replaces node-pty) ---
const { symbols: libc } = dlopen("libc.so.6", {
  grantpt: { args: [FFIType.i32], returns: FFIType.i32 },
  unlockpt: { args: [FFIType.i32], returns: FFIType.i32 },
  ptsname: { args: [FFIType.i32], returns: FFIType.cstring },
  ioctl: { args: [FFIType.i32, FFIType.u32, FFIType.ptr], returns: FFIType.i32 },
});

const O_RDWR = 2;
const TIOCSWINSZ = 0x5414;

interface IPty {
  onData: (callback: (data: string) => void) => void;
  onExit: (callback: (info: { exitCode: number }) => void) => void;
  write: (data: string) => void;
  resize: (cols: number, rows: number) => void;
  kill: () => void;
}

function makeWinsize(rows: number, cols: number): Buffer {
  const buf = Buffer.alloc(8);
  buf.writeUInt16LE(rows, 0);
  buf.writeUInt16LE(cols, 2);
  return buf;
}

function spawnPty(
  file: string,
  args: string[],
  options: { cols: number; rows: number; cwd?: string; env?: Record<string, string> }
): IPty {
  const masterFd = openSync("/dev/ptmx", O_RDWR);
  libc.grantpt(masterFd);
  libc.unlockpt(masterFd);
  const slaveName = String(libc.ptsname(masterFd));

  const slaveFd = openSync(slaveName, O_RDWR);
  libc.ioctl(slaveFd, TIOCSWINSZ, ptr(makeWinsize(options.rows, options.cols)));

  const child = nodeSpawn(file, args, {
    stdio: [slaveFd, slaveFd, slaveFd],
    cwd: options.cwd,
    env: options.env,
    detached: true,
  });
  closeSync(slaveFd);

  let dataCallback: ((data: string) => void) | null = null;
  let exitCallback: ((info: { exitCode: number }) => void) | null = null;
  let masterClosed = false;

  const rs = createReadStream("", { fd: masterFd, autoClose: false });
  rs.on("data", (chunk: Buffer) => dataCallback?.(chunk.toString("binary")));
  rs.on("error", () => {
    masterClosed = true;
  });

  child.on("exit", (code) => {
    if (!masterClosed) {
      masterClosed = true;
      rs.destroy();
      try { closeSync(masterFd); } catch {}
    }
    exitCallback?.({ exitCode: code ?? 0 });
  });

  return {
    onData: (cb) => { dataCallback = cb; },
    onExit: (cb) => { exitCallback = cb; },
    write: (data: string) => {
      if (!masterClosed) {
        try { writeSync(masterFd, Buffer.from(data, "binary")); } catch {}
      }
    },
    resize: (cols: number, rows: number) => {
      try { libc.ioctl(masterFd, TIOCSWINSZ, ptr(makeWinsize(rows, cols))); } catch {}
    },
    kill: () => {
      masterClosed = true;
      rs.destroy();
      try { child.kill("SIGTERM"); } catch {}
      try { closeSync(masterFd); } catch {}
    },
  };
}
// --- end PTY ---

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

const clients = new Set<ssh2.Connection>();
const sessions = new Map<number, IPty>();
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
  clients.add(client);
  const remoteAddress = (client as any)._sock?.remoteAddress ?? "unknown";
  console.log(`[tui-ssh] Client connected: ${remoteAddress}`);
  client.on("close", () => {
    clients.delete(client);
    console.log(`[tui-ssh] Client disconnected: ${remoteAddress}`);
  });

  client.on("authentication", (context) => {
    context.accept();
  });

  client.on("session", (accept) => {
    const session = accept();
    let cols = 80;
    let rows = 24;
    let shell: IPty | null = null;
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

      shell = spawnPty("/bin/sh", ["-lc", tuiCommand], {
        cols,
        rows,
        cwd: appRoot,
        env: toSpawnEnv(),
      });
      sessions.set(sessionId, shell);

      shell.onData((data) => {
        if (!stream.destroyed) {
          stream.write(Buffer.from(data, "binary"));
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
          shell.write(data.toString("binary"));
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
  console.log("\n[tui-ssh] Shutting down...");

  for (const shell of sessions.values()) {
    shell.kill();
  }
  sessions.clear();

  for (const client of clients) {
    client.end();
  }

  setTimeout(() => process.exit(0), 2000).unref();

  let closed = 0;
  const onClosed = () => {
    if (++closed === 2) process.exit(0);
  };

  sshServer.close(onClosed);
  statusServer.close(onClosed);
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
  console.log(`[tui-ssh] Ctrl+C to stop the server`);
});
