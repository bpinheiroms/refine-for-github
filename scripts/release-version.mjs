// The next release version, from the Conventional Commits merged since the last `v*` tag
// (adapted from BridgLabs/opencodereview).
//
//   node scripts/release-version.mjs              Prints the next version, or nothing when no
//                                                 commit since the last tag changes what users run.
//   node scripts/release-version.mjs set X.Y.Z    Writes X.Y.Z into extension/manifest.json.
//
// feat → minor, fix/perf/revert → patch, `!` or BREAKING CHANGE → major. Other types (build,
// chore, ci, docs, refactor, style, test) release nothing on their own, and neither do the
// `release:` commits the Release workflow makes. Without a tag yet, the base is the version in
// extension/manifest.json. RELEASE_BUMP=patch, minor or major raises the bump to at least that
// level, even with nothing releasable.
import { spawnSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";

const MANIFEST = "extension/manifest.json";
const STRICT = /^v\d+\.\d+\.\d+$/;

if (process.argv[2] === "set") {
  const version = process.argv[3] ?? "";
  if (!STRICT.test(`v${version}`)) throw new Error(`not an X.Y.Z version: "${version}"`);
  // Only the version line changes, so the release commit keeps the manifest's formatting.
  const text = readFileSync(MANIFEST, "utf8");
  const next = text.replace(/("version":\s*")[^"]*(")/, `$1${version}$2`);
  if (JSON.parse(next).version !== version) throw new Error(`could not set the version in ${MANIFEST}`);
  writeFileSync(MANIFEST, next);
  process.exit(0);
}

const git = (...args) => spawnSync("git", args, { encoding: "utf8" }).stdout.trim();

// Last release tag reachable from HEAD. Only strict vX.Y.Z tags count: a pre-release tag such as
// v1.2.0-rc1 would otherwise become the base and give a NaN version.
const last = git("tag", "--merged", "HEAD", "--sort=-v:refname").split("\n").find((tag) => STRICT.test(tag)) ?? "";
const commits = git("log", last ? `${last}..HEAD` : "HEAD", "--format=%s%x1f%b%x1e")
  .split("\x1e")
  .map((entry) => entry.trim())
  .filter(Boolean)
  .map((entry) => {
    const [subject, body = ""] = entry.split("\x1f");
    const match = subject.match(/^(\w+)(\([^)]*\))?(!)?: (.+)$/);
    return { type: match?.[1] ?? "", breaking: Boolean(match?.[3]) || /^\s*BREAKING[ -]CHANGE:/m.test(body) };
  })
  .filter((commit) => commit.type !== "release");

const rank = (c) => (c.breaking ? 3 : c.type === "feat" ? 2 : ["fix", "perf", "revert"].includes(c.type) ? 1 : 0);
const forced = { patch: 1, minor: 2, major: 3 }[process.env.RELEASE_BUMP] ?? 0;
const bump = Math.max(forced, ...commits.map(rank));
if (!bump) process.exit(0);

const base = last ? last.slice(1) : JSON.parse(readFileSync(MANIFEST, "utf8")).version;
let [major, minor, patch] = base.split(".").map(Number);
if (bump === 3) [major, minor, patch] = [major + 1, 0, 0];
else if (bump === 2) [minor, patch] = [minor + 1, 0];
else patch += 1;
console.log(`${major}.${minor}.${patch}`);
