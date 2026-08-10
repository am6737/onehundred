#!/usr/bin/env python3
"""Admin V2 static/database security contract checks.

The script intentionally uses only read-only database queries and static source
inspection. It is scoped to the current Supabase DB container named
``supabase-db`` by default.
"""

from __future__ import annotations

import json
import os
import re
import subprocess
import sys
from dataclasses import dataclass
from pathlib import Path
from typing import Any


ROOT = Path(__file__).resolve().parents[1]
MIGRATIONS = (
    ROOT / "supabase-docker/migrations/20260728_admin_v2_database_foundation.sql",
    ROOT / "supabase-docker/migrations/20260731_admin_v2_version_owned_illustrations.sql",
)
TYPES_TS = ROOT / "admin-web/src/lib/admin/types.ts"
SUPABASE_REPOSITORY_TS = ROOT / "admin-web/src/lib/admin/supabaseRepository.ts"
ADMIN_HTTP_E2E = ROOT / "admin-web/scripts/admin-v2-http-e2e.mjs"
ADMIN_SRC = ROOT / "admin-web/src"
DB_CONTAINER = os.environ.get("ADMIN_V2_DB_CONTAINER", "supabase-db")

EXPECTED_REPOSITORY_CONTRACT_COUNTS = {
    "methods": 30,
    "rpcs": 23,
}
EXPECTED_ADMIN_V2_FUNCTION_COUNT = 51
EXPECTED_AUTHENTICATED_FUNCTION_COUNT = 29
REMOVED_REPOSITORY_METHODS = {"listAssets"}
REMOVED_REPOSITORY_RPCS = {
    "admin_v2_list_system_assets",
    "admin_v2_list_family_private_cover_assets",
}
EXPECTED_ROLES_V2 = {"content_editor", "content_reviewer", "family_support", "system_admin"}
EXPECTED_ROLES_LEGACY = {"super_admin", "admin", "operator", "support"}
EXPECTED_ADMIN_V2_TABLES = {
    "admin_audit_log",
    "admin_v2_activities",
    "admin_v2_activity_versions",
    "admin_v2_activity_records",
    "admin_v2_activity_record_media",
    "admin_v2_family_private_cover_assets",
    "admin_v2_audit_events",
    "admin_v2_moderation_cases",
}
EXPECTED_COMPAT_VIEWS = {"admin_v2_system_illustration_assets"}
EXPECTED_VERSION_ILLUSTRATION_COLUMNS = {
    "illustration_storage_bucket",
    "illustration_storage_path",
    "illustration_mime_type",
    "illustration_width",
    "illustration_height",
    "illustration_alt",
    "illustration_metadata",
}
EXPECTED_LEGACY_BRIDGE_TRIGGERS = {
    ("public", "levels", "trg_admin_v2_sync_system_level_activity"),
    ("public", "custom_levels", "trg_admin_v2_sync_custom_level_activity"),
    ("public", "memories", "trg_admin_v2_sync_memory_record"),
    ("storage", "objects", "trg_admin_v2_sync_storage_memory_media"),
}
FAMILY_PRIVATE_TABLES = {
    "admin_v2_activities",
    "admin_v2_activity_versions",
    "admin_v2_activity_records",
    "admin_v2_activity_record_media",
    "admin_v2_family_private_cover_assets",
}


@dataclass
class CheckResult:
    name: str
    passed: bool
    detail: str = ""


@dataclass
class RepositoryContract:
    methods: list[str]
    rpcs: list[str]


def read_text(path: Path) -> str:
    return path.read_text(encoding="utf-8")


def read_migrations() -> str:
    return "\n\n".join(read_text(path) for path in MIGRATIONS)


def run(command: list[str]) -> str:
    completed = subprocess.run(
        command,
        cwd=ROOT,
        check=False,
        text=True,
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
    )
    if completed.returncode != 0:
        raise RuntimeError(
            f"Command failed ({completed.returncode}): {' '.join(command)}\n"
            f"STDOUT:\n{completed.stdout}\nSTDERR:\n{completed.stderr}"
        )
    return completed.stdout


def psql_json(sql: str) -> list[dict[str, Any]]:
    sql = sql.strip().rstrip(";")
    wrapped = (
        "SET default_transaction_read_only = on; "
        "SELECT COALESCE(jsonb_agg(row_to_json(q)), '[]'::jsonb)::text "
        f"FROM ({sql}) q;"
    )
    output = run(
        [
            "docker",
            "exec",
            DB_CONTAINER,
            "psql",
            "-U",
            "postgres",
            "-d",
            "postgres",
            "-v",
            "ON_ERROR_STOP=1",
            "-X",
            "-q",
            "-t",
            "-A",
            "-c",
            wrapped,
        ]
    ).strip()
    return json.loads(output or "[]")


