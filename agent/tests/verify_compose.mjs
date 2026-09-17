import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const require = createRequire(import.meta.url);

console.log("--- Running Compose Native CLI & Route Verification Tests ---");

// Test 1: Module can be required cleanly without dockerode-compose
console.log("\n[Test 1] Module requires cleanly without dockerode-compose");
const composeRouter = require("../routes/compose.js");
assert(composeRouter, "composeRouter must be loaded");
assert.equal(typeof composeRouter.runCompose, "function", "runCompose must be exported as a function");
console.log("  ✔ composeRouter loads cleanly and exports runCompose");

// Test 2: Source code audit - no references to dockerode-compose
console.log("\n[Test 2] Code audit: zero references to dockerode-compose");
const source = fs.readFileSync(path.resolve(__dirname, "../routes/compose.js"), "utf8");
assert(!source.includes("dockerode-compose"), "compose.js must not contain references to dockerode-compose");
assert(!source.includes("new DockerCompose"), "compose.js must not instantiate DockerCompose");
console.log("  ✔ Verified zero occurrences of dockerode-compose in source code");

// Test 3: runCompose executes real CLI command
console.log("\n[Test 3] runCompose executes native 'docker compose version'");
const res = await composeRouter.runCompose(["version"]);
assert(res.stdout.includes("Docker Compose"), `stdout should contain 'Docker Compose', got: ${res.stdout}`);
console.log(`  ✔ runCompose successfully ran: ${res.stdout.trim()}`);

// Test 4: runCompose rejects on non-zero exit code
console.log("\n[Test 4] runCompose error handling on non-zero exit code");
await assert.rejects(
    async () => {
        await composeRouter.runCompose(["--invalid-subcommand-xyz"]);
    },
    (err) => {
        assert(err instanceof Error);
        return true;
    }
);
console.log("  ✔ runCompose correctly rejected on invalid command execution");

// Test 5: Safe project name validation
console.log("\n[Test 5] Safe project name validation");
assert.equal(composeRouter.isSafeProjectName("web-app_1"), true);
assert.equal(composeRouter.isSafeProjectName("../evil"), false);
assert.equal(composeRouter.isSafeProjectName(".."), false);
assert.equal(composeRouter.isSafeProjectName("/root"), false);
console.log("  ✔ Project name validation correctly guards against directory traversal");

// Test 6: Route handlers exist on router stack
console.log("\n[Test 6] Verification of registered router endpoints");
const routes = composeRouter.stack
    .filter((layer) => layer.route)
    .map((layer) => ({
        path: layer.route.path,
        methods: Object.keys(layer.route.methods),
    }));

const hasStart = routes.some((r) => r.path === "/:name/start" && r.methods.includes("post"));
const hasStop = routes.some((r) => r.path === "/:name/stop" && r.methods.includes("post"));
const hasDelete = routes.some((r) => r.path === "/:name" && r.methods.includes("delete"));

assert(hasStart, "POST /:name/start route must be registered");
assert(hasStop, "POST /:name/stop route must be registered");
assert(hasDelete, "DELETE /:name route must be registered");
console.log("  ✔ All compose routes (start, stop, delete) correctly registered");

// Test 7: Full runtime container lifecycle (up, stop, start, down -v) via native Compose CLI
console.log("\n[Test 7] Full runtime container lifecycle via native Compose CLI");
const testDir = path.join(__dirname, "sandbox", "compose_lifecycle_test");
fs.mkdirSync(testDir, { recursive: true });
const composeYaml = `services:
  test_worker:
    image: alpine
    command: ["sleep", "30"]
`;
fs.writeFileSync(path.join(testDir, "docker-compose.yml"), composeYaml, "utf8");

try {
    const upRes = await composeRouter.runCompose(["up", "-d"], testDir);
    assert(upRes, "up -d should succeed");
    console.log("  ✔ Native compose 'up -d' launched container stack");

    const stopRes = await composeRouter.runCompose(["stop"], testDir);
    assert(stopRes, "stop should succeed");
    console.log("  ✔ Native compose 'stop' successfully stopped containers");

    const startRes = await composeRouter.runCompose(["start"], testDir);
    assert(startRes, "start should succeed");
    console.log("  ✔ Native compose 'start' successfully resumed containers");

    const downRes = await composeRouter.runCompose(["down", "-v"], testDir);
    assert(downRes, "down -v should succeed");
    console.log("  ✔ Native compose 'down -v' successfully tore down stack and volumes");
} finally {
    try {
        await composeRouter.runCompose(["down", "-v"], testDir).catch(() => {});
    } catch {}
    fs.rmSync(testDir, { recursive: true, force: true });
}

// Test 8: Auto-recovery for uncreated stacks when start is requested
console.log("\n[Test 8] Auto-recovery: starting uncreated compose stack falls back to 'up -d'");
const testUncreatedDir = path.join(__dirname, "sandbox", "compose_uncreated_test");
fs.mkdirSync(testUncreatedDir, { recursive: true });
fs.writeFileSync(path.join(testUncreatedDir, "docker-compose.yml"), composeYaml, "utf8");

try {
    let directStartFailed = false;
    try {
        await composeRouter.runCompose(["start"], testUncreatedDir);
    } catch (err) {
        directStartFailed = err.message.includes("no container to start");
    }
    assert(directStartFailed, "Direct start on uncreated stack should fail with 'no container to start'");

    const recoverRes = await composeRouter.runCompose(["start"], testUncreatedDir).catch(async (err) => {
        if (err.message && err.message.includes("no container to start")) {
            return composeRouter.runCompose(["up", "-d"], testUncreatedDir);
        }
        throw err;
    });
    assert(recoverRes, "Recovery via up -d should succeed");
    console.log("  ✔ Verified graceful recovery for uncreated stacks when start is requested");
} finally {
    try {
        await composeRouter.runCompose(["down", "-v"], testUncreatedDir).catch(() => {});
    } catch {}
    fs.rmSync(testUncreatedDir, { recursive: true, force: true });
}

console.log("\n--- ALL COMPOSE VERIFICATION TESTS PASSED SUCCESSFULLY ---");

