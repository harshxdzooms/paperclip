import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { chmod, mkdtemp, mkdir, realpath, rm, symlink, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { readLocalAiCredentialFile } from "../services/local-ai-credential-file.js";
let home: string;
beforeEach(async () => { home = await realpath(await mkdtemp(path.join(os.tmpdir(), "ai-auth-read-"))); });
afterEach(async () => { await rm(home, { recursive: true, force: true }); });
describe("isolated credential file safety", () => {
  it("reads only bounded private regular files", async () => {
    const filename = path.join(home, "credentials.json");
    await writeFile(filename, "fixture", { mode: 0o600 });
    await expect(readLocalAiCredentialFile(filename)).resolves.toBe("fixture");
    await chmod(filename, 0o644);
    if (process.platform === "win32") await expect(readLocalAiCredentialFile(filename)).resolves.toBe("fixture");
    else await expect(readLocalAiCredentialFile(filename)).rejects.toThrow();
    await chmod(filename, 0o600);
    await writeFile(filename, Buffer.alloc(64 * 1024 + 1));
    await expect(readLocalAiCredentialFile(filename)).rejects.toThrow();
    await expect(readLocalAiCredentialFile(home)).rejects.toThrow();
  });
  it("accepts equivalent Windows path spellings", async () => {
    const filename = path.join(home, "credentials.json");
    await writeFile(filename, "fixture", { mode: 0o600 });
    await expect(readLocalAiCredentialFile(path.join(home, ".", "credentials.json"))).resolves.toBe("fixture");
  });
  it("rejects file and ancestor reparse points", async () => {
    const targetHome = path.join(home, "other-login");
    await mkdir(targetHome);
    await writeFile(path.join(targetHome, "credentials.json"), "other-fixture", { mode: 0o600 });
    await symlink(path.join(targetHome, "credentials.json"), path.join(home, "linked.json"), "file");
    await expect(readLocalAiCredentialFile(path.join(home, "linked.json"))).rejects.toThrow();
    await symlink(targetHome, path.join(home, "linked-home"), "junction");
    await expect(readLocalAiCredentialFile(path.join(home, "linked-home", "credentials.json"))).rejects.toThrow();
  });
});