def split_top_level_commas(value: str) -> list[str]:
    parts: list[str] = []
    start = 0
    depth = 0
    in_quote: str | None = None
    escape = False
    for index, char in enumerate(value):
        if in_quote:
            if escape:
                escape = False
            elif char == "\\":
                escape = True
            elif char == in_quote:
                in_quote = None
            continue
        if char in {"'", '"', "`"}:
            in_quote = char
        elif char in "([{":
            depth += 1
        elif char in ")]}":
            depth = max(depth - 1, 0)
        elif char == "," and depth == 0:
            parts.append(value[start:index].strip())
            start = index + 1
    tail = value[start:].strip()
    if tail:
        parts.append(tail)
    return parts


def extract_balanced(text: str, start: int, open_char: str, close_char: str) -> tuple[str, int]:
    if text[start] != open_char:
        raise ValueError(f"expected {open_char!r} at {start}")
    depth = 0
    in_quote: str | None = None
    escape = False
    for index in range(start, len(text)):
        char = text[index]
        if in_quote:
            if escape:
                escape = False
            elif char == "\\":
                escape = True
            elif char == in_quote:
                in_quote = None
            continue
        if char in {"'", '"', "`"}:
            in_quote = char
        elif char == open_char:
            depth += 1
        elif char == close_char:
            depth -= 1
            if depth == 0:
                return text[start : index + 1], index + 1
    raise ValueError(f"unclosed {open_char!r}")


def object_top_level_keys(object_literal: str) -> set[str]:
    body = object_literal.strip()[1:-1]
    keys: set[str] = set()
    for part in split_top_level_commas(body):
        if not part or part.startswith("..."):
            continue
        match = re.match(r"\s*(?:['\"]([^'\"]+)['\"]|([A-Za-z_$][\w$-]*))\s*:", part)
        if match:
            keys.add(match.group(1) or match.group(2))
    return keys


def extract_repository_rpcs(source: str) -> list[dict[str, Any]]:
    calls: list[dict[str, Any]] = []
    pattern = re.compile(r"\.rpc\s*\(\s*['\"]([^'\"]+)['\"]", re.MULTILINE)
    for match in pattern.finditer(source):
        name = match.group(1)
        cursor = match.end()
        while cursor < len(source) and source[cursor].isspace():
            cursor += 1
        keys: set[str] = set()
        if cursor < len(source) and source[cursor] == ",":
            cursor += 1
            while cursor < len(source) and source[cursor].isspace():
                cursor += 1
            if cursor < len(source) and source[cursor] == "{":
                obj, _ = extract_balanced(source, cursor, "{", "}")
                keys = object_top_level_keys(obj)
        line = source.count("\n", 0, match.start()) + 1
        calls.append({"name": name, "keys": keys, "line": line})
    return calls


def extract_admin_repository_methods(types_source: str) -> list[str]:
    match = re.search(r"export\s+interface\s+AdminRepository\s*{(?P<body>.*?)^}", types_source, re.S | re.M)
    if not match:
        return []
    methods: list[str] = []
    for line in match.group("body").splitlines():
        method = re.match(r"\s*([A-Za-z_$][\w$]*)\s*\(", line)
        if method:
            methods.append(method.group(1))
    return methods


def extract_js_string_array(source: str, const_name: str) -> list[str]:
    match = re.search(rf"const\s+{re.escape(const_name)}\s*=\s*\[(?P<body>.*?)\];", source, re.S)
    if not match:
        return []
    return re.findall(r"['\"]([^'\"]+)['\"]", match.group("body"))


def extract_repository_contract(e2e_source: str) -> RepositoryContract:
    return RepositoryContract(
        methods=extract_js_string_array(e2e_source, "expectedRepositoryMethods"),
        rpcs=extract_js_string_array(e2e_source, "expectedRepositoryRpcs"),
    )


def extract_class_methods(source: str, class_name: str) -> set[str]:
    match = re.search(rf"export\s+class\s+{re.escape(class_name)}\b", source)
    if not match:
        return set()
    body_start = source.find("{", match.end())
    if body_start < 0:
        return set()
    body, _ = extract_balanced(source, body_start, "{", "}")
    methods: set[str] = set()
    for line in body.splitlines():
        match = re.match(r"^  (?!(?:private|protected)\b)(?:async\s+)?([A-Za-z_$][\w$]*)\s*\(", line)
        if match and match.group(1) != "constructor":
            methods.add(match.group(1))
    return methods


