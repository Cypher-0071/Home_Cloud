# Phase 2 Pre-Study: Stacks (docker-compose) API & UI

> Written for: Home Cloud V2 Phase 2 implementation
> Prerequisite knowledge: You already know Express, SSE streaming, Dockerode, React state management.
> This doc covers only the **new** concepts you need.

---

## What is docker compose and why does it matter here?

Right now the backend uses **Dockerode** — a Node.js library that talks to the Docker daemon socket (`/var/run/docker.sock`) over HTTP. This works perfectly for single containers.

**docker-compose** is different. It is a CLI tool (now built into Docker as `docker compose`) that reads a `docker-compose.yml` file and orchestrates *multiple* containers as a unit called a **stack** — with shared networks, named volumes, dependency ordering, and environment files handled automatically.

You cannot drive docker compose through Dockerode. You have to **spawn it as a shell command** from Node.js and capture its output. This is the main new concept.

```
Your backend (Node.js)
    └─ child_process.spawn('docker', ['compose', 'up', '-d'])
           └─ docker CLI reads docker-compose.yml on disk
                  └─ Docker daemon creates containers, networks, volumes
```

---

## New Concept 1: `child_process.spawn` — Running shell commands from Node.js

Node.js ships with a built-in module called `child_process`. The function you will use is `spawn`.

### Why `spawn` and not `exec`?

| | `exec` | `spawn` |
|---|---|---|
| Output | Buffered — you get it all at once when done | Streaming — you get it line by line as it happens |
| Best for | Quick commands that finish fast | Long-running commands like `docker compose up` |
| Memory | Dangerous for large output | Safe |

### Basic pattern

```js
const { spawn } = require('child_process');

const proc = spawn('docker', ['compose', '-p', 'mystack', 'up', '-d'], {
  cwd: '/home/user/.home-cloud/stacks/mystack', // working directory where compose file lives
});

// stdout lines arrive as Buffers — convert to string
proc.stdout.on('data', (chunk) => {
  console.log(chunk.toString());
});

// stderr too — docker compose sends progress to stderr, not stdout
proc.stderr.on('data', (chunk) => {
  console.error(chunk.toString());
});

// fires when the process exits
proc.on('close', (exitCode) => {
  console.log('Done. Exit code:', exitCode);
  // exitCode 0 = success, anything else = error
});

// fires if the process itself cannot start (e.g. docker not installed)
proc.on('error', (err) => {
  console.error('spawn error:', err.message);
});
```

### Important: docker compose sends output to stderr

This is a quirk. When `docker compose up` pulls images and starts containers, it writes progress to **stderr**, not stdout. You need to pipe **both** through your SSE response. Do not ignore stderr.

### Killing a running process

```js
proc.kill('SIGTERM'); // graceful stop
```

Store the `proc` reference somewhere (e.g. a `Map<stackName, ChildProcess>`) so you can kill it if the user cancels a deploy.

---

## New Concept 2: Streaming `spawn` output through SSE (bridging what you know)

You already know SSE from metrics and docker stats. The pattern is identical — you just swap the data source from a Docker stream to a `spawn` process.

```js
router.post('/stacks/:name/deploy', requireAuth, (req, res) => {
  const { name } = req.params;
  const stackDir = path.join(STACKS_DIR, name);

  // Set SSE headers (same as you already do)
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders();

  const send = (type, data) => {
    res.write(`data: ${JSON.stringify({ type, data })}\n\n`);
  };

  const proc = spawn('docker', ['compose', '-p', name, 'up', '-d', '--build'], {
    cwd: stackDir,
  });

  proc.stdout.on('data', (chunk) => send('log', chunk.toString()));
  proc.stderr.on('data', (chunk) => send('log', chunk.toString())); // both!

  proc.on('close', (code) => {
    send('done', { exitCode: code, success: code === 0 });
    res.end();
  });

  proc.on('error', (err) => {
    send('error', err.message);
    res.end();
  });

  // Clean up if client disconnects
  req.on('close', () => proc.kill());
});
```

On the frontend, you consume this with the same `EventSource` pattern you already use for container logs and pull progress.

---

## New Concept 3: YAML handling with `js-yaml`

A `docker-compose.yml` is a YAML file. You need to:
1. **Parse** it (validate that what the user pasted is legal YAML before writing to disk)
2. **Write** it to disk

### Install

```bash
npm install js-yaml
```

### Usage

```js
const yaml = require('js-yaml');
const fs   = require('fs');

// Parse & validate (throws if invalid YAML)
try {
  const parsed = yaml.load(composeYamlString);
  // parsed is a plain JS object — you can inspect it
  // e.g. parsed.services gives you the services map
} catch (err) {
  return res.status(400).json({ error: `Invalid YAML: ${err.message}` });
}

// Write to disk
fs.writeFileSync(
  path.join(stackDir, 'docker-compose.yml'),
  composeYamlString,   // write the original string, not re-serialized
  'utf8'
);
```

> **Why write the original string and not re-serialize?** `yaml.dump(yaml.load(str))` can subtly change formatting, lose comments, or reorder keys. Always preserve the user's original text.

