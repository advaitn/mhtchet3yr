#!/usr/bin/env python3.11
"""Download and extract FE institute-wise CAP allotment PDFs from mahacet.org."""

from __future__ import annotations

import argparse
import csv
import json
import re
import sys
import time
from dataclasses import asdict, dataclass
from pathlib import Path
from urllib.parse import urlparse

import pdfplumber
import requests
from bs4 import BeautifulSoup

ROOT_DIR = Path(__file__).resolve().parent
FE_OUTPUT_DIR = ROOT_DIR / "fe_output"

INDEX_URL_CANDIDATES = [
    "https://fe{year}.mahacet.org/StaticPages/frmInstituteWiseAllotmentList",
    "https://fe{year}.mahacet.org/StaticPages/frmInstituteWiseAllotmentList?did={did}",
    "https://fe{year}.mahacet.org/StaticPages/frmInstituteWiseAllotmentList.aspx",
    "https://fe{year}.mahacet.org/StaticPages/frmInstituteWiseAllotmentList.aspx?did={did}",
]

CAP_ROUND_FROM_URL = re.compile(r"/CAP-([^/]+)/", re.I)
INSTITUTE_ROW_RE = re.compile(r"^(\d{5})\s+(.+)$")
COURSE_ROW_RE = re.compile(r"^(\d{10,11})\s+-\s+(.+)$")
CANDIDATE_ROW_RE = re.compile(
    r"^(\d+)\s+(\d+)\s+([\d.]+)\s+(EN\d+)\s+(.+)\s+([MF])\s+(.+)\s+(\S+)$"
)

SKIP_LINE_PREFIXES = (
    "Government of Maharashtra",
    "State Common Entrance Test Cell",
    "Provisional Allotment",
    "Degree Courses",
    "Integrated 5 Years",
    "Meri Sr.",
    "Merit MHT-CET",
    "No. No. Score",
    "Status:",
    "Sanction Intake:",
    "Institute Seats",
    "P ",
    "r ",
)

SECTION_KEYWORDS = ("seat", "allotted", "level", "minority", "university")


@dataclass
class ManifestRow:
    year: str
    did: str
    institute_code: str
    institute_name: str
    cap_round: str
    pdf_url: str
    local_path: str
    download_status: str


@dataclass
class AllotmentRow:
    year: str
    cap_round: str
    institute_code: str
    institute_name: str
    course_code: str
    course_name: str
    seat_section: str
    merit_no: str
    sr_merit_no: str
    mht_cet_score: str
    application_id: str
    candidate_name: str
    gender: str
    candidate_category: str
    seat_type: str
    source_pdf: str


def year_output_dir(year: str) -> Path:
    return FE_OUTPUT_DIR / f"fe{year}"


def configure_paths(year: str) -> dict[str, Path]:
    base = year_output_dir(year)
    return {
        "base": base,
        "pdfs": base / "pdfs",
        "manifest": base / "manifest.csv",
        "allotments": base / "allotments.csv",
        "progress_download": base / "progress_download.json",
        "progress_extract": base / "progress_extract.json",
        "warnings": base / "extract_warnings.log",
    }


def load_progress(path: Path) -> set[str]:
    if not path.exists():
        return set()
    with path.open(encoding="utf-8") as handle:
        data = json.load(handle)
    return set(data.get("completed_keys", []))