def parse_arg_names(args: str) -> tuple[set[str], set[str]]:
    all_names: set[str] = set()
    required: set[str] = set()
    if not args.strip():
        return all_names, required
    for arg in split_top_level_commas(args):
        cleaned = re.sub(r"\b(IN|OUT|INOUT|VARIADIC)\b\s+", "", arg.strip(), flags=re.I)
        match = re.match(r'"?([A-Za-z_][\w$]*)"?\s+', cleaned)
        if not match:
            continue
        name = match.group(1)
        all_names.add(name)
        if not re.search(r"\bDEFAULT\b|=", cleaned, re.I):
            required.add(name)
    return all_names, required


def normalize_signature(value: str) -> str:
    value = re.sub(r"\s+", " ", value.strip())
    value = re.sub(r"\s*,\s*", ", ", value)
    return value


def migration_grants_to_authenticated(migration_sql: str) -> set[str]:
    dynamic_allowlist = {
        normalize_signature(match)
        for match in re.findall(r"'(public\.admin_v2_[A-Za-z0-9_]+\([^']*\))'", migration_sql, flags=re.I)
    }
    direct_grants = {
        normalize_signature(f"public.{name}({args})")
        for name, args in re.findall(
            r"GRANT\s+EXECUTE\s+ON\s+FUNCTION\s+public\.(admin_v2_[A-Za-z0-9_]+)\s*\(([^;]*?)\)\s+TO\s+authenticated\s*;",
            migration_sql,
            flags=re.I | re.S,
        )
    }
    return dynamic_allowlist | direct_grants


def migration_admin_tables(migration_sql: str) -> set[str]:
    return set(
        re.findall(
            r"CREATE\s+TABLE\s+IF\s+NOT\s+EXISTS\s+public\.(admin_v2_[A-Za-z0-9_]+)\b",
            migration_sql,
            flags=re.I,
        )
    )


def format_set(values: set[str]) -> str:
    return ", ".join(sorted(values)) if values else "-"


def duplicate_values(values: list[str]) -> set[str]:
    return {value for value in values if values.count(value) > 1}


def check_paths() -> CheckResult:
    inputs = [*MIGRATIONS, TYPES_TS, SUPABASE_REPOSITORY_TS, ADMIN_HTTP_E2E]
    missing = [str(path.relative_to(ROOT)) for path in inputs if not path.exists()]
    return CheckResult("input files exist", not missing, f"missing: {', '.join(missing)}" if missing else "all contract input files found")


def check_repository_rpcs(
    repo_source: str,
    proc_by_name: dict[str, list[dict[str, Any]]],
    contract: RepositoryContract,
) -> list[CheckResult]:
    calls = extract_repository_rpcs(repo_source)
    names = [call["name"] for call in calls]
    unique_names = set(names)
    expected_names = set(contract.rpcs)
    expected_count = EXPECTED_REPOSITORY_CONTRACT_COUNTS["rpcs"]
    missing_contract = expected_names.difference(unique_names)
    extra_contract = unique_names.difference(expected_names)
    duplicate_contract = duplicate_values(contract.rpcs)
    missing = unique_names.difference(proc_by_name)
    duplicate = sorted({name for name in names if names.count(name) > 1})
    removed_present = (unique_names | expected_names).intersection(REMOVED_REPOSITORY_RPCS)
    results = [
        CheckResult(
            "23 repository RPCs match e2e contract",
            len(contract.rpcs) == expected_count
            and not duplicate_contract
            and len(unique_names) == expected_count
            and not missing_contract
            and not extra_contract
            and not removed_present,
            (
                f"source={len(calls)} calls / {len(unique_names)} unique; e2e={len(contract.rpcs)} expected={expected_count}; "
                f"missing={format_set(missing_contract)}; extra={format_set(extra_contract)}; "
                f"removed_present={format_set(removed_present)}; duplicates={', '.join(duplicate) or '-'}; "
                f"contract_duplicates={format_set(duplicate_contract)}"
            ),
        ),
        CheckResult(
            "repository RPC names exist in pg_proc",
            not missing,
            f"missing: {format_set(missing)}",
        ),
    ]

    mismatches: list[str] = []
    for call in calls:
        rows = proc_by_name.get(call["name"], [])
        if len(rows) != 1:
            mismatches.append(f"{call['name']}@{call['line']}: expected 1 signature, found {len(rows)}")
            continue
        arg_names, required_names = parse_arg_names(rows[0]["arguments"])
        call_keys = set(call["keys"])
        unknown = call_keys.difference(arg_names)
        missing_required = required_names.difference(call_keys)
        if unknown or missing_required:
            mismatches.append(
                f"{call['name']}@{call['line']}: unknown={format_set(unknown)} missing_required={format_set(missing_required)} "
                f"signature=({rows[0]['arguments']})"
            )
    results.append(
        CheckResult(
            "repository RPC top-level params match pg_proc",
            not mismatches,
            "; ".join(mismatches) if mismatches else "all RPC call keys match required signature names",
        )
    )
    return results