---

## New Concept 4: Stack directory layout on disk

Each stack gets its own folder under a central stacks directory (e.g. `~/.home-cloud/stacks/`).

```
~/.home-cloud/
└── stacks/
    ├── nextcloud/
    │   └── docker-compose.yml
    ├── monitoring/
    │   └── docker-compose.yml
    └── gitea/
        ├── docker-compose.yml
        └── .env           ← optional env file, user can supply it
```

Key points:
- **Stack name = folder name = `-p` project name** passed to `docker compose`. Keep it lowercase, alphanumeric + hyphens only. Validate this on the backend.
- `docker compose` uses the folder name as a prefix for all container/network/volume names it creates (`nextcloud_db_1`, `nextcloud_app_1`, etc.) — unless you pass `-p`.
- The stack directory is the `cwd` for all `spawn` calls.

### Node.js filesystem operations you will use

```js
const fs   = require('fs');
const path = require('path');

const STACKS_DIR = path.join(process.env.HOME, '.home-cloud', 'stacks');

// Create stack directory if it doesn't exist
fs.mkdirSync(path.join(STACKS_DIR, stackName), { recursive: true });

// List all stacks (just read the directory)
const stacks = fs.readdirSync(STACKS_DIR, { withFileTypes: true })
  .filter(d => d.isDirectory())
  .map(d => d.name);

// Check if a compose file exists
const composePath = path.join(STACKS_DIR, stackName, 'docker-compose.yml');
const exists = fs.existsSync(composePath);

// Delete a stack directory (after docker compose down)
fs.rmSync(path.join(STACKS_DIR, stackName), { recursive: true, force: true });
```

---

## New Concept 5: The docker compose CLI commands you will spawn

| What you want | Command to spawn |
|---|---|
| Deploy (create + start all services) | `docker compose -p <name> up -d --build` |
| Get service status | `docker compose -p <name> ps --format json` |
| Stream logs | `docker compose -p <name> logs --follow --timestamps` |
| Stop all services (keep containers) | `docker compose -p <name> stop` |
| Stop + remove containers & networks | `docker compose -p <name> down` |
| Stop + remove everything incl. volumes | `docker compose -p <name> down --volumes` |

**`-p <name>`** is the project name flag. Always pass it explicitly so the project name matches your stack folder name regardless of working directory.

**`ps --format json`** returns one JSON object per line (NDJSON). Parse each line separately:

```js
const lines = output.split('\n').filter(Boolean);
const services = lines.map(l => JSON.parse(l));
```

Each service object has fields like: `Name`, `Service`, `Status`, `Health`, `Publishers` (ports).

---

## The full backend API shape for Phase 2

```
POST   /api/docker/stacks                    Create/update stack (body: { name, composeYaml })
GET    /api/docker/stacks                    List all stacks with service counts + status
GET    /api/docker/stacks/:name              Single stack detail + service list
POST   /api/docker/stacks/:name/deploy       Deploy (SSE stream of docker compose up output)
POST   /api/docker/stacks/:name/stop         docker compose stop
DELETE /api/docker/stacks/:name              docker compose down + rm dir
GET    /api/docker/stacks/:name/logs         docker compose logs (SSE)
```

---

## What you already know that carries over

| Existing skill | How it applies |
|---|---|
| SSE headers + `res.write` pattern | Identical for streaming deploy output and logs |
| `EventSource` on the frontend | Same pattern as container logs |
| Express routing + `requireAuth` middleware | Identical |
| React `useState` / loading + error states | Same patterns for deploy status |
| Dockerode container inspection | You can still use it to inspect individual containers within a stack |

---

## What is genuinely new (summary)

1. **`child_process.spawn`** — running shell commands and reading their stdout/stderr streams
2. **`js-yaml`** — parsing and validating YAML before touching the filesystem
3. **`fs.mkdirSync` / `fs.rmSync` / `fs.readdirSync`** — managing the stacks directory (you've probably used `fs` before but not for directory tree ops)
4. **`docker compose ps --format json` output parsing** — NDJSON, one object per line

None of these are large leaps. The hardest part of Phase 2 is **error handling** — `docker compose up` can fail in dozens of ways (image not found, port already in use, invalid compose syntax, etc.) and the user needs to see the real error from the output stream rather than a generic 500.

---

## Suggested implementation order

```
1. Backend: POST /stacks (write YAML to disk, validate with js-yaml)
2. Backend: GET /stacks (list directories, run `compose ps` for each)
3. Backend: POST /stacks/:name/deploy (spawn + SSE stream)
4. Backend: DELETE /stacks/:name (compose down + rm dir)
5. Frontend: Stacks tab — list view with service status chips
6. Frontend: Deploy modal — YAML editor (textarea or code editor) + streaming deploy log
7. Backend: GET /stacks/:name/logs (compose logs SSE)
8. Frontend: Live log viewer for a stack (same LogViewer component as containers)
```

Start with steps 1–3 before touching any frontend. Verify with `curl` first.
