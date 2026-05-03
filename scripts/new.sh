#!/usr/bin/env bash
set -euo pipefail

TITLE="${1:-}"
TYPE="${2:-vanilla}"
REPO="$(cd "$(dirname "$0")/.." && pwd)"
SYNAPSE="/Users/hersonguerrerohuh/Development/GitHub/Synapse"
JOURNAL="$SYNAPSE/calendar notes/creative coding journal"

VALID_TYPES="p5 three webgpu vanilla"

usage() {
  echo "Usage: ./scripts/new.sh \"Project Title\" [p5|three|webgpu|vanilla]"
  echo "       types: $VALID_TYPES"
  exit 1
}

[ -z "$TITLE" ] && usage
echo "$VALID_TYPES" | grep -qw "$TYPE" || { echo "Unknown type: $TYPE"; usage; }

YEAR=$(date +%Y)
WEEK=$(date +%V)
SLUG=$(echo "$TITLE" | tr '[:upper:]' '[:lower:]' | tr -cs 'a-z0-9' '-' | sed 's/^-//;s/-$//')
DIR="${YEAR}-W${WEEK}-${SLUG}"
PROJECT_DIR="$REPO/projects/$DIR"

if [ -d "$PROJECT_DIR" ]; then
  echo "Already exists: projects/$DIR"
  exit 1
fi

# Create project from template
cp -r "$REPO/templates/$TYPE" "$PROJECT_DIR"

# Stamp title into the template
sed -i '' "s/{{TITLE}}/$TITLE/g" "$PROJECT_DIR/index.html"

# Update projects.json
DATE=$(date +%Y-%m-%d)
node - <<EOF
const fs = require('fs');
const path = '$REPO/projects.json';
const data = JSON.parse(fs.readFileSync(path, 'utf8'));
data.projects.unshift({
  slug: '$DIR',
  title: '$TITLE',
  week: '${YEAR}-W${WEEK}',
  date: '$DATE',
  type: '$TYPE',
  description: ''
});
fs.writeFileSync(path, JSON.stringify(data, null, 2) + '\n');
EOF

# Create journal entry if it doesn't exist
JOURNAL_DIR="$JOURNAL/$YEAR/Week $WEEK"
JOURNAL_FILE="$JOURNAL_DIR/${YEAR}-W${WEEK}.md"
mkdir -p "$JOURNAL_DIR"

if [ ! -f "$JOURNAL_FILE" ]; then
  cat > "$JOURNAL_FILE" <<MDEOF
---
week: ${YEAR}-W${WEEK}
project: $TITLE
type: $TYPE
repo: creative-coding/projects/$DIR
---

## Concept


## Process


## Outcome

MDEOF
  JOURNAL_STATUS="created"
else
  JOURNAL_STATUS="exists"
fi

echo ""
echo "  sketch  →  projects/$DIR/"
echo "  type    →  $TYPE"
echo "  journal →  calendar notes/creative coding journal/$YEAR/Week $WEEK/${YEAR}-W${WEEK}.md ($JOURNAL_STATUS)"
echo ""
echo "  npm start  then open  http://localhost:3000/projects/$DIR/"
echo ""