def check_security_definer_search_path(functions: list[dict[str, Any]]) -> CheckResult:
    failures: list[str] = []
    for fn in functions:
        if not fn["security_definer"]:
            continue
        proconfig = fn.get("proconfig") or []
        if not any(item.replace(" ", "") in {'search_path=""', "search_path=''", "search_path="} for item in proconfig):
            failures.append(f"{fn['proname']}({fn['identity_args']}): proconfig={proconfig}")
    return CheckResult(
        "admin_v2 SECURITY DEFINER search_path empty",
        not failures,
        "; ".join(failures) if failures else "all SECURITY DEFINER admin_v2 functions set search_path to empty",
    )


def check_function_privileges(functions: list[dict[str, Any]], expected_authenticated: set[str]) -> list[CheckResult]:
    actual_signatures = {normalize_signature(fn["signature"]) for fn in functions}
    public_or_anon = [
        f"{fn['signature']}: public={fn['public_exec']} anon={fn['anon_exec']}"
        for fn in functions
        if fn["public_exec"] or fn["anon_exec"]
    ]
    auth_missing = [
        signature
        for signature in sorted(expected_authenticated)
        if signature in actual_signatures
        and not next(fn for fn in functions if normalize_signature(fn["signature"]) == signature)["authenticated_exec"]
    ]
    missing_allowlist_functions = sorted(expected_authenticated.difference(actual_signatures))
    unexpected_auth = [
        fn["signature"]
        for fn in functions
        if normalize_signature(fn["signature"]) not in expected_authenticated and fn["authenticated_exec"]
    ]
    authenticated_count = sum(1 for fn in functions if fn["authenticated_exec"])
    return [
        CheckResult(
            "admin_v2 function inventory",
            len(functions) == EXPECTED_ADMIN_V2_FUNCTION_COUNT,
            f"found {len(functions)}, expected {EXPECTED_ADMIN_V2_FUNCTION_COUNT}",
        ),
        CheckResult(
            "migration authenticated allowlist inventory",
            len(expected_authenticated) == EXPECTED_AUTHENTICATED_FUNCTION_COUNT and not missing_allowlist_functions,
            (
                f"allowlist={len(expected_authenticated)}, expected={EXPECTED_AUTHENTICATED_FUNCTION_COUNT}; "
                f"missing functions in db: {'; '.join(missing_allowlist_functions) or '-'}"
            ),
        ),
        CheckResult(
            "admin_v2 public/anon EXECUTE revoked",
            not public_or_anon,
            "; ".join(public_or_anon) if public_or_anon else "public and anon cannot execute admin_v2 functions",
        ),
        CheckResult(
            "admin_v2 authenticated EXECUTE grants match migration",
            authenticated_count == EXPECTED_AUTHENTICATED_FUNCTION_COUNT and not auth_missing and not unexpected_auth,
            (
                f"authenticated={authenticated_count}, expected={EXPECTED_AUTHENTICATED_FUNCTION_COUNT}; "
                f"missing authenticated grant: {'; '.join(auth_missing) or '-'}; "
                f"unexpected authenticated grant: {'; '.join(unexpected_auth) or '-'}"
            ),
        ),
    ]


def check_rls_and_policies(tables: list[dict[str, Any]]) -> CheckResult:
    actual_tables = {row["relname"] for row in tables}
    expected_tables = EXPECTED_ADMIN_V2_TABLES
    missing_tables = expected_tables.difference(actual_tables)
    extra_tables = actual_tables.difference(expected_tables)
    bad_tables = [
        f"{row['relname']}: rls={row['relrowsecurity']} policies={row['policy_count']}"
        for row in tables
        if not row["relrowsecurity"] or int(row["policy_count"]) <= 0
    ]
    passed = not missing_tables and not extra_tables and not bad_tables and len(actual_tables) == len(EXPECTED_ADMIN_V2_TABLES)
    return CheckResult(
        "V2 8 base tables RLS enabled and policies exist",
        passed,
        (
            f"actual={len(actual_tables)} expected={len(EXPECTED_ADMIN_V2_TABLES)}; missing={format_set(missing_tables)}; "
            f"extra={format_set(extra_tables)}; bad={'; '.join(bad_tables) or '-'}"
        ),
    )


