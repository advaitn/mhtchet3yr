#!/usr/bin/env python3.11
"""Scrape all merit list tables from mahacet.org MeritListWL.aspx (LLB-3 or LLB-5)."""

from __future__ import annotations

import argparse
import csv
import json
import sys
import time
from dataclasses import asdict, dataclass
from pathlib import Path

import requests
from bs4 import BeautifulSoup

OUTPUT_DIR = Path(__file__).resolve().parent / "output"

BASE_URL: str
CSV_PATH: Path
JSON_PATH: Path
PROGRESS_PATH: Path

FIELD_UNI = "ctl00$ContentPlaceHolder1$ddlUniversity"
FIELD_COL = "ctl00$ContentPlaceHolder1$ddlCollege"
FIELD_DIV = "ctl00$ContentPlaceHolder1$ddlDivision"
FIELD_BTN = "ctl00$ContentPlaceHolder1$btnShow"


@dataclass
class MeritRow:
    university_id: str
    university_name: str
    college_id: str
    college_name: str
    division_id: str
    division_name: str
    merit_no: str
    merit_percentile: str
    application_id: str
    candidate_name: str
    candidature_type: str
    category: str
    eligible_in_open_category: str
    differently_abled_ph: str
    orphan: str = ""
    ex_servicemen: str = ""
    ex_servicemen_merit_no: str = ""
    ex_servicemen_priority: str = ""
    minority_details: str = ""


def get_hidden(soup: BeautifulSoup, name: str) -> str:
    element = soup.find("input", {"name": name})
    return element["value"] if element else ""


def fetch_page(session: requests.Session, retries: int = 5) -> BeautifulSoup:
    last_error: Exception | None = None
    for attempt in range(retries):
        try:
            response = session.get(BASE_URL, timeout=60)
            response.raise_for_status()
            return BeautifulSoup(response.text, "html.parser")
        except requests.RequestException as exc:
            last_error = exc
            wait = 2 ** attempt
            print(f"  fetch failed ({exc}); retrying in {wait}s...")
            time.sleep(wait)
    raise RuntimeError("fetch_page failed after retries") from last_error


def post_form(
    session: requests.Session,
    soup: BeautifulSoup,
    *,
    event_target: str | None = None,
    fields: dict[str, str] | None = None,
    show_button: bool = False,
    retries: int = 5,
) -> BeautifulSoup:
    last_error: Exception | None = None
    for attempt in range(retries):
        payload: dict[str, str] = {
            "__VIEWSTATE": get_hidden(soup, "__VIEWSTATE"),
            "__EVENTVALIDATION": get_hidden(soup, "__EVENTVALIDATION"),
            "__VIEWSTATEGENERATOR": get_hidden(soup, "__VIEWSTATEGENERATOR"),
        }
        if event_target:
            payload["__EVENTTARGET"] = event_target
            payload["__EVENTARGUMENT"] = ""
        if fields:
            payload.update(fields)
        if show_button:
            payload[FIELD_BTN] = "Show Merit List"

        try:
            response = session.post(BASE_URL, data=payload, timeout=90)
            response.raise_for_status()
            return BeautifulSoup(response.text, "html.parser")
        except requests.RequestException as exc:
            last_error = exc
            wait = 2 ** attempt
            print(f"  request failed ({exc}); retrying in {wait}s...")
            time.sleep(wait)

    raise RuntimeError("post_form failed after retries") from last_error


def select_university(session: requests.Session, university_id: str) -> BeautifulSoup:
    soup = fetch_page(session)
    return post_form(
        session,
        soup,
        event_target=FIELD_UNI,
        fields={FIELD_UNI: university_id, FIELD_COL: "-1", FIELD_DIV: "-1"},
    )


def select_college(
    session: requests.Session, university_id: str, college_id: str
) -> BeautifulSoup:
    soup = select_university(session, university_id)
    return post_form(
        session,
        soup,
        event_target=FIELD_COL,
        fields={FIELD_UNI: university_id, FIELD_COL: college_id, FIELD_DIV: "-1"},
    )


def navigate_to_division(
    session: requests.Session,
    university_id: str,
    college_id: str,
    division_id: str,
) -> BeautifulSoup:
    soup = select_college(session, university_id, college_id)
    return post_form(
        session,
        soup,
        fields={FIELD_UNI: university_id, FIELD_COL: college_id, FIELD_DIV: division_id},
        show_button=True,
    )


def select_options(soup: BeautifulSoup, element_id: str) -> list[tuple[str, str]]:
    select = soup.find("select", {"id": element_id})
    if not select:
        return []
    return [
        (option["value"], option.get_text(strip=True))
        for option in select.find_all("option")
        if option.get("value") and option["value"] != "-1"
    ]


