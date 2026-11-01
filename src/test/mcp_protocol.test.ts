import { describe, it } from "node:test";
import * as assert from "node:assert/strict";
import { spawn } from "node:child_process";
import * as os from "node:os";
import * as path from "node:path";

describe("MCP JSON-RPC Protocol Transport", () => {
  it("should respond to tools/list and tools/call over stdio", async () => {
    const serverPath = path.resolve("dist/index.js");
    const serverProcess = spawn("node", [serverPath], {
      stdio: ["pipe", "pipe", "pipe"],
    });

    let buffer = "";
    const responses: any[] = [];

    serverProcess.stdout.on("data", (chunk) => {
      buffer += chunk.toString();
      const lines = buffer.split("\n");
      buffer = lines.pop() || "";
      for (const line of lines) {
        if (line.trim()) {
          try {
            responses.push(JSON.parse(line.trim()));
          } catch {
            // Ignore non-json logs
          }
        }
      }
    });

    const waitForResponse = async (id: number, timeoutMs = 3000) => {
      const start = Date.now();
      while (Date.now() - start < timeoutMs) {
        const found = responses.find((r) => r.id === id);
        if (found) return found;
        await new Promise((resolve) => setTimeout(resolve, 50));
      }
      return responses.find((r) => r.id === id);
    };

    // Send initialize request
    const initRequest = {
      jsonrpc: "2.0",
      id: 1,
      method: "initialize",
      params: {
        protocolVersion: "2024-11-05",
        capabilities: {},
        clientInfo: { name: "test-client", version: "1.0.0" },
      },
    };

    serverProcess.stdin.write(JSON.stringify(initRequest) + "\n");
    await waitForResponse(1);

    // Send tools/list request
    const listRequest = {
      jsonrpc: "2.0",
      id: 2,
      method: "tools/list",
      params: {},
    };

    serverProcess.stdin.write(JSON.stringify(listRequest) + "\n");
    const listResp = await waitForResponse(2);

    // Send tools/call request
    const tempProj = path.join(os.tmpdir(), "mcp_rpc_test_" + Date.now(), "RpcProj");
    const callRequest = {
      jsonrpc: "2.0",
      id: 3,
      method: "tools/call",
      params: {
        name: "mineimator_create_project",
        arguments: {
          project_path: tempProj,
          name: "RPC Test Project",
        },
      },
    };

    serverProcess.stdin.write(JSON.stringify(callRequest) + "\n");
    const callResp = await waitForResponse(3);

    serverProcess.kill();

    assert.equal(typeof listResp, "object");
    assert.equal(Array.isArray(listResp?.result?.tools), true);
    assert.equal(listResp?.result?.tools.length, 36);

    assert.equal(typeof callResp, "object");
    assert.equal(Array.isArray(callResp?.result?.content), true);
    const text = callResp?.result?.content[0]?.text;
    assert.equal(text.includes("RPC Test Project"), true);
  });
});