def check_system_asset_compat_view(views: list[dict[str, Any]]) -> CheckResult:
    actual_views = {row["relname"] for row in views}
    missing = EXPECTED_COMPAT_VIEWS.difference(actual_views)
    bad_kind = [f"{row['relname']}: relkind={row['relkind']}" for row in views if row["relkind"] != "v"]
    direct_grants = [
        f"{row['relname']}: public={row['public_select']} anon={row['anon_select']} authenticated={row['authenticated_select']}"
        for row in views
        if row["public_select"] or row["anon_select"] or row["authenticated_select"]
    ]
    return CheckResult(
        "system illustration asset entity replaced by private compat view",
        not missing and not bad_kind and not direct_grants,
        (
            f"missing={format_set(missing)}; bad_kind={'; '.join(bad_kind) or '-'}; "
            f"direct_select_grants={'; '.join(direct_grants) or '-'}"
        ),
    )


def check_version_illustration_columns(columns: list[dict[str, Any]]) -> CheckResult:
    actual = {row["column_name"] for row in columns}
    missing = EXPECTED_VERSION_ILLUSTRATION_COLUMNS.difference(actual)
    bad_json_default = [
        row["column_name"]
        for row in columns
        if row["column_name"] == "illustration_metadata" and row["is_nullable"] != "NO"
    ]
    return CheckResult(
        "activity versions own illustration storage fields",
        not missing and not bad_json_default,
        f"missing={format_set(missing)}; metadata_nullable={'yes' if bad_json_default else 'no'}",
    )


def check_no_admin_direct_scan_policies(policies: list[dict[str, Any]]) -> CheckResult:
    failures: list[str] = []
    for policy in policies:
        table = policy["tablename"]
        if table not in FAMILY_PRIVATE_TABLES:
            continue
        expression = f"{policy.get('qual') or ''} {policy.get('with_check') or ''}".lower()
        has_admin_gate = "admin_v2_has_permission" in expression or "admin_v2_current_role" in expression
        has_family_scope = "my_family_id()" in expression or "family_id =" in expression or "source_type = 'system'" in expression
        if has_admin_gate and not has_family_scope:
            failures.append(f"{table}.{policy['policyname']} allows admin gate without family scope")
    return CheckResult(
        "family-private tables have no admin direct scan policy",
        not failures,
        "; ".join(failures) if failures else "family-private policies stay family-scoped or system-scoped",
    )


def check_audit_append_only(functions: list[dict[str, Any]], triggers: list[dict[str, Any]]) -> CheckResult:
    trigger = next(
        (
            row
            for row in triggers
            if row["schema"] == "public"
            and row["table_name"] == "admin_v2_audit_events"
            and row["tgname"] == "trg_admin_v2_audit_events_append_only"
        ),
        None,
    )
    fn = next((row for row in functions if row["proname"] == "admin_v2_prevent_audit_mutation"), None)
    failures: list[str] = []
    if not trigger:
        failures.append("trigger missing")
    else:
        definition = trigger["definition"].lower()
        if trigger["tgenabled"] != "O":
            failures.append(f"trigger disabled state={trigger['tgenabled']}")
        if "before delete or update" not in definition and "before update or delete" not in definition:
            failures.append(f"trigger is not BEFORE UPDATE OR DELETE: {trigger['definition']}")
        if "admin_v2_prevent_audit_mutation" not in definition:
            failures.append("trigger function mismatch")
    if not fn:
        failures.append("admin_v2_prevent_audit_mutation function missing")
    else:
        source = (fn.get("source") or "").lower()
        if "admin_v2_audit_events_are_append_only" not in source or "raise exception" not in source:
            failures.append("trigger function does not raise append-only exception")
    return CheckResult(
        "admin_v2_audit_events append-only trigger effective",
        not failures,
        "; ".join(failures) if failures else "enabled BEFORE UPDATE/DELETE trigger raises append-only exception",
    )


def check_profile_roles(types_source: str, constraints: list[dict[str, Any]], migration_sql: str) -> CheckResult:
    all_roles = EXPECTED_ROLES_V2 | EXPECTED_ROLES_LEGACY
    combined = types_source + "\n" + migration_sql + "\n" + "\n".join(row["definition"] for row in constraints)
    missing = {role for role in all_roles if role not in combined}
    constraint_ok = any(all(role in row["definition"] for role in all_roles) for row in constraints)
    return CheckResult(
        "profiles admin roles V2/legacy compatible",
        not missing and constraint_ok,
        f"missing roles={format_set(missing)}; compatible constraint={'yes' if constraint_ok else 'no'}",
    )


