/**
 * Creates the draft GitHub release before electron-builder runs.
 *
 * electron-builder uploads artifacts in parallel, and each upload asks
 * "does a release exist for this version?" at the same time. When none
 * does, they both create one and the assets end up split across two
 * drafts. Making the draft up front means every upload finds it.
 */

import { readFileSync } from "node:fs";
import { fileURLToPath, pathToFileURL } from "node:url";
import { dirname, join } from "node:path";

const API = process.env.GITHUB_API ?? "https://api.github.com";

export async function ensureDraftRelease({ owner, repo, version, token, fetchImpl = fetch }) {
  const tag = `v${version}`;

  const headers = {
    accept: "application/vnd.github+json",
    authorization: `Bearer ${token}`,
    "user-agent": `${repo}-release-script`,
    "x-github-api-version": "2022-11-28"
  };

  const listed = await fetchImpl(`${API}/repos/${owner}/${repo}/releases?per_page=100`, { headers });
  if (!listed.ok) {
    throw new Error(`Could not list releases (${listed.status} ${listed.statusText})`);
  }

  const releases = await listed.json();
  const existing = releases.find(release => release.tag_name === tag || release.tag_name === version);

  if (existing) {
    return { created: false, draft: existing.draft, tag, url: existing.html_url };
  }

  const created = await fetchImpl(`${API}/repos/${owner}/${repo}/releases`, {
    method: "POST",
    headers: { ...headers, "content-type": "application/json" },
    body: JSON.stringify({ tag_name: tag, name: tag, draft: true })
  });

  if (!created.ok) {
    throw new Error(`Could not create the draft release (${created.status} ${created.statusText})`);
  }

  const release = await created.json();
  return { created: true, draft: true, tag, url: release.html_url };
}

async function main() {
  const root = join(dirname(fileURLToPath(import.meta.url)), "..");
  const pkg = JSON.parse(readFileSync(join(root, "package.json"), "utf8"));

  const target = (Array.isArray(pkg.build?.publish) ? pkg.build.publish : [pkg.build?.publish])
    .find(entry => entry?.provider === "github");

  if (!target) throw new Error("No GitHub publish target in package.json");

  const token = process.env.GH_TOKEN ?? process.env.GITHUB_TOKEN;
  if (!token) {
    throw new Error('GH_TOKEN is not set. In PowerShell: $env:GH_TOKEN = "your token"');
  }

  const result = await ensureDraftRelease({
    owner: target.owner,
    repo: target.repo,
    version: pkg.version,
    token
  });

  if (result.created) console.log(`Created draft release ${result.tag}`);
  else if (result.draft) console.log(`Draft release ${result.tag} already exists, reusing it`);
  else console.log(`Release ${result.tag} is already published, uploading into it`);
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch(error => {
    console.error(error.message);
    process.exit(1);
  });
}
