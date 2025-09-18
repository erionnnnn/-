#!/usr/bin/env python3
"""Convert a simple XLSX file into JSON rows.

The script prints a JSON array where the first element is the header row
and each subsequent element is a row of cell values. Only the first
worksheet is read.
"""
from __future__ import annotations

import json
import re
import sys
import zipfile
from collections import defaultdict
from pathlib import Path
from xml.etree import ElementTree as ET

NS = {
    "main": "http://schemas.openxmlformats.org/spreadsheetml/2006/main",
}


def column_index(cell_ref: str) -> int:
    """Return zero-based column index for an Excel cell reference."""
    match = re.match(r"([A-Z]+)", cell_ref.upper())
    if not match:
        return 0
    result = 0
    for char in match.group(1):
        result = result * 26 + (ord(char) - ord("A") + 1)
    return result - 1


def read_shared_strings(zf: zipfile.ZipFile) -> list[str]:
    if "xl/sharedStrings.xml" not in zf.namelist():
        return []
    root = ET.fromstring(zf.read("xl/sharedStrings.xml"))
    strings: list[str] = []
    for si in root.findall("main:si", NS):
        text_fragments = []
        for node in si.findall(".//main:t", NS):
            text_fragments.append(node.text or "")
        strings.append("".join(text_fragments))
    return strings


def read_sheet_rows(zf: zipfile.ZipFile, shared_strings: list[str]) -> list[list[str]]:
    sheet_name = "xl/worksheets/sheet1.xml"
    if sheet_name not in zf.namelist():
        raise FileNotFoundError("The workbook must contain sheet1.xml")
    root = ET.fromstring(zf.read(sheet_name))
    rows: list[list[str]] = []
    for row in root.findall(".//main:row", NS):
        cells = defaultdict(str)
        for cell in row.findall("main:c", NS):
            ref = cell.attrib.get("r", "")
            idx = column_index(ref)
            cell_type = cell.attrib.get("t")
            value_node = cell.find("main:v", NS)
            value = ""
            if value_node is not None and value_node.text is not None:
                value = value_node.text
                if cell_type == "s":
                    try:
                        value = shared_strings[int(value)]
                    except (IndexError, ValueError):
                        value = value_node.text or ""
            cells[idx] = value
        if cells:
            max_index = max(cells.keys())
            row_values = [cells.get(i, "") for i in range(max_index + 1)]
            rows.append(row_values)
    return rows


def main(path: str) -> None:
    file_path = Path(path)
    if not file_path.exists():
        raise SystemExit(f"File not found: {file_path}")
    with zipfile.ZipFile(file_path) as zf:
        shared_strings = read_shared_strings(zf)
        rows = read_sheet_rows(zf, shared_strings)
    print(json.dumps(rows))


if __name__ == "__main__":
    if len(sys.argv) != 2:
        raise SystemExit("Usage: parse_xlsx.py <file>")
    main(sys.argv[1])