def check_legacy_data_counts(counts: dict[str, int], migration_sql: str) -> CheckResult:
    failures: list[str] = []
    for table in ["levels", "custom_levels", "memories"]:
        if counts.get(table, 0) <= 0:
            failures.append(f"{table} count is {counts.get(table, 0)}")
    comparisons = [
        ("levels", "system_v2_activities"),
        ("custom_levels", "custom_v2_activities"),
        ("memories", "v2_records_legacy_memories"),
    ]
    for legacy, bridged in comparisons:
        if counts.get(bridged, 0) < counts.get(legacy, 0):
            failures.append(f"{bridged}={counts.get(bridged, 0)} < {legacy}={counts.get(legacy, 0)}")
    destructive = re.findall(r"\b(?:DELETE\s+FROM|TRUNCATE\s+TABLE)\s+public\.(levels|custom_levels|memories)\b", migration_sql, flags=re.I)
    if destructive:
        failures.append(f"migration contains destructive legacy-table statements: {', '.join(destructive)}")
    return CheckResult(
        "levels/custom_levels/memories exist and data not decreased",
        not failures,
        "; ".join(failures) if failures else f"legacy counts bridged: {counts}",
    )


def check_legacy_bridge_triggers(triggers: list[dict[str, Any]]) -> CheckResult:
    actual = {(row["schema"], row["table_name"], row["tgname"]) for row in triggers if row["tgname"].startswith("trg_admin_v2_sync_")}
    missing = EXPECTED_LEGACY_BRIDGE_TRIGGERS.difference(actual)
    disabled = [
        f"{row['schema']}.{row['table_name']}.{row['tgname']} state={row['tgenabled']}"
        for row in triggers
        if (row["schema"], row["table_name"], row["tgname"]) in EXPECTED_LEGACY_BRIDGE_TRIGGERS and row["tgenabled"] != "O"
    ]
    return CheckResult(
        "legacy bridge triggers exist",
        not missing and not disabled,
        f"missing={missing or '-'}; disabled={'; '.join(disabled) or '-'}",
    )


def check_service_role_not_executable_config() -> CheckResult:
    failures: list[str] = []
    risky = re.compile(
        r"(VITE_[A-Z0-9_]*(SERVICE|SERVICE_ROLE|SECRET)[A-Z0-9_]*|SUPABASE_[A-Z0-9_]*SERVICE[A-Z0-9_]*|service_role\s*[:=])"
    )
    for path in sorted(ADMIN_SRC.rglob("*")):
        if path.is_dir() or path.suffix not in {".ts", ".tsx", ".js", ".jsx", ".mjs", ".cjs"}:
            continue
        if path.name.endswith(".d.ts"):
            continue
        text = read_text(path)
        for line_number, line in enumerate(text.splitlines(), start=1):
            stripped = line.strip()
            if stripped.startswith("//") or stripped.startswith("*"):
                continue
            if risky.search(line):
                failures.append(f"{path.relative_to(ROOT)}:{line_number}: {stripped}")
    return CheckResult(
        "service_role absent from admin-web/src executable config",
        not failures,
        "; ".join(failures) if failures else "no service-role env/key patterns in executable source",
    )


def check_demo_explicit_only() -> CheckResult:
    failures: list[str] = []
    for path in sorted(ADMIN_SRC.rglob("*")):
        if path.is_dir() or path.suffix not in {".ts", ".tsx", ".js", ".jsx"}:
            continue
        if path.name == "demoRepository.ts":
            continue
        text = read_text(path)
        has_demo_invocation = bool(re.search(r"\bcreateDemoAdminRepository\s*\(", text))
        has_demo_status = "status: 'demo'" in text or 'status: "demo"' in text
        if not has_demo_invocation and not has_demo_status:
            continue
        has_explicit_check = bool(
            re.search(r"VITE_ADMIN_DATA_MODE\?\?\.trim\(\)\.toLowerCase\(\)\s*===\s*['\"]demo['\"]", text)
            or re.search(r"VITE_ADMIN_DATA_MODE[^;\n]*===\s*['\"]demo['\"]", text)
        )
        if not has_explicit_check:
            failures.append(str(path.relative_to(ROOT)))
    return CheckResult(
        "demo mode only when VITE_ADMIN_DATA_MODE=demo",
        not failures,
        "; ".join(failures) if failures else "demo repository/status is gated by explicit VITE_ADMIN_DATA_MODE=demo",
    )


