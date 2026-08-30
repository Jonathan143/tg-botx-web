#!/usr/bin/env node

import { execFileSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const packagePath = resolve(projectRoot, "package.json");
const remote = process.env.RELEASE_REMOTE || "origin";
const rawArgs = process.argv.slice(2);
const dryRun = rawArgs.includes("--dry-run");
const versionSpec = rawArgs.find((arg) => !arg.startsWith("--")) || "patch";

const semverPattern =
  /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-([0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*))?(?:\+([0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*))?$/;

function runGit(args, options = {}) {
  const output = execFileSync("git", args, {
    cwd: projectRoot,
    encoding: "utf8",
    stdio: options.capture ? ["ignore", "pipe", "pipe"] : "inherit",
  });

  return typeof output === "string" ? output.trim() : "";
}

function gitRefExists(ref) {
  try {
    execFileSync("git", ["rev-parse", "--verify", "--quiet", ref], {
      cwd: projectRoot,
      stdio: "ignore",
    });
    return true;
  } catch {
    return false;
  }
}

function parseVersion(version) {
  const match = semverPattern.exec(version);
  if (!match) {
    throw new Error(`package.json 中的版本号无效：${version}`);
  }

  return {
    major: Number(match[1]),
    minor: Number(match[2]),
    patch: Number(match[3]),
  };
}

function getNextVersion(currentVersion, spec) {
  if (spec === "major" || spec === "minor" || spec === "patch") {
    const current = parseVersion(currentVersion);
    const next = { ...current };

    if (spec === "major") {
      next.major += 1;
      next.minor = 0;
      next.patch = 0;
    } else if (spec === "minor") {
      next.minor += 1;
      next.patch = 0;
    } else {
      next.patch += 1;
    }

    return `${next.major}.${next.minor}.${next.patch}`;
  }

  const explicitVersion = spec.replace(/^v/, "");
  if (!semverPattern.test(explicitVersion)) {
    throw new Error(`版本参数无效：${spec}。请使用 major、minor、patch 或完整的 semver 版本号。`);
  }

  return explicitVersion;
}

function printPlan(currentVersion, nextVersion, branch, tag) {
  console.log(`版本：${currentVersion} -> ${nextVersion}`);
  console.log(`分支：${branch}`);
  console.log(`远端：${remote}`);
  console.log(`标签：${tag}`);
  console.log("将执行：更新 package.json、提交全部工作区改动、推送分支、创建并推送 tag");
}

function main() {
  const packageJson = JSON.parse(readFileSync(packagePath, "utf8"));
  const currentVersion = packageJson.version;
  if (typeof currentVersion !== "string") {
    throw new Error("package.json 缺少有效的 version 字段。");
  }

  const nextVersion = getNextVersion(currentVersion, versionSpec);
  if (nextVersion === currentVersion) {
    throw new Error(`新版本与当前版本相同：${currentVersion}`);
  }

  let branch;
  try {
    branch = runGit(["symbolic-ref", "--quiet", "--short", "HEAD"], {
      capture: true,
    });
  } catch {
    throw new Error("当前处于 detached HEAD，无法推送分支。");
  }
  if (!branch) {
    throw new Error("当前处于 detached HEAD，无法推送分支。");
  }

  const tag = `v${nextVersion}`;
  if (gitRefExists(`refs/tags/${tag}`)) {
    throw new Error(`标签已存在：${tag}。为避免覆盖，发布已终止。`);
  }

  printPlan(currentVersion, nextVersion, branch, tag);
  if (dryRun) {
    console.log("试运行结束，未修改文件或执行远端操作。");
    return;
  }

  try {
    runGit(["remote", "get-url", remote], { capture: true });
  } catch {
    throw new Error(`找不到 Git 远端：${remote}`);
  }

  packageJson.version = nextVersion;
  writeFileSync(packagePath, `${JSON.stringify(packageJson, null, 2)}\n`);

  // Deliberately stage all changes so the release commit contains the code
  // being released as well as the version update.
  runGit(["add", "--all"]);
  runGit(["commit", "-m", `chore(release): ${tag}`]);
  runGit(["push", remote, branch]);
  runGit(["tag", "--annotate", tag, "--message", `Release ${tag}`]);
  runGit(["push", remote, tag]);

  console.log(`发布完成：${tag}`);
}

try {
  main();
} catch (error) {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`发布失败：${message}`);
  process.exitCode = 1;
}
