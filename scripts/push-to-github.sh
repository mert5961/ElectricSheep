#!/usr/bin/env bash
# Creates the ElectricSheep repo on your GitHub and pushes this project.
# Usage: GITHUB_TOKEN=your_token ./scripts/push-to-github.sh
# Get a token: https://github.com/settings/tokens (scope: repo)

set -e
REPO_NAME="ElectricSheep"
USER="mert5961"
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

if [ -z "$GITHUB_TOKEN" ]; then
  echo "Missing GITHUB_TOKEN."
  echo "1. Create a token: https://github.com/settings/tokens (check 'repo')"
  echo "2. Run: GITHUB_TOKEN=your_token ./scripts/push-to-github.sh"
  exit 1
fi

# Create repo if it doesn't exist (ignore 422 = already exists)
echo "Creating repository $USER/$REPO_NAME on GitHub..."
HTTP=$(curl -s -o /dev/null -w "%{http_code}" -X POST \
  -H "Authorization: token $GITHUB_TOKEN" \
  -H "Accept: application/vnd.github.v3+json" \
  https://api.github.com/user/repos \
  -d "{\"name\":\"$REPO_NAME\",\"description\":\"Web-based projection mapping and AI-driven visual orchestration\",\"private\":false}")

if [ "$HTTP" = "201" ]; then
  echo "Repository created."
elif [ "$HTTP" = "422" ]; then
  echo "Repository already exists, continuing."
else
  echo "Unexpected response: $HTTP. Check your token and try again."
  exit 1
fi

# Push using token for auth
echo "Pushing to origin main..."
git remote set-url origin "https://${GITHUB_TOKEN}@github.com/${USER}/${REPO_NAME}.git"
git push -u origin main

# Leave remote as HTTPS without token in URL
git remote set-url origin "https://github.com/${USER}/${REPO_NAME}.git"

echo "Done. Repo: https://github.com/$USER/$REPO_NAME"