def check_repository_methods(types_source: str, repo_source: str, contract: RepositoryContract) -> CheckResult:
    interface_methods = extract_admin_repository_methods(types_source)
    interface_set = set(interface_methods)
    implemented = extract_class_methods(repo_source, "SupabaseAdminRepository")
    expected_methods = set(contract.methods)
    expected_count = EXPECTED_REPOSITORY_CONTRACT_COUNTS["methods"]
    missing_contract = expected_methods.difference(interface_set)
    extra_contract = interface_set.difference(expected_methods)
    duplicate_contract = duplicate_values(contract.methods)
    missing = interface_set.difference(implemented)
    extra = implemented.difference(interface_set)
    removed_present = (expected_methods | interface_set | implemented).intersection(REMOVED_REPOSITORY_METHODS)
    unsupported = "unsupportedAdminOperation" in repo_source
    passed = (
        len(contract.methods) == expected_count
        and not duplicate_contract
        and len(interface_methods) == expected_count
        and len(implemented) == expected_count
        and not missing_contract
        and not extra_contract
        and not missing
        and not extra
        and not removed_present
        and not unsupported
    )
    return CheckResult(
        "30 repository methods match e2e contract without unsupportedAdminOperation",
        passed,
        (
            f"e2e={len(contract.methods)} expected={expected_count}; interface={len(interface_methods)} implemented={len(implemented)}; "
            f"contract_missing={format_set(missing_contract)}; contract_extra={format_set(extra_contract)}; "
            f"implementation_missing={format_set(missing)}; implementation_extra={format_set(extra)}; "
            f"removed_present={format_set(removed_present)}; contract_duplicates={format_set(duplicate_contract)}; "
            f"unsupportedAdminOperation={'yes' if unsupported else 'no'}"
        ),
    )


def check_repository_no_legacy_direct_reads(repo_source: str) -> CheckResult:
    failures: list[str] = []
    for table in ["levels", "notification_outbox"]:
        pattern = re.compile(rf"\.from\s*\(\s*['\"]{re.escape(table)}['\"]\s*\)")
        for match in pattern.finditer(repo_source):
            line = repo_source.count("\n", 0, match.start()) + 1
            failures.append(f"admin-web/src/lib/admin/supabaseRepository.ts:{line}: direct from('{table}')")
    return CheckResult(
        "repository avoids direct levels/notification_outbox reads",
        not failures,
        "; ".join(failures) if failures else "repository uses admin_v2 RPC read models for levels and notifications",
    )


