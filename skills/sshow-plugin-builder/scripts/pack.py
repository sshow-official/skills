#!/usr/bin/env python3
"""Validate an SSHOW plugin or dynamic pack folder and pack it as a
.sshowplugin or .sshowdynamic zip — the folder's one manifest (plugin.json,
dynamic.json) names which.

Usage:
    python3 pack.py <dir>                 # validate + write <id>-<version>.<ext> beside the folder
    python3 pack.py <dir> --check         # validate only
    python3 pack.py <dir> --out <file>    # custom output path

Mirrors the contract the SSHOW editor and server enforce, so a package
that passes here imports and submits cleanly. Standard library only — a
dynamic pack's shaders compile only in the editor: drop the package on it.
"""

import argparse
import json
import math
import re
import sys
import zipfile
from pathlib import Path

# Matched whole (fullmatch) and ASCII-only, like the editor's JS patterns.
ID_PATTERN = re.compile(r"[a-z0-9][a-z0-9.-]*", re.ASCII)
VERSION_PATTERN = re.compile(r"\d+\.\d+\.\d+", re.ASCII)
# The manifest a folder holds (exactly one) names its kind and package extension.
KINDS = {"plugin.json": ".sshowplugin", "dynamic.json": ".sshowdynamic"}
ICON_EXTS = {"png", "svg", "jpg", "jpeg", "webp"}
RESERVED_IDS = {"installed", "mine", "submit", "builtin"}
API_VERSION = 1
# Tags description_localized may use: the languages the editor shows (BCP 47).
LANGUAGE_TAGS = {"en", "ko"}

MAX_ENTRIES = 64
MAX_FILE_BYTES = 5 * 1024 * 1024
MAX_MANIFEST_BYTES = 256 * 1024
MAX_PACKAGE_BYTES = 10 * 1024 * 1024
MAX_ID = 100
MAX_NAME = 100
MAX_DESCRIPTION = 2000
MAX_AUTHOR = 100

# A dynamic pack's declarations — a hand mirror of core/utils/constants/dynamics.js
# (DynamicsConstants) and core/extensions/declarations.js; keep them in step.
DYNAMIC_NAME = re.compile(r"[a-z][a-zA-Z0-9]{0,31}", re.ASCII)
DYNAMIC_SLOTS = ("paint", "effect")
PARAM_TYPES = ("number", "color", "boolean")
COLOR_PATTERN = re.compile(r"#[0-9a-fA-F]{6}", re.ASCII)
RESERVED_KEYS = ("time", "texture", "opacity", "viewportScale", "inputSize", "inputPixel",
                 "inputClamp", "outputFrame", "globalFrame", "outputTexture")
DIRECTIVE_PATTERN = re.compile(r"#\s*(version|extension|include)\b")
MAX_DYNAMICS = 32
MAX_PARAMS = 24
MAX_LABEL = 48
MAX_UNIT = 8
MAX_PADDING = 256


def js_length(text):
    """Length as the server counts it: UTF-16 code units (an emoji is 2)."""
    return len(text.encode("utf-16-le")) // 2


def fail(errors):
    for error in errors:
        print(f"  ✗ {error}", file=sys.stderr)
    sys.exit(1)


def is_number(value):
    """A finite JSON number (JS Number.isFinite) — true and false are not."""
    return isinstance(value, (int, float)) and not isinstance(value, bool) and math.isfinite(value)


def check_localized(value, field, limit, errors):
    """A <field>_localized copy map. The editor and server drop a malformed
    translation without a word, so this is where a wrong one gets caught."""
    if value is None:
        return
    if not isinstance(value, dict):
        errors.append(f'{field} — object of language tag to text when present, e.g. {{"ko": "…"}}')
        return
    for tag, copy in value.items():
        if tag not in LANGUAGE_TAGS:
            errors.append(f"{field} — '{tag}' is not a language the editor shows ({'/'.join(sorted(LANGUAGE_TAGS))}; Korean is ko)")
        elif not isinstance(copy, str) or not copy.strip():
            errors.append(f"{field}.{tag} — non-empty string required")
        elif js_length(copy.strip()) > limit:
            errors.append(f"{field}.{tag} — over {limit} chars")


def check_label(declaration, field, errors):
    """A dynamic's or a param's label and its translations."""
    label = declaration.get("label")
    if not isinstance(label, str) or not label.strip() or js_length(label.strip()) > MAX_LABEL:
        errors.append(f"{field}.label — non-empty string, at most {MAX_LABEL} chars")
    check_localized(declaration.get("label_localized"), f"{field}.label_localized", MAX_LABEL, errors)


