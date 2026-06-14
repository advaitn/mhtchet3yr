#!/usr/bin/env python3.11
"""
Scrape institute-wise allotment tables from mahacet.org (LLB-3 or LLB-5).

Strategy: for each (college, division), fetch ALL CAP phases in one pass so a
single network round-trip cycle covers all rounds. Progress is keyed by
(college_id, division_id) not by phase, so resuming continues per-college.
"""

from __future__ import annotations

import argparse
import csv
import json
import sys
import time
from concurrent.futures import ThreadPoolExecutor, as_completed
from dataclasses import asdict, dataclass
from pathlib import Path
from threading import Lock

import requests
from bs4 import BeautifulSoup

OUTPUT_DIR = Path(__file__).resolve().parent / "output"

BASE_URL: str
CSV_PATH: Path
PROGRESS_PATH: Path

FIELD_PHASE = "ctl00$ContentPlaceHolder1$ddlPhase"
FIELD_UNI   = "ctl00$ContentPlaceHolder1$ddlUniversity"
FIELD_COL   = "ctl00$ContentPlaceHolder1$ddlCollege"
FIELD_DIV   = "ctl00$ContentPlaceHolder1$ddlDivision"
FIELD_BTN   = "ctl00$ContentPlaceHolder1$btnShowAllotment"

# All CAP rounds — we scrape every one and store phase label on each row.
# Taking MIN across all phases gives the true cumulative cutoff.
PHASES = [
    ("1", "Round-I"),
    ("2", "Round-II"),
    ("3", "Round-III"),
    ("4", "Inst-Level"),
    ("5", "Inst-Level-Ext"),
]
# These values come directly from the page's <select> — value 4 = Institute Level, 5 = Extended, 1-3 = Rounds


@dataclass
class AllotmentRow:
    year: str
    course: str
    phase: str
    university_id: str
    university_name: str
    college_id: str
    college_name: str
    division_id: str
    division_name: str
    eligible_category: str
    allotted_type: str
    eligible_quota: str
    allotted_quota: str
    merit_marks: str


# ── helpers ────────────────────────────────────────────────────────────────────

def get_hidden(soup: BeautifulSoup, name: str) -> str:
    el = soup.find("input", {"name": name})
    return el["value"] if el else ""


def post_form(
    session: requests.Session,
    soup: BeautifulSoup,
    fields: dict[str, str],
    retries: int = 5,
) -> BeautifulSoup:
    last_error: Exception | None = None
    for attempt in range(retries):
        payload = {
            "__VIEWSTATE": get_hidden(soup, "__VIEWSTATE"),
            "__EVENTVALIDATION": get_hidden(soup, "__EVENTVALIDATION"),
            "__VIEWSTATEGENERATOR": get_hidden(soup, "__VIEWSTATEGENERATOR"),
        }
        payload.update(fields)
        try:
            resp = session.post(BASE_URL, data=payload, timeout=90)
            resp.raise_for_status()
            return BeautifulSoup(resp.text, "html.parser")
        except requests.RequestException as exc:
            last_error = exc
            wait = 2 ** attempt
            time.sleep(wait)
    raise RuntimeError("post_form failed") from last_error


def fetch_fresh(session: requests.Session, retries: int = 5) -> BeautifulSoup:
    for attempt in range(retries):
        try:
            resp = session.get(BASE_URL, timeout=60)
            resp.raise_for_status()
            return BeautifulSoup(resp.text, "html.parser")
        except requests.RequestException:
            time.sleep(2 ** attempt)
    raise RuntimeError("fetch failed")


def select_opts(soup: BeautifulSoup, sel_id: str) -> list[tuple[str, str]]:
    sel = soup.find("select", {"id": sel_id})
    if not sel:
        return []
    return [
        (o["value"], o.get_text(strip=True))
        for o in sel.find_all("option")
        if o.get("value") and o["value"] not in ("-1", "0", "")
    ]


def make_session() -> requests.Session:
    s = requests.Session()
    s.headers["User-Agent"] = (
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
        "AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
    )
    return s


# ── parsing ────────────────────────────────────────────────────────────────────