def save_progress(path: Path, completed: set[str]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("w", encoding="utf-8") as handle:
        json.dump({"completed_keys": sorted(completed)}, handle, indent=2)


def make_session() -> requests.Session:
    session = requests.Session()
    session.headers.update(
        {
            "User-Agent": (
                "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
                "AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
            )
        }
    )
    return session


def fetch_index_html(session: requests.Session, year: str, did: str) -> tuple[str, str]:
    last_error: Exception | None = None
    for template in INDEX_URL_CANDIDATES:
        url = template.format(year=year, did=did)
        try:
            response = session.get(url, timeout=60)
            if response.status_code == 404:
                continue
            response.raise_for_status()
            if "Institute-Wise Allotment" not in response.text:
                continue
            return response.text, url
        except requests.RequestException as exc:
            last_error = exc
    raise RuntimeError(f"Could not fetch index page for fe{year}") from last_error


def parse_cap_round(url: str) -> str:
    match = CAP_ROUND_FROM_URL.search(url)
    return f"CAP-{match.group(1)}" if match else "CAP-?"


def parse_institutes(html: str, year: str) -> list[dict[str, object]]:
    soup = BeautifulSoup(html, "html.parser")
    institutes: list[dict[str, object]] = []

    for tr in soup.find_all("tr"):
        tds = tr.find_all("td", class_="Item")
        if len(tds) < 4:
            continue
        sr_no = tds[0].get_text(strip=True).rstrip(".")
        if not sr_no.isdigit():
            continue

        institute_code = tds[1].get_text(strip=True)
        institute_name = tds[2].get_text(strip=True)
        pdf_links: list[dict[str, str]] = []

        for td in tds[3:]:
            anchor = td.find("a", href=True)
            if not anchor:
                continue
            href = anchor["href"].strip()
            if not href.lower().endswith(".pdf"):
                continue
            pdf_links.append(
                {
                    "cap_round": parse_cap_round(href),
                    "pdf_url": href,
                }
            )

        if pdf_links:
            institutes.append(
                {
                    "sr_no": sr_no,
                    "institute_code": institute_code,
                    "institute_name": institute_name,
                    "pdf_links": pdf_links,
                }
            )

    return institutes


def local_pdf_path(pdfs_dir: Path, cap_round: str, institute_code: str, pdf_url: str) -> Path:
    filename = Path(urlparse(pdf_url).path).name
    if not filename:
        filename = f"CAPR_{institute_code}.pdf"
    return pdfs_dir / cap_round / filename


def download_pdf(
    session: requests.Session,
    url: str,
    dest: Path,
    retries: int = 5,
) -> str:
    dest.parent.mkdir(parents=True, exist_ok=True)
    last_error: Exception | None = None

    for attempt in range(retries):
        try:
            response = session.get(url, timeout=120)
            if response.status_code == 404:
                return "404"
            response.raise_for_status()
            if not response.content.startswith(b"%PDF"):
                return "invalid"
            dest.write_bytes(response.content)
            return "ok"
        except requests.RequestException as exc:
            last_error = exc
            time.sleep(2**attempt)

    raise RuntimeError(f"Download failed for {url}") from last_error


def append_manifest(rows: list[ManifestRow], manifest_path: Path) -> None:
    if not rows:
        return
    fieldnames = list(ManifestRow.__annotations__.keys())
    write_header = not manifest_path.exists()
    with manifest_path.open("a", newline="", encoding="utf-8") as handle:
        writer = csv.DictWriter(handle, fieldnames=fieldnames)
        if write_header:
            writer.writeheader()
        for row in rows:
            writer.writerow(asdict(row))


def phase_download(year: str, did: str, delay: float = 0.15) -> int:
    paths = configure_paths(year)
    paths["base"].mkdir(parents=True, exist_ok=True)

    session = make_session()
    html, index_url = fetch_index_html(session, year, did)
    print(f"Index: {index_url}")

    institutes = parse_institutes(html, year)
    print(f"Found {len(institutes)} institutes")

    completed = load_progress(paths["progress_download"])
    downloaded = 0

    for inst in institutes:
        code = str(inst["institute_code"])
        name = str(inst["institute_name"])
        for link in inst["pdf_links"]:
            cap_round = str(link["cap_round"])
            pdf_url = str(link["pdf_url"])
            local_path = local_pdf_path(paths["pdfs"], cap_round, code, pdf_url)
            key = str(local_path.relative_to(paths["base"]))

            if key in completed and local_path.exists():
                continue

            status = download_pdf(session, pdf_url, local_path)
            append_manifest(
                [
                    ManifestRow(
                        year=year,
                        did=did,
                        institute_code=code,
                        institute_name=name,
                        cap_round=cap_round,
                        pdf_url=pdf_url,
                        local_path=key,
                        download_status=status,
                    )
                ],
                paths["manifest"],
            )
            completed.add(key)
            save_progress(paths["progress_download"], completed)
            downloaded += 1
            print(f"[{len(completed)}] {cap_round} / {code} -> {status}")
            time.sleep(delay)

    return downloaded


def should_skip_line(line: str) -> bool:
    stripped = line.strip()
    if not stripped:
        return True
    if any(stripped.startswith(prefix) for prefix in SKIP_LINE_PREFIXES):
        return True
    if stripped in {"State Level Seats", "No. No. Score Category"}:
        return True
    return False


def is_section_line(line: str) -> bool:
    lower = line.lower()
    if CANDIDATE_ROW_RE.match(line) or COURSE_ROW_RE.match(line):
        return False
    if INSTITUTE_ROW_RE.match(line) and not COURSE_ROW_RE.match(line):
        return False
    return any(keyword in lower for keyword in SECTION_KEYWORDS)


def parse_pdf_text(
    text: str,
    *,
    year: str,
    cap_round: str,
    institute_code: str,
    institute_name: str,
    source_pdf: str,
    warnings: list[str],
) -> list[AllotmentRow]:
    rows: list[AllotmentRow] = []
    current_institute_code = institute_code
    current_institute_name = institute_name
    current_course_code = ""
    current_course_name = ""
    current_section = ""

    for raw_line in text.splitlines():
        line = raw_line.strip()
        if should_skip_line(line):
            continue

        course_match = COURSE_ROW_RE.match(line)
        if course_match:
            current_course_code = course_match.group(1)
            current_course_name = course_match.group(2).strip()
            continue

        institute_match = INSTITUTE_ROW_RE.match(line)
        if institute_match and not course_match:
            code = institute_match.group(1)
            if len(code) == 5:
                current_institute_code = code
                current_institute_name = institute_match.group(2).strip()
                continue

        if is_section_line(line):
            current_section = line
            continue

        candidate_match = CANDIDATE_ROW_RE.match(line)
        if candidate_match:
            rows.append(
                AllotmentRow(
                    year=year,
                    cap_round=cap_round,
                    institute_code=current_institute_code,
                    institute_name=current_institute_name,
                    course_code=current_course_code,
                    course_name=current_course_name,
                    seat_section=current_section,
                    merit_no=candidate_match.group(1),
                    sr_merit_no=candidate_match.group(2),
                    mht_cet_score=candidate_match.group(3),
                    application_id=candidate_match.group(4),
                    candidate_name=candidate_match.group(5).strip(),
                    gender=candidate_match.group(6),
                    candidate_category=candidate_match.group(7).strip(),
                    seat_type=candidate_match.group(8),
                    source_pdf=source_pdf,
                )
            )
            continue

        if re.match(r"^\d+\s+\d+\s+[\d.]+\s+EN", line):
            warnings.append(f"unparsed candidate line in {source_pdf}: {line[:120]}")

    return rows


def append_allotments(rows: list[AllotmentRow], allotments_path: Path) -> None:
    if not rows:
        return
    fieldnames = list(AllotmentRow.__annotations__.keys())
    write_header = not allotments_path.exists()
    with allotments_path.open("a", newline="", encoding="utf-8") as handle:
        writer = csv.DictWriter(handle, fieldnames=fieldnames)
        if write_header:
            writer.writeheader()
        for row in rows:
            writer.writerow(asdict(row))


def load_manifest(manifest_path: Path) -> list[dict[str, str]]:
    if not manifest_path.exists():
        return []
    with manifest_path.open(encoding="utf-8") as handle:
        return list(csv.DictReader(handle))


def phase_extract(year: str) -> int:
    paths = configure_paths(year)
    manifest_rows = load_manifest(paths["manifest"])
    if not manifest_rows:
        print("No manifest.csv found — run download phase first.")
        return 0

    completed = load_progress(paths["progress_extract"])
    extracted_count = 0
    warnings: list[str] = []

    ok_rows = [r for r in manifest_rows if r.get("download_status") == "ok"]
    print(f"Extracting from {len(ok_rows)} PDFs")

    for entry in ok_rows:
        rel_path = entry["local_path"]
        if rel_path in completed:
            continue

        pdf_path = paths["base"] / rel_path
        if not pdf_path.exists():
            warnings.append(f"missing file: {rel_path}")
            continue

        text_parts: list[str] = []
        with pdfplumber.open(pdf_path) as pdf:
            for page in pdf.pages:
                text_parts.append(page.extract_text() or "")

        rows = parse_pdf_text(
            "\n".join(text_parts),
            year=year,
            cap_round=entry["cap_round"],
            institute_code=entry["institute_code"],
            institute_name=entry["institute_name"],
            source_pdf=rel_path,
            warnings=warnings,
        )
        append_allotments(rows, paths["allotments"])
        extracted_count += len(rows)
        completed.add(rel_path)
        save_progress(paths["progress_extract"], completed)
        print(f"[{len(completed)}/{len(ok_rows)}] {rel_path} -> {len(rows)} rows")

    if warnings:
        with paths["warnings"].open("a", encoding="utf-8") as handle:
            for warning in warnings:
                handle.write(warning + "\n")

    return extracted_count


def try_fe2023(did: str) -> None:
    session = make_session()
    try:
        fetch_index_html(session, "2023", did)
    except RuntimeError:
        print("fe2023: allotment page not available (404) — skipping.")


def main() -> int:
    parser = argparse.ArgumentParser(description="FE institute-wise CAP allotment PDF scraper")
    parser.add_argument("--year", choices=["2023", "2024", "2025"], required=True)
    parser.add_argument("--did", default="2021", help="Document ID (default: 2021)")
    parser.add_argument(
        "--phase",
        choices=["download", "extract", "all"],
        default="all",
        help="Run download, extract, or both",
    )
    parser.add_argument("--delay", type=float, default=0.15, help="Delay between PDF downloads")
    args = parser.parse_args()

    if args.year == "2023":
        try_fe2023(args.did)
        return 0

    if args.phase in ("download", "all"):
        print(f"=== Download fe{args.year} ===")
        count = phase_download(args.year, args.did, delay=args.delay)
        print(f"Downloaded {count} new PDFs")

    if args.phase in ("extract", "all"):
        print(f"=== Extract fe{args.year} ===")
        count = phase_extract(args.year)
        print(f"Extracted {count} new candidate rows")

    paths = configure_paths(args.year)
    print(f"Output: {paths['base']}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