def check_param(param, field, errors):
    """One param; returns its max when it is a number, so padding can reach it."""
    if not isinstance(param, dict):
        errors.append(f"{field} — object required")
        return None
    key = param.get("key")
    if not isinstance(key, str) or not DYNAMIC_NAME.fullmatch(key):
        errors.append(f"{field}.key — lower camel case, at most 32 chars")
    elif key in RESERVED_KEYS:
        errors.append(f"{field}.key — none of {', '.join(RESERVED_KEYS)} (the host declares them)")
    check_label(param, field, errors)
    kind = param.get("type")
    value = param.get("default")
    if kind == "number":
        bounds = [value, param.get("min"), param.get("max"), param.get("step")]
        if not all(is_number(bound) for bound in bounds) or bounds[3] <= 0 or not bounds[1] <= value <= bounds[2]:
            errors.append(f"{field} — finite default within min…max, step > 0")
        unit = param.get("unit")
        if unit is not None and (not isinstance(unit, str) or js_length(unit) > MAX_UNIT):
            errors.append(f"{field}.unit — string, at most {MAX_UNIT} chars")
        return param.get("max") if is_number(param.get("max")) else None
    if kind == "color":
        if not isinstance(value, str) or not COLOR_PATTERN.fullmatch(value):
            errors.append(f"{field}.default — #rrggbb")
    elif kind == "boolean":
        if not isinstance(value, bool):
            errors.append(f"{field}.default — true or false")
    else:
        errors.append(f"{field}.type — {' | '.join(PARAM_TYPES)}")
    return None


def check_dynamics(dynamics, errors):
    """A dynamic pack's declarations, as the editor admits them."""
    if not isinstance(dynamics, list) or not 1 <= len(dynamics) <= MAX_DYNAMICS:
        errors.append(f"dynamics — 1 to {MAX_DYNAMICS} declarations")
        return
    names = set()
    for index, declaration in enumerate(dynamics):
        field = f"dynamics[{index}]"
        if not isinstance(declaration, dict):
            errors.append(f"{field} — object required")
            continue
        name = declaration.get("name")
        if not isinstance(name, str) or not DYNAMIC_NAME.fullmatch(name) or name in names:
            errors.append(f"{field}.name — unique, lower camel case, at most 32 chars")
        names.add(name)
        check_label(declaration, field, errors)
        slot = declaration.get("slot")
        if slot not in DYNAMIC_SLOTS:
            errors.append(f"{field}.slot — {' | '.join(DYNAMIC_SLOTS)}")
        if not isinstance(declaration.get("animated", False), bool):
            errors.append(f"{field}.animated — true or false")

        params = declaration.get("params")
        if not isinstance(params, list) or len(params) > MAX_PARAMS:
            errors.append(f"{field}.params — array of at most {MAX_PARAMS}")
            params = []
        keys, numbers = set(), {}
        for position, param in enumerate(params):
            reach = check_param(param, f"{field}.params[{position}]", errors)
            key = param.get("key") if isinstance(param, dict) else None
            if key in keys:
                errors.append(f"{field}.params[{position}].key — unique")
            keys.add(key)
            if reach is not None:
                numbers[key] = reach

        glsl = declaration.get("glsl")
        if not isinstance(glsl, str) or not glsl.strip() or DIRECTIVE_PATTERN.search(glsl):
            errors.append(f"{field}.glsl — one function, no #version / #extension / #include")
        wgsl = declaration.get("wgsl")
        if wgsl is not None and not isinstance(wgsl, str):
            errors.append(f"{field}.wgsl — string or null")

        # An effect may reach past its object; the filter's texture grows by it.
        padding = declaration.get("padding")
        if padding is not None:
            plus = padding.get("plus", 0) if isinstance(padding, dict) else None
            scale = padding.get("scale", {}) if isinstance(padding, dict) else None
            if (slot != "effect" or not is_number(plus) or plus < 0 or not isinstance(scale, dict)
                    or any(key not in numbers or not is_number(factor) or factor < 0 for key, factor in scale.items())):
                errors.append(f"{field}.padding — on an effect: {{ plus ≥ 0, scale: {{ <number param>: factor ≥ 0 }} }}")
            elif plus + sum(numbers[key] * factor for key, factor in scale.items()) > MAX_PADDING:
                errors.append(f"{field}.padding — reach at most {MAX_PADDING} px with every scaled param at its max")


