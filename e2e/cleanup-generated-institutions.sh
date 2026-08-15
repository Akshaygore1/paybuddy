#!/usr/bin/env bash

set -euo pipefail

SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd -- "$SCRIPT_DIR/.." && pwd)"
DB_DIR="$REPO_ROOT/.alchemy/miniflare/v3/d1/miniflare-D1DatabaseObject"
REPORT_PATH="$REPO_ROOT/e2e/.cleanup/generated-institutions.json"
MODE="dry-run"
MODE_SET=0

usage() {
  cat <<'HELP'
Usage:
  bash e2e/cleanup-generated-institutions.sh --dry-run [--report <path>]
  bash e2e/cleanup-generated-institutions.sh --execute [--report <path>]

The default is --dry-run. --execute requires a reviewed report and deletes only
institutions matching the generated [run-...] name and inst_run... username markers.
HELP
}

fail() {
  echo "cleanup: $*" >&2
  exit 1
}

set_mode() {
  if ((MODE_SET)); then
    fail "choose exactly one of --dry-run or --execute"
  fi
  MODE_SET=1
}

while (($# > 0)); do
  case "$1" in
    --dry-run)
      set_mode
      MODE="dry-run"
      ;;
    --execute)
      set_mode
      MODE="execute"
      ;;
    --report)
      shift
      [[ $# -gt 0 ]] || fail "--report requires a path"
      REPORT_PATH="$1"
      ;;
    --help|-h)
      usage
      exit 0
      ;;
    *)
      fail "unknown option: $1"
      ;;
  esac
  shift
done