def parse_table(
    soup: BeautifulSoup,
    year: str,
    course: str,
    phase_label: str,
    uni_id: str,
    uni_name: str,
    col_id: str,
    col_name: str,
    div_id: str,
    div_name: str,
) -> list[AllotmentRow]:
    table = soup.find("table")
    if not table:
        return []
    rows: list[AllotmentRow] = []
    for tr in table.find_all("tr"):
        tds = [td.get_text(strip=True) for td in tr.find_all("td")]
        if len(tds) < 9 or not tds[0].isdigit():
            continue
        try:
            m = float(tds[8])
        except ValueError:
            continue
        if m <= 0 or m > 100:
            continue
        rows.append(AllotmentRow(
            year=year, course=course, phase=phase_label,
            university_id=uni_id, university_name=uni_name,
            college_id=col_id, college_name=col_name,
            division_id=div_id, division_name=div_name,
            eligible_category=tds[3],
            allotted_type=tds[4],
            eligible_quota=tds[5],
            allotted_quota=tds[6],
            merit_marks=tds[8],
        ))
    return rows


# ── progress / CSV I/O ─────────────────────────────────────────────────────────

_csv_lock: Lock = Lock()
_prog_lock: Lock = Lock()
_completed: set[str] = set()


def load_progress() -> set[str]:
    if not PROGRESS_PATH.exists():
        return set()
    with PROGRESS_PATH.open(encoding="utf-8") as f:
        return set(json.load(f).get("completed_keys", []))


def save_progress() -> None:
    with _prog_lock:
        OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
        with PROGRESS_PATH.open("w", encoding="utf-8") as f:
            json.dump({"completed_keys": sorted(_completed)}, f, indent=2)


def append_rows(rows: list[AllotmentRow]) -> None:
    if not rows:
        return
    fields = list(AllotmentRow.__annotations__.keys())
    with _csv_lock:
        OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
        write_header = not CSV_PATH.exists()
        with CSV_PATH.open("a", newline="", encoding="utf-8") as f:
            writer = csv.DictWriter(f, fieldnames=fields)
            if write_header:
                writer.writeheader()
            for r in rows:
                writer.writerow(asdict(r))


# ── per-division worker ────────────────────────────────────────────────────────

def scrape_division(
    year: str,
    course: str,
    uni_id: str,
    uni_name: str,
    col_id: str,
    col_name: str,
    div_id: str,
    div_name: str,
    delay: float,
) -> tuple[str, int]:
    """Fetch allotment data for ONE division across ALL phases. Returns (key, row_count)."""
    key = f"{uni_id}|{col_id}|{div_id}"
    all_rows: list[AllotmentRow] = []

    s = make_session()

    for phase_val, phase_label in PHASES:
        try:
            soup = fetch_fresh(s)
            # select phase
            soup = post_form(s, soup, {
                "__EVENTTARGET": FIELD_PHASE, "__EVENTARGUMENT": "",
                FIELD_PHASE: phase_val, FIELD_UNI: "-1", FIELD_COL: "-1", FIELD_DIV: "-1",
            })
            # check college is available in this phase
            unis_available = {v for v, _ in select_opts(soup, "ContentPlaceHolder1_ddlUniversity")}
            if uni_id not in unis_available:
                continue  # phase doesn't have this university

            soup = post_form(s, soup, {
                "__EVENTTARGET": FIELD_UNI, "__EVENTARGUMENT": "",
                FIELD_PHASE: phase_val, FIELD_UNI: uni_id, FIELD_COL: "-1", FIELD_DIV: "-1",
            })
            cols_available = {v for v, _ in select_opts(soup, "ContentPlaceHolder1_ddlCollege")}
            if col_id not in cols_available:
                continue

            soup = post_form(s, soup, {
                "__EVENTTARGET": FIELD_COL, "__EVENTARGUMENT": "",
                FIELD_PHASE: phase_val, FIELD_UNI: uni_id, FIELD_COL: col_id, FIELD_DIV: "-1",
            })
            divs_available = {v for v, _ in select_opts(soup, "ContentPlaceHolder1_ddlDivision")}
            if div_id not in divs_available:
                continue

            result = post_form(s, soup, {
                FIELD_PHASE: phase_val, FIELD_UNI: uni_id, FIELD_COL: col_id,
                FIELD_DIV: div_id, FIELD_BTN: "Show Allotment List",
            })
            rows = parse_table(result, year, course, phase_label, uni_id, uni_name, col_id, col_name, div_id, div_name)
            all_rows.extend(rows)
            time.sleep(delay)

        except Exception as exc:
            print(f"  [WARN] {phase_label} {key}: {exc}")

    append_rows(all_rows)
    with _prog_lock:
        _completed.add(key)
    save_progress()
    return key, len(all_rows)


# ── main scrape orchestration ──────────────────────────────────────────────────

