/**
 * Contract lock for the npm package's MCP tool surface.
 *
 * Why it exists: this package is a separate product from the hosted remote
 * server (11 tools, different names such as `barcode_generate`, zod
 * schemas). Without this lock a field name, type or required flag could
 * change without any test failing — and the package is installed many
 * times a week, so a silent break would show up at the user, not here.
 *
 * The measurement is taken FROM THE RUNNING SERVER, not from the source:
 * the server is actually started and `initialize` + `tools/list` are
 * spoken; what is read is exactly the JSON Schema a client sees, including
 * the zod and MCP SDK conversion. Reading the zod expressions in the source
 * would silently go wrong the day the SDK changes its conversion.
 *
 * What is compared is full equality of the recorded shape. Which change is
 * BREAKING and which is ADDITIVE is a product decision; keep it in one
 * place rather than duplicating a classifier here.
 *
 * To refresh the snapshot: the failing test prints the served JSON;
 * writing it to `test/contract.json` is a deliberate manual step — a test
 * that refreshes its own expectation would measure nothing.
 */
import { strict as assert } from "node:assert";
import { spawn } from "node:child_process";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const SERVER = join(HERE, "..", "server.mjs");
const SNAPSHOT = join(HERE, "contract.json");

/** Talks to the server over stdio and returns the `tools/list` result. */
async function listTools() {
  const child = spawn(process.execPath, [SERVER], {
    stdio: ["pipe", "pipe", "pipe"],
    // No key on purpose: the list must not depend on identity. A key
    // leaking in from the environment would tie the measurement to a machine.
    env: { ...process.env, LABELIXA_API_KEY: "" },
  });
  const send = (o) => child.stdin.write(JSON.stringify(o) + "\n");

  let buffer = "";
  const result = new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      child.kill();
      reject(new Error("server did not answer tools/list within 15 s"));
    }, 15000);
    child.stdout.on("data", (chunk) => {
      buffer += chunk.toString();
      let n;
      while ((n = buffer.indexOf("\n")) >= 0) {
        const line = buffer.slice(0, n).trim();
        buffer = buffer.slice(n + 1);
        if (!line) continue;
        let msg;
        try { msg = JSON.parse(line); } catch { continue; }
        if (msg.id === 2) {
          clearTimeout(timer);
          child.kill();
          resolve(msg.result?.tools ?? []);
        }
      }
    });
    child.on("error", reject);
  });

  send({ jsonrpc: "2.0", id: 1, method: "initialize",
         params: { protocolVersion: "2024-11-05", capabilities: {},
                   clientInfo: { name: "contract-lock", version: "1" } } });
  send({ jsonrpc: "2.0", method: "notifications/initialized" });
  send({ jsonrpc: "2.0", id: 2, method: "tools/list", params: {} });
  return result;
}

/**
 * Reduces a served tool to a comparable record.
 *
 * Kept: field names, types, the `enum` SET, the `required` set.
 * Dropped: description prose and field order — prose produces an
 * unreadable snapshot without changing the schema, and order is not part
 * of the contract.
 */
function record(tool) {
  const schema = tool.inputSchema ?? {};
  const properties = schema.properties ?? {};
  const fields = {};
  for (const name of Object.keys(properties).sort()) {
    const p = properties[name] ?? {};
    const f = { type: p.type ?? (p.anyOf ? "anyOf" : "") };
    if (Array.isArray(p.enum)) f.enum = p.enum.map(String).sort();
    fields[name] = f;
  }
  return { fields, required: [...(schema.required ?? [])].sort() };
}

function contract(tools) {
  const out = {};
  for (const t of [...tools].sort((x, y) => x.name < y.name ? -1 : 1)) {
    out[t.name] = record(t);
  }
  return out;
}

test("served contract is IDENTICAL to the snapshot", async () => {
  const today = contract(await listTools());
  const expected = JSON.parse(readFileSync(SNAPSHOT, "utf8"));

  const missing = Object.keys(expected).filter((t) => !(t in today));
  const extra = Object.keys(today).filter((t) => !(t in expected));
  assert.deepEqual(
    { missing, extra }, { missing: [], extra: [] },
    "the tool list changed — a REMOVED tool is a BREAKING change");

  for (const name of Object.keys(expected)) {
    assert.deepEqual(
      today[name], expected[name],
      `\nThe input schema of '${name}' changed.\n` +
      `If intended, update test/contract.json so the change is VISIBLE ` +
      `in the PR diff.\n` +
      `today:    ${JSON.stringify(today[name])}\n` +
      `expected: ${JSON.stringify(expected[name])}\n`);
  }
});

test("snapshot is NOT EMPTY and covers 11 tools", () => {
  const expected = JSON.parse(readFileSync(SNAPSHOT, "utf8"));
  // An empty snapshot would be a green test that measures nothing: the loop
  // above runs zero times and the 'missing' list is empty too.
  assert.equal(Object.keys(expected).length, 11);
  for (const entry of Object.values(expected)) {
    assert.ok(Object.keys(entry.fields).length > 0);
  }
});

test("snapshot carries no description PROSE", () => {
  const raw = readFileSync(SNAPSHOT, "utf8");
  // Prose would make the file unreadable and every wording fix a huge diff
  // in which a real schema change goes unnoticed.
  assert.ok(!raw.includes("SERVER-SIDE"), "description text leaked");
  assert.ok(!raw.includes("describe"), "zod expression leaked");
});

test("not to be mistaken for the remote server: names differ on purpose", () => {
  const expected = JSON.parse(readFileSync(SNAPSHOT, "utf8"));
  // The remote server (21 tools) exposes `barcode_png`, this package
  // `barcode_generate`. Two SEPARATE products; directory listings and
  // documentation describe them accordingly.
  assert.ok("barcode_generate" in expected);
  assert.ok(!("barcode_png" in expected));
});
