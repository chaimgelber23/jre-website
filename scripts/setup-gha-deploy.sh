#!/usr/bin/env bash
# Set up GitHub Actions + Mac Mini self-hosted runner for a Vercel project.
#
# Usage:  ./setup-gha-deploy.sh <local-project-path>
# Example: ./setup-gha-deploy.sh "c:/Users/chaim/seo-business"
#
# Requires: gh (authenticated), jq, ssh mac-mini alias, $VERCEL_TOKEN env var.
#
# What it does (per project):
#   1. Reads projectId + orgId from <path>/.vercel/project.json
#   2. Sets Vercel's Ignored Build Step to `exit 0` (Vercel stops building on push)
#   3. Sets 3 GitHub repo secrets: VERCEL_TOKEN, VERCEL_ORG_ID, VERCEL_PROJECT_ID
#   4. Writes .github/workflows/deploy.yml pointing at the mac-mini runner
#   5. Registers a fresh self-hosted runner on Mac Mini at ~/actions-runner-<slug>/
#   6. Commits + pushes the workflow — first deploy runs on Mac Mini

set -euo pipefail

PROJECT_PATH="${1:?usage: $0 <local-project-path>}"
PROJECT_PATH="$(cd "$PROJECT_PATH" && pwd)"
cd "$PROJECT_PATH"

: "${VERCEL_TOKEN:?VERCEL_TOKEN env var must be set}"

if [[ ! -f .vercel/project.json ]]; then
  echo "ERROR: $PROJECT_PATH has no .vercel/project.json — run 'vercel link' there first." >&2
  exit 1
fi

VERCEL_PROJECT_ID=$(node -e "console.log(require('./.vercel/project.json').projectId)")
VERCEL_ORG_ID=$(node -e "console.log(require('./.vercel/project.json').orgId)")
GITHUB_REPO=$(git remote get-url origin | sed 's|https://github.com/||;s|\.git$||;s|git@github.com:||')
SLUG=$(basename "$PROJECT_PATH" | tr '[:upper:] ' '[:lower:]-' | tr -cd 'a-z0-9-')
RUNNER_DIR="actions-runner-$SLUG"
# Detect default branch (main vs master) — ask GitHub directly for reliability
DEFAULT_BRANCH=$(gh api "repos/$GITHUB_REPO" --jq .default_branch 2>/dev/null || echo "main")
[[ -z "$DEFAULT_BRANCH" ]] && DEFAULT_BRANCH="main"

echo "=== $GITHUB_REPO ==="
echo "  path:        $PROJECT_PATH"
echo "  project_id:  $VERCEL_PROJECT_ID"
echo "  org_id:      $VERCEL_ORG_ID"
echo "  runner dir:  ~/$RUNNER_DIR"

# 1. Neutralize Vercel's auto-build
echo "→ setting Vercel Ignored Build Step to 'exit 0'..."
curl -sf -X PATCH "https://api.vercel.com/v9/projects/$VERCEL_PROJECT_ID?teamId=$VERCEL_ORG_ID" \
  -H "Authorization: Bearer $VERCEL_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"commandForIgnoringBuildStep":"exit 0"}' > /dev/null
echo "  ✓ Vercel auto-build disabled"

# 2. Set GitHub secrets
echo "→ setting GitHub secrets..."
echo "$VERCEL_TOKEN"      | gh secret set VERCEL_TOKEN      --repo "$GITHUB_REPO"
echo "$VERCEL_ORG_ID"     | gh secret set VERCEL_ORG_ID     --repo "$GITHUB_REPO"
echo "$VERCEL_PROJECT_ID" | gh secret set VERCEL_PROJECT_ID --repo "$GITHUB_REPO"
echo "  ✓ 3 secrets set"

# 3. Write workflow file
echo "→ writing .github/workflows/deploy.yml..."
mkdir -p .github/workflows
cat > .github/workflows/deploy.yml <<'YAML'
name: Deploy to Vercel (prebuilt)

on:
  push:
    branches: [__DEFAULT_BRANCH__]
  workflow_dispatch:

concurrency:
  group: deploy-prod
  cancel-in-progress: true

jobs:
  deploy:
    runs-on: [self-hosted, mac-mini]
    env:
      VERCEL_ORG_ID: ${{ secrets.VERCEL_ORG_ID }}
      VERCEL_PROJECT_ID: ${{ secrets.VERCEL_PROJECT_ID }}
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: "20"
          cache: npm
      - run: npm install -g vercel@latest
      - run: vercel pull --yes --environment=production --token=${{ secrets.VERCEL_TOKEN }}
      - run: vercel build --prod --token=${{ secrets.VERCEL_TOKEN }}
      - run: vercel deploy --prebuilt --prod --archive=tgz --token=${{ secrets.VERCEL_TOKEN }}
YAML
# Substitute default branch name (avoids heredoc shell interpolation conflicts with ${{ }})
sed -i "s/__DEFAULT_BRANCH__/$DEFAULT_BRANCH/g" .github/workflows/deploy.yml
echo "  ✓ workflow file written"

# 4. Register a fresh Mac Mini runner for this repo
echo "→ registering Mac Mini runner..."
RUNNER_TOKEN=$(gh api --method POST "repos/$GITHUB_REPO/actions/runners/registration-token" --jq '.token')

ssh mac-mini "
  set -e
  if [ -d ~/$RUNNER_DIR ]; then
    cd ~/$RUNNER_DIR
    ./svc.sh stop 2>/dev/null || true
    ./svc.sh uninstall 2>/dev/null || true
    cd ~ && rm -rf ~/$RUNNER_DIR
  fi
  mkdir -p ~/$RUNNER_DIR && cd ~/$RUNNER_DIR
  curl -sL -o r.tar.gz https://github.com/actions/runner/releases/download/v2.333.1/actions-runner-osx-arm64-2.333.1.tar.gz
  tar xzf r.tar.gz && rm r.tar.gz
  echo 'PATH=/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin:/usr/sbin:/sbin' > .env
  ./config.sh --url https://github.com/$GITHUB_REPO --token $RUNNER_TOKEN --name mac-mini-$SLUG --labels mac-mini,macos-arm64 --work _work --unattended --replace > /tmp/runner-config.log 2>&1
  ./svc.sh install > /dev/null
  ./svc.sh start > /dev/null
"
echo "  ✓ mac-mini-$SLUG runner online"

# 5. Commit + push the workflow
echo "→ committing + pushing workflow..."
git add .github/workflows/deploy.yml
if git diff --cached --quiet; then
  echo "  (workflow already in repo, skipping commit)"
else
  git commit -m "ci: GHA deploy to Vercel via Mac Mini runner

Prebuilt artifact deploy — zero Vercel build minutes consumed.
Runner: mac-mini-$SLUG

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>" > /dev/null
  git push origin "$DEFAULT_BRANCH" > /dev/null 2>&1
  echo "  ✓ pushed"
fi

echo
echo "✅ $GITHUB_REPO set up. Watch the deploy:"
echo "   gh run list --limit 1 --repo $GITHUB_REPO"