def _enum_university(
    uni_id: str,
    uni_name: str,
    phase1_soup: BeautifulSoup,
) -> list[tuple[str, str, str, str, str, str]]:
    """Enumerate all (col, div) pairs for one university using its own session."""
    s = make_session()
    soup = fetch_fresh(s)
    usoup = post_form(s, soup, {
        "__EVENTTARGET": FIELD_PHASE, "__EVENTARGUMENT": "",
        FIELD_PHASE: "1", FIELD_UNI: "-1", FIELD_COL: "-1", FIELD_DIV: "-1",
    })
    usoup = post_form(s, usoup, {
        "__EVENTTARGET": FIELD_UNI, "__EVENTARGUMENT": "",
        FIELD_PHASE: "1", FIELD_UNI: uni_id, FIELD_COL: "-1", FIELD_DIV: "-1",
    })
    colleges = select_opts(usoup, "ContentPlaceHolder1_ddlCollege")
    divs_found: list[tuple[str, str, str, str, str, str]] = []
    for col_id, col_name in colleges:
        csoup = post_form(s, usoup, {
            "__EVENTTARGET": FIELD_COL, "__EVENTARGUMENT": "",
            FIELD_PHASE: "1", FIELD_UNI: uni_id, FIELD_COL: col_id, FIELD_DIV: "-1",
        })
        for div_id, div_name in select_opts(csoup, "ContentPlaceHolder1_ddlDivision"):
            divs_found.append((uni_id, uni_name, col_id, col_name, div_id, div_name))
    return divs_found


def build_division_list(year: str, course: str) -> list[tuple[str, str, str, str, str, str]]:
    """Return (uni_id, uni_name, col_id, col_name, div_id, div_name) for all divisions.
    Universities are enumerated in parallel for speed."""
    s = make_session()
    soup = fetch_fresh(s)
    soup = post_form(s, soup, {
        "__EVENTTARGET": FIELD_PHASE, "__EVENTARGUMENT": "",
        FIELD_PHASE: "1", FIELD_UNI: "-1", FIELD_COL: "-1", FIELD_DIV: "-1",
    })
    unis = select_opts(soup, "ContentPlaceHolder1_ddlUniversity")
    print(f"Enumerating {len(unis)} universities in parallel…")

    all_divisions: list[tuple[str, str, str, str, str, str]] = []
    with ThreadPoolExecutor(max_workers=len(unis)) as pool:
        futures = {pool.submit(_enum_university, uid, uname, soup): (uid, uname) for uid, uname in unis}
        for f in as_completed(futures):
            try:
                all_divisions.extend(f.result())
            except Exception as exc:
                print(f"  [WARN] enum failed for {futures[f]}: {exc}")

    print(f"Found {len(all_divisions)} divisions to scrape.")
    return all_divisions


def configure(year: str, course: str) -> None:
    global BASE_URL, CSV_PATH, PROGRESS_PATH
    BASE_URL = f"https://llb{course}cap{year}.mahacet.org/Public/InstituteWiseAllotmentList.aspx"
    CSV_PATH = OUTPUT_DIR / f"allotment_llb{course}_{year}.csv"
    PROGRESS_PATH = OUTPUT_DIR / f"progress_allot_llb{course}_{year}.json"


def main() -> int:
    global _completed

    parser = argparse.ArgumentParser()
    parser.add_argument("--course", choices=["3", "5"], default="3")
    parser.add_argument("--year", choices=["23", "24", "25"], default="25")
    parser.add_argument("--workers", type=int, default=8,
                        help="Parallel workers (each handles one division across all phases)")
    parser.add_argument("--delay", type=float, default=0.3)
    args = parser.parse_args()

    configure(args.year, args.course)
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)

    print(f"Scraping: LLB-{args.course} 20{args.year}")
    print(f"URL: {BASE_URL}")
    print(f"CSV: {CSV_PATH}")
    print(f"Workers: {args.workers}")

    _completed = load_progress()
    print(f"Resuming from {len(_completed)} completed divisions.")

    divisions = build_division_list(args.year, args.course)
    pending = [(u,un,c,cn,d,dn) for u,un,c,cn,d,dn in divisions if f"{u}|{c}|{d}" not in _completed]
    print(f"Pending: {len(pending)} of {len(divisions)}")

    total_rows = 0
    done = 0

    with ThreadPoolExecutor(max_workers=args.workers) as pool:
        futures = {
            pool.submit(scrape_division, args.year, args.course, *div, args.delay): div
            for div in pending
        }
        for future in as_completed(futures):
            try:
                key, n = future.result()
                total_rows += n
                done += 1
                col_name = futures[future][2]  # col_id
                print(f"[{done}/{len(pending)}] {key} -> {n} rows (total {total_rows})")
            except Exception as exc:
                print(f"  [ERROR] {futures[future]}: {exc}")

    print(f"\nDone. {total_rows} allotment rows scraped. CSV: {CSV_PATH}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