def validate(folder: Path):
    errors = []

    manifests = [name for name in KINDS if (folder / name).is_file()]
    if len(manifests) != 1:
        fail([f"{folder} — exactly one of {' or '.join(KINDS)} required"])
    manifest_name = manifests[0]
    manifest_path = folder / manifest_name
    if manifest_path.stat().st_size > MAX_MANIFEST_BYTES:
        fail([f"{manifest_name} — over {MAX_MANIFEST_BYTES} bytes"])
    try:
        manifest = json.loads(manifest_path.read_text(encoding="utf-8-sig"))
    except (json.JSONDecodeError, UnicodeDecodeError) as parse_error:
        fail([f"{manifest_name} is not valid JSON: {parse_error}"])

    # Everything in the folder is packed except hidden files (.git,
    # .DS_Store) and earlier packages. main/icon must name one of these
    # entries exactly — the editor looks them up by that name.
    files = sorted(
        path for path in folder.rglob("*")
        if path.is_file() and path.suffix not in KINDS.values()
        and not any(part.startswith(".") for part in path.relative_to(folder).parts)
    )
    entries = {path.relative_to(folder).as_posix() for path in files}

    plugin_id = manifest.get("id")
    if not isinstance(plugin_id, str) or not ID_PATTERN.fullmatch(plugin_id) or ".." in plugin_id:
        errors.append('id — lowercase reverse-domain, [a-z0-9.-] only, no ".."')
    elif len(plugin_id) > MAX_ID:
        errors.append(f"id — over {MAX_ID} chars")
    elif plugin_id in RESERVED_IDS:
        errors.append(f"id — '{plugin_id}' is reserved")

    name = manifest.get("name")
    if not isinstance(name, str) or not name.strip():
        errors.append("name — non-empty string required")
    elif js_length(name.strip()) > MAX_NAME:
        errors.append(f"name — over {MAX_NAME} chars")

    version = manifest.get("version")
    if not isinstance(version, str) or not VERSION_PATTERN.fullmatch(version):
        errors.append("version — exact x.y.z required")

    api = manifest.get("api")
    if not isinstance(api, int) or isinstance(api, bool) or api < 1:
        errors.append("api — positive integer required")
    elif api != API_VERSION:
        errors.append(f"api — editors speak api {API_VERSION}; {api} will be refused at load")

    if manifest_name == "plugin.json":
        main = manifest.get("main")
        if not isinstance(main, str) or not main.strip():
            errors.append("main — non-empty entry filename required")
        elif main not in entries:
            errors.append(f"main — '{main}' is not one of the packed files (its path inside the folder; hidden files are left out)")
    else:
        check_dynamics(manifest.get("dynamics"), errors)

    description = manifest.get("description")
    if description is not None:
        if not isinstance(description, str):
            errors.append("description — string when present")
        elif js_length(description.strip()) > MAX_DESCRIPTION:
            errors.append(f"description — over {MAX_DESCRIPTION} chars")
    check_localized(manifest.get("description_localized"), "description_localized", MAX_DESCRIPTION, errors)

    author = manifest.get("author")
    if author is not None:
        if not isinstance(author, str):
            errors.append("author — string when present")
        elif js_length(author.strip()) > MAX_AUTHOR:
            errors.append(f"author — over {MAX_AUTHOR} chars")

    icon = manifest.get("icon")
    if icon is not None:
        if not isinstance(icon, str) or not icon.strip():
            errors.append("icon — non-empty filename when present")
        elif icon not in entries:
            errors.append(f"icon — '{icon}' is not one of the packed files (its path inside the folder; hidden files are left out)")
        elif icon.rsplit(".", 1)[-1].lower() not in ICON_EXTS:
            errors.append(f"icon — extension must be one of {'/'.join(sorted(ICON_EXTS))}")

    # A dynamic pack's shaders ride in its manifest: the package is the
    # manifest and its icon, whatever sources sit beside them.
    if manifest_name == "dynamic.json":
        files = [file for file in files if file.relative_to(folder).as_posix() in (manifest_name, icon)]

    if len(files) > MAX_ENTRIES:
        errors.append(f"package — {len(files)} files, cap is {MAX_ENTRIES}")
    for file in files:
        if file.stat().st_size > MAX_FILE_BYTES:
            errors.append(f"package — '{file.name}' over {MAX_FILE_BYTES} bytes")

    if errors:
        fail(errors)
    return manifest, files, KINDS[manifest_name]


def main():
    parser = argparse.ArgumentParser(description="Validate and pack an SSHOW plugin or dynamic pack")
    parser.add_argument("folder", type=Path)
    parser.add_argument("--check", action="store_true", help="validate only")
    parser.add_argument("--out", type=Path, help="output package path")
    args = parser.parse_args()

    folder = args.folder.resolve()
    if not folder.is_dir():
        fail([f"{folder} is not a directory"])

    manifest, files, extension = validate(folder)
    print(f"  ✓ {manifest['id']}@{manifest['version']} — {len(files)} file(s) valid")
    if args.check:
        return

    out = args.out or folder.parent / f"{manifest['id']}-{manifest['version']}{extension}"
    out.parent.mkdir(parents=True, exist_ok=True)
    with zipfile.ZipFile(out, "w", zipfile.ZIP_DEFLATED) as archive:
        for file in files:
            archive.write(file, file.relative_to(folder).as_posix())

    size = out.stat().st_size
    if size > MAX_PACKAGE_BYTES:
        out.unlink()
        fail([f"package — {size} bytes zipped, cap is {MAX_PACKAGE_BYTES}"])
    print(f"  ✓ wrote {out} ({size:,} bytes)")


if __name__ == "__main__":
    main()
