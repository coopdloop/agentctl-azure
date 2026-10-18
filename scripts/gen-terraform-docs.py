#!/usr/bin/env python3
"""Generates docs/reference/terraform.md from infra/modules/agentctl/variables.tf (run after changing inputs)."""
import re, pathlib
root = pathlib.Path(__file__).resolve().parent.parent
src = (root / "infra/modules/agentctl/variables.tf").read_text()
rows = []
for m in re.finditer(r'variable "(\w+)" \{(.*?)\n\}', src, re.S):
    name, body = m.group(1), m.group(2)
    d = re.search(r'description\s*=\s*(?:"((?:[^"\\]|\\.)*)"|<<-EOT\n(.*?)\n\s*EOT)', body, re.S)
    desc = (d.group(1) or d.group(2) or "").strip() if d else ""
    desc = " ".join(l.strip() for l in desc.splitlines()).replace("<", "&lt;").replace("|", "\\|").replace('\\"', '"')
    t = re.search(r'\n  type\s*=\s*(\w+)', body)
    typ = t.group(1) if t else "any"
    if "type = object" in body or "type = map(object" in body: typ = "object" if "type = object" in body else "map(object)"
    dflt = re.search(r'\n  default\s*=\s*(.+)', body)
    default = dflt.group(1).strip() if dflt else "**required**"
    if len(default) > 40: default = default[:37] + "…"
    rows.append(f"| `{name}` | {typ} | `{default}` | {desc} |" if dflt else f"| `{name}` | {typ} | {default} | {desc} |")
out = ["# Terraform inputs", "",
       "Inputs of the `agentctl` module (`infra/modules/agentctl`). Generated from `variables.tf` by `scripts/gen-terraform-docs.py`.", "",
       "Object inputs accept partial values: omitted attributes take their defaults. See `infra/terraform.tfvars.example` for a commented example of every common input.", "",
       "| Input | Type | Default | Description |", "|---|---|---|---|", *rows, "",
       "## Outputs", "",
       "| Output | Description |", "|---|---|"]
for m in re.finditer(r'output "(\w+)" \{(.*?)\n\}', (root / "infra/modules/agentctl/outputs.tf").read_text(), re.S):
    d = re.search(r'description\s*=\s*"([^"]*)"', m.group(2))
    out.append(f"| `{m.group(1)}` | {d.group(1) if d else ''} |")
(root / "docs/reference/terraform.md").write_text("\n".join(out) + "\n")
print(f"wrote docs/reference/terraform.md ({len(rows)} inputs)")