if [[ "$REPORT_PATH" != /* ]]; then
  REPORT_PATH="$REPO_ROOT/$REPORT_PATH"
fi

command -v sqlite3 >/dev/null 2>&1 || fail "sqlite3 is required"
command -v jq >/dev/null 2>&1 || fail "jq is required"

if command -v shasum >/dev/null 2>&1; then
  HASH_COMMAND=(shasum -a 256)
elif command -v sha256sum >/dev/null 2>&1; then
  HASH_COMMAND=(sha256sum)
else
  fail "shasum or sha256sum is required"
fi

if [[ ! -d "$DB_DIR" ]]; then
  fail "local D1 directory not found: $DB_DIR"
fi

DB_FILES=()
while IFS= read -r database_file; do
  DB_FILES+=("$database_file")
done < <(find "$DB_DIR" -maxdepth 1 -type f -name '*.sqlite' -print)

if ((${#DB_FILES[@]} != 1)); then
  fail "expected exactly one local D1 database, found ${#DB_FILES[@]}"
fi

DB_PATH="${DB_FILES[0]}"

TARGET_FROM="FROM institutions i
JOIN user u ON u.id = i.user_id
WHERE lower(i.name) LIKE '%[run-%'
  AND lower(coalesce(u.username, '')) LIKE 'inst_run%'"

hash_lines() {
  awk 'NR > 1 { printf "\n" } { printf "%s", $0 }' \
    | "${HASH_COMMAND[@]}" \
    | awk '{print $1}'
}

query_records() {
  sqlite3 -json "$DB_PATH" "
    SELECT
      i.id AS institutionId,
      u.id AS userId,
      i.name AS name,
      i.tan_number AS tanNumber,
      u.username AS username
    $TARGET_FROM
    ORDER BY i.id;
  "
}

query_hash() {
  sqlite3 -noheader -separator $'\x1f' "$DB_PATH" "
    SELECT i.id, u.id, i.name, i.tan_number, coalesce(u.username, '')
    $TARGET_FROM
    ORDER BY i.id;
  " | hash_lines
}

report_hash() {
  jq -r '.records[] | [.institutionId, .userId, .name, .tanNumber, .username] | join("\u001f")' \
    "$REPORT_PATH" \
    | hash_lines
}

write_report() {
  local records matched_count report_hash
  records="$(query_records)"
  records="${records:-[]}"
  matched_count="$(jq 'length' <<<"$records")"
  report_hash="$(query_hash)"

  mkdir -p "$(dirname "$REPORT_PATH")"
  jq -n \
    --arg generatedAt "$(date -u '+%Y-%m-%dT%H:%M:%SZ')" \
    --arg marker "run-" \
    --arg reportHash "$report_hash" \
    --argjson matchedCount "$matched_count" \
    --argjson records "$records" \
    '{generatedAt: $generatedAt, marker: $marker, matchedCount: $matchedCount, reportHash: $reportHash, records: $records}' \
    >"$REPORT_PATH"

  echo "E2E cleanup dry-run: $matched_count generated institutions matched marker \"run-\"."
  echo "Report: $REPORT_PATH"
  echo "Report hash: $report_hash"
  echo "Deletion was not attempted."
}

if [[ "$MODE" == "dry-run" ]]; then
  write_report
  exit 0
fi

[[ -f "$REPORT_PATH" ]] || fail "report not found: $REPORT_PATH"

if ! jq -e '
  .marker == "run-" and
  (.records | type) == "array" and
  .matchedCount == (.records | length) and
  (.reportHash | type) == "string" and
  (.records | all(.[]; .institutionId != null and .userId != null and .username != null)) and
  ((.records | map(.institutionId) | length) == (.records | map(.institutionId) | unique | length)) and
  ((.records | map(.userId) | length) == (.records | map(.userId) | unique | length))
' "$REPORT_PATH" >/dev/null; then
  fail "report is invalid or does not use the exact run- marker"
fi

REPORT_HASH="$(jq -r '.reportHash' "$REPORT_PATH")"
REPORT_RECORDS_HASH="$(report_hash)"
if [[ "$REPORT_RECORDS_HASH" != "$REPORT_HASH" ]]; then
  fail "report hash does not match the report records"
fi

CURRENT_HASH="$(query_hash)"
if [[ "$CURRENT_HASH" != "$REPORT_HASH" ]]; then
  fail "current marker-filtered records differ from the reviewed report hash"
fi

TEMP_DIR="$(mktemp -d "${TMPDIR:-/tmp}/e2e-cleanup.XXXXXX")"
trap 'rm -rf "$TEMP_DIR"' EXIT
REPORT_RECORDS_FILE="$TEMP_DIR/report-records.tsv"

jq -r '.records[] | [.institutionId, .userId, .name, .tanNumber, .username] | @tsv' \
  "$REPORT_PATH" >"$REPORT_RECORDS_FILE"

echo "cleanup: report hash matches the current local marker-filtered records"
echo "cleanup: acquiring the database lock and revalidating the full record set"

sqlite3 "$DB_PATH" <<SQL
.bail on
PRAGMA foreign_keys = ON;

CREATE TEMP TABLE report_targets (
  institution_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  name TEXT NOT NULL,
  tan_number TEXT NOT NULL,
  username TEXT NOT NULL,
  UNIQUE (institution_id),
  UNIQUE (user_id)
);

.mode tabs
.import "$REPORT_RECORDS_FILE" report_targets

BEGIN IMMEDIATE;

CREATE TEMP TABLE cleanup_targets AS
SELECT
  i.id AS institution_id,
  i.user_id,
  i.name,
  i.tan_number,
  u.username
$TARGET_FROM;

CREATE TEMP TABLE cleanup_assertion (
  ok INTEGER NOT NULL CHECK (ok = 1)
);

INSERT INTO cleanup_assertion(ok)
SELECT CASE
  WHEN (SELECT count(*) FROM cleanup_targets) = (SELECT count(*) FROM report_targets)
  THEN 1 ELSE 0 END;

WITH differences AS (
  SELECT institution_id, user_id, name, tan_number, username
  FROM cleanup_targets
  EXCEPT
  SELECT institution_id, user_id, name, tan_number, username
  FROM report_targets
  UNION ALL
  SELECT institution_id, user_id, name, tan_number, username
  FROM report_targets
  EXCEPT
  SELECT institution_id, user_id, name, tan_number, username
  FROM cleanup_targets
)
INSERT INTO cleanup_assertion(ok)
SELECT CASE WHEN EXISTS (SELECT 1 FROM differences) THEN 0 ELSE 1 END;

CREATE TEMP TABLE cleanup_employees AS
SELECT e.id
FROM employees e
JOIN cleanup_targets t ON t.institution_id = e.institution_id;

CREATE TEMP TABLE cleanup_designations AS
SELECT d.id
FROM employee_designations d
JOIN cleanup_targets t ON t.institution_id = d.institution_id;

CREATE TEMP TABLE cleanup_employee_fields AS
SELECT f.id
FROM employee_custom_field_definitions f
JOIN cleanup_targets t ON t.institution_id = f.institution_id;

CREATE TEMP TABLE cleanup_profiles AS
SELECT p.id
FROM employee_payroll_profiles p
JOIN cleanup_targets t ON t.institution_id = p.institution_id;

CREATE TEMP TABLE cleanup_versions AS
SELECT v.id
FROM employee_payroll_versions v
JOIN cleanup_profiles p ON p.id = v.payroll_profile_id;

CREATE TEMP TABLE cleanup_payroll_fields AS
SELECT f.id
FROM payroll_custom_field_definitions f
JOIN cleanup_targets t ON t.institution_id = f.institution_id;

INSERT INTO cleanup_assertion(ok)
SELECT CASE WHEN NOT EXISTS (
  SELECT li.id
  FROM payroll_line_items li
  JOIN cleanup_payroll_fields f ON f.id = li.custom_field_definition_id
  WHERE li.payroll_version_id NOT IN (SELECT id FROM cleanup_versions)
) THEN 1 ELSE 0 END;

INSERT INTO cleanup_assertion(ok)
SELECT CASE WHEN NOT EXISTS (
  SELECT v.id
  FROM employee_custom_field_values v
  JOIN cleanup_employee_fields f ON f.id = v.field_definition_id
  WHERE v.employee_id NOT IN (SELECT id FROM cleanup_employees)
) THEN 1 ELSE 0 END;

INSERT INTO cleanup_assertion(ok)
SELECT CASE WHEN NOT EXISTS (
  SELECT e.id
  FROM employees e
  JOIN cleanup_designations d ON d.id = e.designation_id
  WHERE e.id NOT IN (SELECT id FROM cleanup_employees)
) THEN 1 ELSE 0 END;

DELETE FROM payroll_line_items
WHERE payroll_version_id IN (SELECT id FROM cleanup_versions);

DELETE FROM employee_payroll_versions
WHERE id IN (SELECT id FROM cleanup_versions);

DELETE FROM employee_payroll_profiles
WHERE id IN (SELECT id FROM cleanup_profiles);

DELETE FROM employee_custom_field_values
WHERE employee_id IN (SELECT id FROM cleanup_employees);

DELETE FROM employees
WHERE id IN (SELECT id FROM cleanup_employees);

DELETE FROM payroll_custom_field_periods
WHERE custom_field_definition_id IN (SELECT id FROM cleanup_payroll_fields);

DELETE FROM payroll_custom_field_definitions
WHERE id IN (SELECT id FROM cleanup_payroll_fields);

DELETE FROM employee_custom_field_definitions
WHERE id IN (SELECT id FROM cleanup_employee_fields);

DELETE FROM employee_designations
WHERE id IN (SELECT id FROM cleanup_designations);

DELETE FROM user
WHERE id IN (SELECT user_id FROM cleanup_targets);

COMMIT;
SQL

REMAINING="$(query_records)"
REMAINING="${REMAINING:-[]}"
REMAINING_COUNT="$(jq 'length' <<<"$REMAINING")"

if [[ "$REMAINING_COUNT" != "0" ]]; then
  fail "cleanup completed but $REMAINING_COUNT generated institutions remain"
fi

echo "cleanup: generated institutions removed; marker-filtered count is zero"
