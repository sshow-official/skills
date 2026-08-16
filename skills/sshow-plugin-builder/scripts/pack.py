#!/usr/bin/env python3
"""Validate an SSHOW plugin folder and pack it as a .sshowplugin zip.

Usage:
    python3 pack.py <plugin-dir>                 # validate + write <id>-<version>.sshowplugin
    python3 pack.py <plugin-dir> --check         # validate only
    python3 pack.py <plugin-dir> --out <file>    # custom output path

Mirrors the contract the SSHOW editor and server enforce, so a package
that passes here imports and submits cleanly. Standard library only.
"""

import argparse
import json
import re
import sys
import zipfile
from pathlib import Path

ID_PATTERN = re.compile(r"^[a-z0-9][a-z0-9.-]*$")
VERSION_PATTERN = re.compile(r"^\d+\.\d+\.\d+$")
ICON_EXTS = {"png", "svg", "jpg", "jpeg", "webp"}
RESERVED_IDS = {"installed", "mine", "submit"}
API_VERSION = 1

MAX_ENTRIES = 64
MAX_FILE_BYTES = 5 * 1024 * 1024
MAX_PACKAGE_BYTES = 10 * 1024 * 1024
MAX_ID = 100
MAX_NAME = 100
MAX_DESCRIPTION = 2000
MAX_AUTHOR = 100


def fail(errors):
    for error in errors:
        print(f"  ✗ {error}", file=sys.stderr)
    sys.exit(1)


def validate(plugin_dir: Path):
    errors = []

    manifest_path = plugin_dir / "plugin.json"
    if not manifest_path.is_file():
        fail([f"missing {manifest_path}"])
    try:
        manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
    except (json.JSONDecodeError, UnicodeDecodeError) as parse_error:
        fail([f"plugin.json is not valid JSON: {parse_error}"])

    plugin_id = manifest.get("id")
    if not isinstance(plugin_id, str) or not ID_PATTERN.match(plugin_id or "") or ".." in (plugin_id or ""):
        errors.append('id — lowercase reverse-domain, [a-z0-9.-] only, no ".."')
    elif len(plugin_id) > MAX_ID:
        errors.append(f"id — over {MAX_ID} chars")
    elif plugin_id in RESERVED_IDS:
        errors.append(f"id — '{plugin_id}' is reserved")

    name = manifest.get("name")
    if not isinstance(name, str) or not name.strip():
        errors.append("name — non-empty string required")
    elif len(name.strip()) > MAX_NAME:
        errors.append(f"name — over {MAX_NAME} chars")

    version = manifest.get("version")
    if not isinstance(version, str) or not VERSION_PATTERN.match(version or ""):
        errors.append("version — exact x.y.z required")

    api = manifest.get("api")
    if not isinstance(api, int) or isinstance(api, bool) or api < 1:
        errors.append("api — positive integer required")
    elif api != API_VERSION:
        errors.append(f"api — editors speak api {API_VERSION}; {api} will be refused at load")

    main = manifest.get("main")
    if not isinstance(main, str) or not main.strip():
        errors.append("main — non-empty entry filename required")
    elif not (plugin_dir / main).is_file():
        errors.append(f"main — '{main}' not found in {plugin_dir}")

    description = manifest.get("description")
    if description is not None:
        if not isinstance(description, str):
            errors.append("description — string when present")
        elif len(description.strip()) > MAX_DESCRIPTION:
            errors.append(f"description — over {MAX_DESCRIPTION} chars")

    author = manifest.get("author")
    if author is not None:
        if not isinstance(author, str):
            errors.append("author — string when present")
        elif len(author.strip()) > MAX_AUTHOR:
            errors.append(f"author — over {MAX_AUTHOR} chars")

    icon = manifest.get("icon")
    if icon is not None:
        if not isinstance(icon, str) or not icon.strip():
            errors.append("icon — non-empty filename when present")
        elif not (plugin_dir / icon).is_file():
            errors.append(f"icon — '{icon}' not found in {plugin_dir}")
        elif icon.rsplit(".", 1)[-1].lower() not in ICON_EXTS:
            errors.append(f"icon — extension must be one of {'/'.join(sorted(ICON_EXTS))}")

    files = sorted(p for p in plugin_dir.rglob("*") if p.is_file())
    if len(files) > MAX_ENTRIES:
        errors.append(f"package — {len(files)} files, cap is {MAX_ENTRIES}")
    for file in files:
        if file.stat().st_size > MAX_FILE_BYTES:
            errors.append(f"package — '{file.name}' over {MAX_FILE_BYTES} bytes")

    if errors:
        fail(errors)
    return manifest, files


def main():
    parser = argparse.ArgumentParser(description="Validate and pack an SSHOW plugin")
    parser.add_argument("plugin_dir", type=Path)
    parser.add_argument("--check", action="store_true", help="validate only")
    parser.add_argument("--out", type=Path, help="output .sshowplugin path")
    args = parser.parse_args()

    plugin_dir = args.plugin_dir.resolve()
    if not plugin_dir.is_dir():
        fail([f"{plugin_dir} is not a directory"])

    manifest, files = validate(plugin_dir)
    print(f"  ✓ {manifest['id']}@{manifest['version']} — {len(files)} file(s) valid")
    if args.check:
        return

    out = args.out or Path(f"{manifest['id']}-{manifest['version']}.sshowplugin")
    out.parent.mkdir(parents=True, exist_ok=True)
    with zipfile.ZipFile(out, "w", zipfile.ZIP_DEFLATED) as archive:
        for file in files:
            archive.write(file, file.relative_to(plugin_dir).as_posix())

    size = out.stat().st_size
    if size > MAX_PACKAGE_BYTES:
        out.unlink()
        fail([f"package — {size} bytes zipped, cap is {MAX_PACKAGE_BYTES}"])
    print(f"  ✓ wrote {out} ({size:,} bytes)")


if __name__ == "__main__":
    main()