def main() -> int:
    results: list[CheckResult] = [check_paths()]
    if not results[-1].passed:
        print_results(results)
        return 1

    migration_sql = read_migrations()
    types_source = read_text(TYPES_TS)
    repo_source = read_text(SUPABASE_REPOSITORY_TS)
    e2e_source = read_text(ADMIN_HTTP_E2E)
    repository_contract = extract_repository_contract(e2e_source)

    functions = psql_json(
        """
        SELECT
          p.proname,
          format('%I.%I(%s)', n.nspname, p.proname, oidvectortypes(p.proargtypes)) AS signature,
          pg_get_function_identity_arguments(p.oid) AS identity_args,
          pg_get_function_arguments(p.oid) AS arguments,
          p.prosecdef AS security_definer,
          COALESCE(p.proconfig, ARRAY[]::text[]) AS proconfig,
          pg_get_functiondef(p.oid) AS source,
          has_function_privilege('public', p.oid, 'EXECUTE') AS public_exec,
          has_function_privilege('anon', p.oid, 'EXECUTE') AS anon_exec,
          has_function_privilege('authenticated', p.oid, 'EXECUTE') AS authenticated_exec
        FROM pg_proc p
        JOIN pg_namespace n ON n.oid = p.pronamespace
        WHERE n.nspname = 'public'
          AND p.proname LIKE 'admin_v2_%'
        ORDER BY p.proname, identity_args
        """
    )
    proc_by_name: dict[str, list[dict[str, Any]]] = {}
    for fn in functions:
        proc_by_name.setdefault(fn["proname"], []).append(fn)

    tables = psql_json(
        """
        SELECT
          c.relname,
          c.relrowsecurity,
          count(pol.*)::integer AS policy_count
        FROM pg_class c
        JOIN pg_namespace n ON n.oid = c.relnamespace
        LEFT JOIN pg_policy pol ON pol.polrelid = c.oid
        WHERE n.nspname = 'public'
          AND c.relkind = 'r'
          AND (c.relname LIKE 'admin_v2_%' OR c.relname = 'admin_audit_log')
        GROUP BY c.relname, c.relrowsecurity
        ORDER BY c.relname
        """
    )
    views = psql_json(
        """
        SELECT
          c.relname,
          c.relkind,
          has_table_privilege('public', c.oid, 'SELECT') AS public_select,
          has_table_privilege('anon', c.oid, 'SELECT') AS anon_select,
          has_table_privilege('authenticated', c.oid, 'SELECT') AS authenticated_select
        FROM pg_class c
        JOIN pg_namespace n ON n.oid = c.relnamespace
        WHERE n.nspname = 'public'
          AND c.relname IN ('admin_v2_system_illustration_assets')
        ORDER BY c.relname
        """
    )
    version_illustration_columns = psql_json(
        """
        SELECT column_name, is_nullable, data_type, column_default
        FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = 'admin_v2_activity_versions'
          AND column_name LIKE 'illustration_%'
        ORDER BY ordinal_position
        """
    )
    policies = psql_json(
        """
        SELECT schemaname, tablename, policyname, cmd, roles::text AS roles, qual, with_check
        FROM pg_policies
        WHERE schemaname = 'public'
          AND (tablename LIKE 'admin_v2_%' OR tablename = 'admin_audit_log')
        ORDER BY tablename, policyname
        """
    )
    triggers = psql_json(
        """
        SELECT
          n.nspname AS schema,
          c.relname AS table_name,
          t.tgname,
          t.tgenabled,
          pg_get_triggerdef(t.oid) AS definition
        FROM pg_trigger t
        JOIN pg_class c ON c.oid = t.tgrelid
        JOIN pg_namespace n ON n.oid = c.relnamespace
        WHERE NOT t.tgisinternal
          AND (t.tgname LIKE 'trg_admin_v2_%' OR t.tgname LIKE 'admin_v2_%')
        ORDER BY n.nspname, c.relname, t.tgname
        """
    )
    constraints = psql_json(
        """
        SELECT conname, pg_get_constraintdef(oid) AS definition
        FROM pg_constraint
        WHERE conrelid = 'public.profiles'::regclass
          AND conname LIKE '%admin_role%'
        ORDER BY conname
        """
    )
    count_rows = psql_json(
        """
        SELECT 'levels' AS name, count(*)::integer AS count FROM public.levels
        UNION ALL
        SELECT 'system_v2_activities', count(*)::integer FROM public.admin_v2_activities
          WHERE source_type = 'system' AND legacy_level_num IS NOT NULL
        UNION ALL
        SELECT 'custom_levels', count(*)::integer FROM public.custom_levels
        UNION ALL
        SELECT 'custom_v2_activities', count(*)::integer FROM public.admin_v2_activities
          WHERE legacy_custom_level_id IS NOT NULL
        UNION ALL
        SELECT 'memories', count(*)::integer FROM public.memories
        UNION ALL
        SELECT 'v2_records_legacy_memories', count(*)::integer FROM public.admin_v2_activity_records
          WHERE legacy_memory_id IS NOT NULL
        """
    )
    counts = {row["name"]: int(row["count"]) for row in count_rows}

    results.extend(check_repository_rpcs(repo_source, proc_by_name, repository_contract))
    results.append(check_security_definer_search_path(functions))
    results.extend(check_function_privileges(functions, migration_grants_to_authenticated(migration_sql)))
    results.append(check_rls_and_policies(tables))
    results.append(check_system_asset_compat_view(views))
    results.append(check_version_illustration_columns(version_illustration_columns))
    results.append(check_no_admin_direct_scan_policies(policies))
    results.append(check_audit_append_only(functions, triggers))
    results.append(check_profile_roles(types_source, constraints, migration_sql))
    results.append(check_legacy_data_counts(counts, migration_sql))
    results.append(check_legacy_bridge_triggers(triggers))
    results.append(check_service_role_not_executable_config())
    results.append(check_demo_explicit_only())
    results.append(check_repository_methods(types_source, repo_source, repository_contract))
    results.append(check_repository_no_legacy_direct_reads(repo_source))

    print_results(results)
    return 0 if all(result.passed for result in results) else 1


def print_results(results: list[CheckResult]) -> None:
    width = max(len(result.name) for result in results)
    for result in results:
        status = "PASS" if result.passed else "FAIL"
        print(f"{status} {result.name.ljust(width)}  {result.detail}")
    passed = sum(1 for result in results if result.passed)
    failed = len(results) - passed
    print(f"SUMMARY PASS={passed} FAIL={failed} TOTAL={len(results)}")


if __name__ == "__main__":
    try:
        raise SystemExit(main())
    except Exception as exc:
        print(f"FAIL script execution  {exc}", file=sys.stderr)
        raise SystemExit(1)
