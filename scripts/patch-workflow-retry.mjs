#!/usr/bin/env node
// Patch a deploy.yml workflow to add retry logic around `vercel deploy --prebuilt`.
// Usage: node patch-workflow-retry.mjs <path-to-deploy.yml>
import { readFileSync, writeFileSync } from "node:fs";

const path = process.argv[2];
if (!path) { console.error("usage: node patch-workflow-retry.mjs <path>"); process.exit(1); }
const src = readFileSync(path, "utf8");

const newBlock = `      - name: Deploy prebuilt output (retry up to 3x)
        shell: bash
        env:
          VERCEL_TOKEN: \${{ secrets.VERCEL_TOKEN }}
        run: |
          set +e
          for i in 1 2 3; do
            vercel deploy --prebuilt --prod --archive=tgz --token="$VERCEL_TOKEN" && exit 0
            echo "::warning::deploy attempt $i failed; retrying in 30s"
            sleep 30
          done
          exit 1`;

// Match either of the known shapes:
//   "      - run: vercel deploy ..."
//   "      - name: Deploy prebuilt output\n        run: vercel deploy ..."
const re = /      - (?:name: Deploy prebuilt output\n        )?run: vercel deploy --prebuilt --prod --archive=tgz --token=\$\{\{ secrets\.VERCEL_TOKEN \}\}/;

if (!re.test(src)) { console.log("NO-MATCH"); process.exit(0); }
if (src.includes("Deploy prebuilt output (retry up to 3x)")) { console.log("ALREADY-PATCHED"); process.exit(0); }

writeFileSync(path, src.replace(re, newBlock));
console.log("OK");
