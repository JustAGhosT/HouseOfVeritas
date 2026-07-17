import sys
import unittest
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Dict, List, Optional


FUNCTIONS_ROOT = Path(__file__).resolve().parents[2] / "config" / "azure-functions"
sys.path.insert(0, str(FUNCTIONS_ROOT))

from shared.radar_ingestion import (  # noqa: E402
    DEFAULT_SOURCE_REGISTRY,
    SeedRadarSource,
    SourceRecord,
    build_listing_row,
    cents,
    qa_record,
    run_ingestion,
    source_key_for,
    springs_seed_records,
)


class FakeBaserow:
    def __init__(self) -> None:
        self.tables: Dict[str, List[Dict[str, Any]]] = {}
        self.next_id = 1

    def find_row_by_field(self, table_id: str, field: str, value: str) -> Optional[Dict[str, Any]]:
        for row in self.tables.get(table_id, []):
            if row.get(field) == value:
                return row
        return None

    def create_row(self, table_id: str, data: Dict[str, Any]) -> Dict[str, Any]:
        row = {"id": self.next_id, **data}
        self.next_id += 1
        self.tables.setdefault(table_id, []).append(row)
        return row

    def list_rows(self, table_id: str, size: int = 100) -> List[Dict[str, Any]]:
        return self.tables.get(table_id, [])[:size]

    def update_row(self, table_id: str, row_id: int, data: Dict[str, Any]) -> Dict[str, Any]:
        for index, row in enumerate(self.tables.get(table_id, [])):
            if row.get("id") == row_id:
                updated = {**row, **data}
                self.tables[table_id][index] = updated
                return updated
        raise AssertionError(f"row {row_id} not found in table {table_id}")


class FakeEmail:
    def __init__(self) -> None:
        self.sent: List[Dict[str, str]] = []

    def send_email(self, to_email: str, subject: str, content: str) -> bool:
        self.sent.append({"to": to_email, "subject": subject, "content": content})
        return True


class InlineSource:
    def __init__(self, records: List[SourceRecord]) -> None:
        self.records = records

    def fetch(self) -> List[SourceRecord]:
        return self.records