def parse_merit_table(
    soup: BeautifulSoup,
    university_id: str,
    university_name: str,
    college_id: str,
    college_name: str,
    division_id: str,
    division_name: str,
) -> list[MeritRow]:
    table = soup.find("table", class_="mahait-table")
    if not table:
        return []

    rows: list[MeritRow] = []
    for tr in table.find_all("tr"):
        cells = [cell.get_text(strip=True) for cell in tr.find_all(["th", "td"])]
        if len(cells) < 8:
            continue
        if cells[0].lower() in {"merit no", "merit no."}:
            continue
        if not cells[0].isdigit():
            continue

        rows.append(
            MeritRow(
                university_id=university_id,
                university_name=university_name,
                college_id=college_id,
                college_name=college_name,
                division_id=division_id,
                division_name=division_name,
                merit_no=cells[0],
                merit_percentile=cells[1],
                application_id=cells[2],
                candidate_name=cells[3],
                candidature_type=cells[4],
                category=cells[5],
                eligible_in_open_category=cells[6],
                differently_abled_ph=cells[7],
                orphan=cells[8] if len(cells) > 8 else "",
                ex_servicemen=cells[9] if len(cells) > 9 else "",
                ex_servicemen_merit_no=cells[10] if len(cells) > 10 else "",
                ex_servicemen_priority=cells[11] if len(cells) > 11 else "",
                minority_details=cells[12] if len(cells) > 12 else "",
            )
        )
    return rows


def load_progress() -> set[str]:
    if not PROGRESS_PATH.exists():
        return set()
    with PROGRESS_PATH.open(encoding="utf-8") as handle:
        data = json.load(handle)
    return set(data.get("completed_keys", []))


def save_progress(completed_keys: set[str]) -> None:
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    with PROGRESS_PATH.open("w", encoding="utf-8") as handle:
        json.dump({"completed_keys": sorted(completed_keys)}, handle, indent=2)


def fieldnames() -> list[str]:
    return [name for name in MeritRow.__annotations__]


def append_rows(rows: list[MeritRow]) -> None:
    if not rows:
        return
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    write_header = not CSV_PATH.exists()
    with CSV_PATH.open("a", newline="", encoding="utf-8") as handle:
        writer = csv.DictWriter(handle, fieldnames=fieldnames())
        if write_header:
            writer.writeheader()
        for row in rows:
            writer.writerow(asdict(row))


def write_json_from_csv() -> None:
    if not CSV_PATH.exists():
        return
    with CSV_PATH.open(encoding="utf-8") as handle:
        rows = list(csv.DictReader(handle))
    with JSON_PATH.open("w", encoding="utf-8") as handle:
        json.dump(rows, handle, indent=2, ensure_ascii=False)


def scrape_all(delay_seconds: float = 0.5) -> int:
    session = requests.Session()
    session.headers.update(
        {
            "User-Agent": (
                "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
                "AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
            )
        }
    )

    universities = select_options(fetch_page(session), "ContentPlaceHolder1_ddlUniversity")
    completed = load_progress()
    scraped_count = 0

    for university_id, university_name in universities:
        soup = select_university(session, university_id)
        colleges = select_options(soup, "ContentPlaceHolder1_ddlCollege")

        for college_id, college_name in colleges:
            soup = select_college(session, university_id, college_id)
            divisions = select_options(soup, "ContentPlaceHolder1_ddlDivision")

            for division_id, division_name in divisions:
                key = f"{university_id}|{college_id}|{division_id}"
                if key in completed:
                    print(f"[skip] {key}")
                    continue

                soup = navigate_to_division(
                    session, university_id, college_id, division_id
                )
                rows = parse_merit_table(
                    soup,
                    university_id,
                    university_name,
                    college_id,
                    college_name,
                    division_id,
                    division_name,
                )
                append_rows(rows)
                scraped_count += len(rows)
                completed.add(key)
                save_progress(completed)
                print(
                    f"[{len(completed)} done] "
                    f"{university_name[:35]} / {college_name[:35]} / "
                    f"{division_name[:35]} -> {len(rows)} candidates"
                )
                time.sleep(delay_seconds)

    return scraped_count


def configure(year: str, course: str) -> None:
    global BASE_URL, CSV_PATH, JSON_PATH, PROGRESS_PATH
    BASE_URL = f"https://llb{course}cap{year}.mahacet.org/Public/MeritListWL.aspx"
    if course == "3":
        CSV_PATH = OUTPUT_DIR / f"merit_list_all_{year}.csv"
        JSON_PATH = OUTPUT_DIR / f"merit_list_all_{year}.json"
        PROGRESS_PATH = OUTPUT_DIR / f"progress_{year}.json"
    else:
        prefix = f"merit_list_all_llb{course}_{year}"
        CSV_PATH = OUTPUT_DIR / f"{prefix}.csv"
        JSON_PATH = OUTPUT_DIR / f"{prefix}.json"
        PROGRESS_PATH = OUTPUT_DIR / f"progress_llb{course}_{year}.json"


def main() -> int:
    parser = argparse.ArgumentParser(description="Scrape LLB merit list data")
    parser.add_argument(
        "--course",
        choices=["3", "5"],
        default="3",
        help="LLB course duration: 3-year or 5-year (default: 3)",
    )
    parser.add_argument(
        "--year",
        choices=["23", "24", "25"],
        default="24",
        help="Admission year cycle (default: 24)",
    )
    args = parser.parse_args()
    configure(args.year, args.course)

    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    print(f"Starting scrape for LLB-{args.course}, 20{args.year}...")
    print(f"URL: {BASE_URL}")
    new_rows = scrape_all()
    write_json_from_csv()
    print(f"\nDone. {new_rows} new candidate rows scraped this run.")
    print(f"CSV:  {CSV_PATH}")
    print(f"JSON: {JSON_PATH}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
