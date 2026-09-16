import assert from "node:assert/strict";
import fileRouter from "../routes/file.js";

const {
	getFilteredDrives,
	_resetDrivesCacheForTesting,
	_getCachedDrivesStateForTesting,
	DRIVES_CACHE_TTL_MS,
} = fileRouter;

console.log("--- Running Drive Metrics Caching Verification Tests ---");

// Test 1: First call populates cache
console.log("[Test 1] First call invokes provider and populates cache");
_resetDrivesCacheForTesting();

let callCount = 0;
const mockProvider = async () => {
	callCount++;
	return [
		{ fs: "/dev/sda1", type: "ext4", size: 1000000, used: 500000, mount: "/" },
		{ fs: "tmpfs", type: "tmpfs", size: 500000, used: 10000, mount: "/run" },
		{ fs: "drvfs", type: "drvfs", size: 2000000, used: 1000000, mount: "/mnt/c" },
		{ fs: "none", type: "drvfs", size: 100000, used: 1000, mount: "/mnt/wslg" },
		{ fs: "none", type: "drvfs", size: 100000, used: 1000, mount: "/mnt/wslg/doc.txt" },
	];
};

const drives1 = await getFilteredDrives({ fsSizeFn: mockProvider, ttlMs: 1000 });
assert.equal(callCount, 1, "Expected mock provider to be called once");
assert.equal(drives1.length, 2, "Expected tmpfs and wslg mounts to be filtered out");
assert.deepEqual(
	drives1.map((d) => d.mount),
	["/", "/mnt/c"],
	"Expected only '/' and '/mnt/c' to be returned",
);

const state1 = _getCachedDrivesStateForTesting();
assert.equal(state1.hasCache, true, "Expected cache to be populated");
assert.equal(state1.cachedCount, 2, "Expected 2 cached drives");
console.log("  ✔ Cache populated and virtual filesystems filtered out properly.");

// Test 2: Subsequent call within TTL returns cached result without calling provider
console.log("[Test 2] Cache hit returns data instantly without calling provider");
const drives2 = await getFilteredDrives({ fsSizeFn: mockProvider, ttlMs: 1000 });
assert.equal(callCount, 1, "Expected callCount to still be 1 (cache hit)");
assert.equal(drives1, drives2, "Expected identical array reference from cache");
console.log("  ✔ Cache hit returned instantly with zero shell calls.");

// Test 3: Request coalescing (multiple concurrent calls call provider only once)
console.log("[Test 3] Concurrent requests are coalesced into a single provider call");
_resetDrivesCacheForTesting();
let slowCallCount = 0;
const slowProvider = async () => {
	slowCallCount++;
	await new Promise((r) => setTimeout(r, 50));
	return [{ fs: "/dev/nvme0n1", type: "ext4", size: 5000000, mount: "/data" }];
};

const [resA, resB, resC] = await Promise.all([
	getFilteredDrives({ fsSizeFn: slowProvider, ttlMs: 1000 }),
	getFilteredDrives({ fsSizeFn: slowProvider, ttlMs: 1000 }),
	getFilteredDrives({ fsSizeFn: slowProvider, ttlMs: 1000 }),
]);

assert.equal(slowCallCount, 1, "Expected exactly 1 provider execution across concurrent requests");
assert.equal(resA, resB, "Expected resA and resB to share result");
assert.equal(resB, resC, "Expected resB and resC to share result");
assert.equal(resA[0].mount, "/data");
console.log("  ✔ Concurrent requests coalesced cleanly.");

// Test 4: Force refresh bypasses cache
console.log("[Test 4] Force refresh forces provider invocation");
let refreshCalls = 0;
const refreshProvider = async () => {
	refreshCalls++;
	return [{ fs: "/dev/sda1", type: "ext4", size: 1000, mount: "/" }];
};
_resetDrivesCacheForTesting();
await getFilteredDrives({ fsSizeFn: refreshProvider });
assert.equal(refreshCalls, 1);
await getFilteredDrives({ fsSizeFn: refreshProvider, forceRefresh: true });
assert.equal(refreshCalls, 2, "Expected provider to be invoked again on forceRefresh");
console.log("  ✔ Force refresh successfully bypasses cache.");

// Test 5: Cache expiration after TTL
console.log("[Test 5] Cache expires after TTL elapsed");
_resetDrivesCacheForTesting();
let ttlCalls = 0;
const ttlProvider = async () => {
	ttlCalls++;
	return [{ fs: "/dev/sda1", type: "ext4", size: 1000, mount: "/" }];
};

await getFilteredDrives({ fsSizeFn: ttlProvider, ttlMs: 40 });
assert.equal(ttlCalls, 1);
await new Promise((r) => setTimeout(r, 55)); // wait for TTL to expire
await getFilteredDrives({ fsSizeFn: ttlProvider, ttlMs: 40 });
assert.equal(ttlCalls, 2, "Expected new provider call after TTL expiration");
console.log("  ✔ Cache expired after TTL and refreshed cleanly.");

// Test 6: Real system call verification
console.log("[Test 6] Real system information (si.fsSize) verification");
_resetDrivesCacheForTesting();
const realDrives = await getFilteredDrives();
assert.ok(Array.isArray(realDrives), "Expected real drives to return an array");
console.log(`  ✔ Real system returned ${realDrives.length} drives:`, realDrives.map((d) => `${d.fs} (${d.type}) on ${d.mount}`));

console.log("--- ALL DRIVE METRICS CACHING TESTS PASSED SUCCESSFULLY ---");