class RadarIngestionTests(unittest.TestCase):
    def test_seed_source_contains_nine_springs_records(self) -> None:
        records = springs_seed_records()

        self.assertEqual(len(records), 9)
        self.assertEqual(records[0].listing_id, "p24-geduld-2for1")
        self.assertEqual(records[-1].listing_id, "p24-strubenvale-6bed")

    def test_dark_mode_stages_seed_rows_without_publishing(self) -> None:
        baserow = FakeBaserow()
        email = FakeEmail()

        result = run_ingestion(
            baserow,
            email,
            [SeedRadarSource()],
            listings_table_id="radar",
            quarantine_table_id="radar_quarantine",
            radar_enabled=False,
            now=datetime(2026, 7, 16, tzinfo=timezone.utc),
        )

        self.assertEqual(result["processed"], 9)
        self.assertEqual(result["published"], 0)
        self.assertEqual(result["staged"], 9)
        self.assertEqual(result["quarantined"], 0)
        self.assertEqual(result["delisted"], 0)
        self.assertEqual(len(email.sent), 0)
        self.assertEqual(len(baserow.tables["radar"]), 9)
        self.assertTrue(all(row["Publish Status"] == "staged" for row in baserow.tables["radar"]))
        self.assertTrue(all(row["Last Seen"] == "2026-07-16" for row in baserow.tables["radar"]))

    def test_second_run_updates_existing_source_keys(self) -> None:
        baserow = FakeBaserow()
        email = FakeEmail()

        for _ in range(2):
            run_ingestion(
                baserow,
                email,
                [SeedRadarSource()],
                listings_table_id="radar",
                quarantine_table_id="radar_quarantine",
                radar_enabled=False,
            )

        self.assertEqual(len(baserow.tables["radar"]), 9)

    def test_qa_failure_quarantines_and_notifies(self) -> None:
        good = springs_seed_records()[0]
        duplicate = springs_seed_records()[0]
        sectional = SourceRecord(
            listing_id="pp-selcourt-unit-a",
            source_portal="private-property",
            source_url="https://example.invalid/pp-selcourt-unit-a",
            suburb="Selcourt",
            price_cents=cents(899000),
            bedrooms=2,
            bathrooms=1,
            erf_size_m2=56,
            floor_size_m2=56,
            agency="Estate Dev Sales",
            geohash=None,
            effort="cosmetic",
            distress="none",
            transfer_friction="sectional",
            suburb_median_cents=cents(950000),
            arv_estimate_cents=cents(950000),
            reno_cost_estimate_cents=cents(50000),
            monthly_rent_cents=cents(6500),
            monthly_bond_cents=cents(9000),
            holding_cost_monthly_cents=cents(6000),
            area_quality_index=55,
            proximity_index=60,
            days_on_market=5,
            subdivide_potential=False,
            description="New development units now selling",
        )

        baserow = FakeBaserow()
        email = FakeEmail()
        result = run_ingestion(
            baserow,
            email,
            [InlineSource([good, duplicate, sectional])],
            listings_table_id="radar",
            quarantine_table_id="radar_quarantine",
            radar_enabled=True,
        )

        self.assertEqual(result["processed"], 2)
        self.assertEqual(result["published"], 1)
        self.assertEqual(result["quarantined"], 2)
        self.assertEqual(len(baserow.tables["radar_quarantine"]), 2)
        self.assertEqual(len(email.sent), 1)
        self.assertIn("Deal Radar quarantine queue", email.sent[0]["subject"])

    def test_robots_disallowed_blocks_publish(self) -> None:
        record = springs_seed_records()[0]
        registry = {
            **DEFAULT_SOURCE_REGISTRY,
            record.source_portal: {
                **DEFAULT_SOURCE_REGISTRY[record.source_portal],
                "robots_allowed": False,
            },
        }
        qa = qa_record(record, set(), registry)
        row = build_listing_row(record, qa, radar_enabled=True)

        self.assertFalse(qa.passed)
        self.assertIn("robots-disallowed", qa.reasons)
        self.assertEqual(row["Publish Status"], "staged")
        self.assertEqual(row["QA Status"], "quarantined")

    def test_existing_missing_rows_are_marked_delisted(self) -> None:
        baserow = FakeBaserow()
        email = FakeEmail()
        stale = springs_seed_records()[0]
        stale_key = source_key_for(stale)
        baserow.create_row(
            "radar",
            {
                "Source Key": stale_key,
                "Status": "active",
                "Publish Status": "published",
                "Last Seen": "2026-07-15",
            },
        )

        result = run_ingestion(
            baserow,
            email,
            [InlineSource([])],
            listings_table_id="radar",
            quarantine_table_id="radar_quarantine",
            radar_enabled=False,
            now=datetime(2026, 7, 16, tzinfo=timezone.utc),
        )

        self.assertEqual(result["delisted"], 1)
        self.assertEqual(baserow.tables["radar"][0]["Status"], "delisted")
        self.assertEqual(baserow.tables["radar"][0]["Delisted At"], "2026-07-16")

    def test_price_drop_is_logged_on_existing_row_update(self) -> None:
        baserow = FakeBaserow()
        email = FakeEmail()
        record = springs_seed_records()[0]
        baserow.create_row(
            "radar",
            {
                "Source Key": source_key_for(record),
                "Price Cents": record.price_cents + cents(50000),
                "Status": "active",
            },
        )

        run_ingestion(
            baserow,
            email,
            [InlineSource([record])],
            listings_table_id="radar",
            quarantine_table_id="radar_quarantine",
            radar_enabled=False,
            now=datetime(2026, 7, 16, tzinfo=timezone.utc),
        )

        self.assertIn("price drop", baserow.tables["radar"][0]["Change Log"])


if __name__ == "__main__":
    unittest.main()
