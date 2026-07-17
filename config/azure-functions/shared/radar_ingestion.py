"""
House of Veritas - Property Deal Radar ingestion helpers.

The Azure Function entry point stays thin; this module holds the deterministic
normalisation, QA gate, staging/publish decision, and Baserow write contracts so
they can be unit-tested without Azure Functions or network access.
"""

from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime, timezone
import re
from typing import Any, Dict, Iterable, List, Optional, Protocol, Sequence, Tuple

from shared.utils import BaserowClient, EmailClient, config


RANDS = 100
ERF_BUCKET_M2 = 50
DEFAULT_SOURCE_REGISTRY: Dict[str, Dict[str, Any]] = {
    "property24": {
        "label": "Property24",
        "robots_allowed": True,
        "min_interval_seconds": 10,
    },
    "private-property": {
        "label": "Private Property",
        "robots_allowed": True,
        "min_interval_seconds": 10,
    },
    "myroof": {
        "label": "MyRoof",
        "robots_allowed": True,
        "min_interval_seconds": 10,
    },
}


@dataclass(frozen=True)
class SourceRecord:
    listing_id: str
    source_portal: str
    source_url: str
    suburb: str
    price_cents: int
    bedrooms: Optional[int]
    bathrooms: Optional[int]
    erf_size_m2: Optional[int]
    floor_size_m2: Optional[int]
    agency: Optional[str]
    geohash: Optional[str]
    effort: str
    distress: str
    transfer_friction: str
    suburb_median_cents: Optional[int]
    arv_estimate_cents: Optional[int]
    reno_cost_estimate_cents: Optional[int]
    monthly_rent_cents: Optional[int]
    monthly_bond_cents: Optional[int]
    holding_cost_monthly_cents: Optional[int]
    area_quality_index: Optional[int]
    proximity_index: Optional[int]
    days_on_market: Optional[int]
    subdivide_potential: bool
    dolomite: bool = False
    flood: bool = False
    title_type: Optional[str] = None
    description: Optional[str] = None
    source_opened: bool = True


@dataclass(frozen=True)
class QaResult:
    passed: bool
    reasons: Tuple[str, ...]


class RadarSource(Protocol):
    def fetch(self) -> Sequence[SourceRecord]:
        """Return structured facts only; no prose mirroring or photo storage."""


def cents(rand: int) -> int:
    return rand * RANDS


def today_iso(now: Optional[datetime] = None) -> str:
    return (now or datetime.now(timezone.utc)).date().isoformat()


def normalise_suburb(suburb: str) -> str:
    return re.sub(r"(^-+|-+$)", "", re.sub(r"[^a-z0-9]+", "-", suburb.strip().lower()))


def erf_bucket(erf_size_m2: Optional[int]) -> str:
    if erf_size_m2 is None or erf_size_m2 <= 0:
        return "na"
    return str(round(erf_size_m2 / ERF_BUCKET_M2) * ERF_BUCKET_M2)


def compute_canonical_key(record: SourceRecord) -> str:
    erf = erf_bucket(record.erf_size_m2)
    if record.geohash:
        return f"geo:{record.geohash}:erf{erf}"
    beds = str(record.bedrooms) if record.bedrooms and record.bedrooms > 0 else "na"
    return f"sub:{normalise_suburb(record.suburb)}:erf{erf}:bed{beds}"


def classify_property(record: SourceRecord) -> Tuple[str, List[str]]:
    reasons: List[str] = []
    if record.title_type and re.search(r"sectional|sec\s*title", record.title_type, re.IGNORECASE):
        return "sectional", ["title-sectional"]
    if (
        record.erf_size_m2 is not None
        and record.floor_size_m2 is not None
        and record.erf_size_m2 > 0
        and record.erf_size_m2 == record.floor_size_m2
    ):
        reasons.append("erf-equals-floor")
    description = (record.description or "").lower()
    for token in ["estate", "new phase", "now selling", "units", "development"]:
        if token in description:
            reasons.append(f"token:{token}")
    if reasons:
        return "new-dev-unit", reasons
    return "freehold-house", []


def resolve_buy_in_cents(record: SourceRecord) -> int:
    return max(0, record.price_cents)


def compute_derived(record: SourceRecord) -> Dict[str, Optional[float]]:
    buy_in = resolve_buy_in_cents(record)
    reno = record.reno_cost_estimate_cents or 0
    all_in = buy_in + reno
    flip_pct = None
    if record.arv_estimate_cents is not None and all_in > 0:
        flip_pct = (record.arv_estimate_cents - buy_in - reno) / all_in
    deal_score = None
    if record.suburb_median_cents and record.suburb_median_cents > 0:
        deal_score = ((record.suburb_median_cents - buy_in) / record.suburb_median_cents) * 100
    rental_yield = None
    if record.monthly_rent_cents is not None and all_in > 0:
        rental_yield = (record.monthly_rent_cents * 12) / all_in
    return {
        "buyInCents": buy_in,
        "allInCents": all_in,
        "flipPct": flip_pct,
        "dealScore": deal_score,
        "rentalYieldGross": rental_yield,
    }


def qa_record(
    record: SourceRecord,
    seen_source_keys: set[str],
    source_registry: Dict[str, Dict[str, Any]],
) -> QaResult:
    reasons: List[str] = []
    source_key = source_key_for(record)
    if source_key in seen_source_keys:
        reasons.append("duplicate-source-key")
    if not record.source_url:
        reasons.append("missing-source-url")
    if record.source_portal not in source_registry:
        reasons.append("unknown-source-portal")
    elif not source_registry[record.source_portal].get("robots_allowed", False):
        reasons.append("robots-disallowed")
    if record.price_cents <= 0:
        reasons.append("invalid-price")
    if record.erf_size_m2 is not None and record.erf_size_m2 <= 0:
        reasons.append("erf-nonpositive")
    if (
        record.erf_size_m2 is not None
        and record.floor_size_m2 is not None
        and record.erf_size_m2 == record.floor_size_m2
    ):
        reasons.append("erf-equals-floor")
    property_type, classification_reasons = classify_property(record)
    if property_type != "freehold-house":
        reasons.extend(classification_reasons)
    return QaResult(passed=len(reasons) == 0, reasons=tuple(dict.fromkeys(reasons)))


def source_key_for(record: SourceRecord) -> str:
    return f"{record.source_portal}:{record.listing_id}"


def build_listing_row(
    record: SourceRecord,
    qa: QaResult,
    *,
    radar_enabled: bool,
    now: Optional[datetime] = None,
) -> Dict[str, Any]:
    property_type, classification_reasons = classify_property(record)
    derived = compute_derived(record)
    confidence = "verified" if record.source_opened else "feed"
    publish_status = "published" if radar_enabled and qa.passed else "staged"
    return {
        "Source Key": source_key_for(record),
        "Listing ID": record.listing_id,
        "Source Portal": record.source_portal,
        "Source URL": record.source_url,
        "Suburb": record.suburb,
        "Price Cents": record.price_cents,
        "Bedrooms": record.bedrooms,
        "Bathrooms": record.bathrooms,
        "Erf Size M2": record.erf_size_m2,
        "Floor Size M2": record.floor_size_m2,
        "Agency": record.agency,
        "Canonical Key": compute_canonical_key(record),
        "Property Type": property_type,
        "Classification Reasons": ", ".join(classification_reasons),
        "Confidence": confidence,
        "Status": "active",
        "Publish Status": publish_status,
        "QA Status": "passed" if qa.passed else "quarantined",
        "QA Reasons": ", ".join(qa.reasons),
        "Buy In Cents": int(derived["buyInCents"] or 0),
        "All In Cents": int(derived["allInCents"] or 0),
        "Flip Pct": derived["flipPct"],
        "Deal Score": derived["dealScore"],
        "Rental Yield Gross": derived["rentalYieldGross"],
        "Suburb Median Cents": record.suburb_median_cents,
        "ARV Estimate Cents": record.arv_estimate_cents,
        "Reno Cost Estimate Cents": record.reno_cost_estimate_cents,
        "Monthly Rent Cents": record.monthly_rent_cents,
        "Monthly Bond Cents": record.monthly_bond_cents,
        "Holding Cost Monthly Cents": record.holding_cost_monthly_cents,
        "Area Quality Index": record.area_quality_index,
        "Proximity Index": record.proximity_index,
        "Days On Market": record.days_on_market,
        "Effort": record.effort,
        "Distress Flag": record.distress,
        "Transfer Friction": record.transfer_friction,
        "Subdivide Potential": record.subdivide_potential,
        "Physical Risk Dolomite": record.dolomite,
        "Physical Risk Flood": record.flood,
        "Analyst Note": None,
        "AI Generated": False,
        "Last Seen": today_iso(now),
    }


def upsert_row_by_source_key(
    baserow: BaserowClient,
    table_id: str,
    source_key: str,
    data: Dict[str, Any],
) -> Dict[str, Any]:
    existing = baserow.find_row_by_field(table_id, "Source Key", source_key)
    if existing and existing.get("id"):
        updated = baserow.update_row(table_id, existing["id"], data)
        return updated or existing
    created = baserow.create_row(table_id, data)
    return created or {}


def list_existing_rows_by_source_key(baserow: BaserowClient, table_id: str) -> Dict[str, Dict[str, Any]]:
    rows = baserow.list_rows(table_id, size=200)
    return {
        row["Source Key"]: row
        for row in rows
        if row.get("Source Key")
    }


def append_price_change(existing: Optional[Dict[str, Any]], row: Dict[str, Any]) -> Dict[str, Any]:
    if not existing:
        return row
    previous_price = existing.get("Price Cents")
    current_price = row.get("Price Cents")
    change_log = existing.get("Change Log", "")
    if (
        isinstance(previous_price, int)
        and isinstance(current_price, int)
        and current_price < previous_price
    ):
        entry = f"{row['Last Seen']}: price drop {previous_price} -> {current_price}"
        row["Change Log"] = f"{change_log}\n{entry}".strip()
    elif change_log:
        row["Change Log"] = change_log
    return row


def mark_delisted_rows(
    baserow: BaserowClient,
    table_id: str,
    existing_rows: Dict[str, Dict[str, Any]],
    seen_source_keys: set[str],
    now: Optional[datetime] = None,
) -> int:
    delisted = 0
    for source_key, row in existing_rows.items():
        if source_key in seen_source_keys or row.get("Status") == "delisted":
            continue
        row_id = row.get("id")
        if not row_id:
            continue
        baserow.update_row(
            table_id,
            row_id,
            {
                "Status": "delisted",
                "Publish Status": "staged",
                "Last Seen": row.get("Last Seen") or today_iso(now),
                "Delisted At": today_iso(now),
            },
        )
        delisted += 1
    return delisted


def row_count_delta_reasons(
    existing_count: int,
    current_count: int,
    threshold_pct: int,
) -> Tuple[str, ...]:
    if existing_count <= 0 or threshold_pct <= 0:
        return ()
    delta_pct = abs(existing_count - current_count) / existing_count * 100
    if delta_pct > threshold_pct:
        return (f"row-count-delta-{delta_pct:.0f}pct",)
    return ()


def write_quarantine(
    baserow: BaserowClient,
    quarantine_table_id: str,
    row: Dict[str, Any],
) -> Optional[Dict[str, Any]]:
    if not quarantine_table_id:
        return None
    payload = {
        "Source Key": row["Source Key"],
        "Source Portal": row["Source Portal"],
        "Source URL": row["Source URL"],
        "Suburb": row["Suburb"],
        "QA Reasons": row["QA Reasons"],
        "Captured At": row["Last Seen"],
    }
    return upsert_row_by_source_key(baserow, quarantine_table_id, row["Source Key"], payload)


def notify_exceptions(email_client: EmailClient, quarantined: Sequence[Dict[str, Any]]) -> bool:
    if not quarantined:
        return False
    lines = [
        f"- {row['Source Key']} | {row['Suburb']} | {row['QA Reasons']}"
        for row in quarantined[:20]
    ]
    extra = "\n... and more" if len(quarantined) > 20 else ""
    return email_client.send_email(
        config.admin_email,
        f"Deal Radar quarantine queue - {len(quarantined)} row(s)",
        "House of Veritas - Deal Radar QA exceptions\n\n"
        "The daily ingestion run quarantined rows for review:\n\n"
        f"{chr(10).join(lines)}{extra}\n\n"
        "RADAR_ENABLED remains controlled by the legal sign-off gate.",
    )


def springs_seed_records() -> List[SourceRecord]:
    base_url = "https://example.invalid/radar-seed/"
    return [
        SourceRecord("p24-geduld-2for1", "property24", base_url + "p24-geduld-2for1", "Geduld", cents(750000), 4, 2, 991, 220, "Seeff", None, "moderate", "none", "transfer-duty", cents(850000), cents(1050000), cents(220000), cents(8500), cents(7800), cents(9000), 55, 52, 21, True),
        SourceRecord("myroof-geduld-easysell", "myroof", base_url + "myroof-geduld-easysell", "Geduld", cents(520000), 3, 1, 600, 150, "FNB Quick Sell", None, "major", "easysell", "transfer-duty", cents(850000), cents(780000), cents(240000), cents(6500), cents(5600), cents(7500), 55, 48, 45, False),
        SourceRecord("p24-struisbult-1420", "property24", base_url + "p24-struisbult-1420", "Struisbult", cents(680000), 3, 1, 1420, 180, "Pam Golding", "ke7f8xq", "moderate", "none", "transfer-duty", cents(830000), cents(980000), cents(180000), cents(7500), cents(7100), cents(8200), 58, 54, 60, True),
        SourceRecord("myroof-springs-sie", "myroof", base_url + "myroof-springs-sie", "Springs", cents(450000), 2, 1, 500, 120, "SIE Auctions", None, "severe", "sie-auction", "transfer-duty", cents(760000), cents(700000), cents(260000), cents(5600), cents(4900), cents(7300), 50, 50, 80, False),
        SourceRecord("p24-strubenvale-fixer", "property24", base_url + "p24-strubenvale-fixer", "Strubenvale", cents(650000), 3, 2, 800, 190, "RE/MAX", None, "moderate", "none", "transfer-duty", cents(900000), cents(1050000), cents(210000), cents(8500), cents(6900), cents(8400), 68, 62, 35, False),
        SourceRecord("pp-selectionpark-flatlet", "private-property", base_url + "pp-selectionpark-flatlet", "Selection Park", cents(720000), 3, 2, 812, 210, "Chas Everitt", None, "cosmetic", "none", "transfer-duty", cents(940000), cents(1120000), cents(140000), cents(9200), cents(7600), cents(8200), 70, 64, 28, True),
        SourceRecord("p24-moddereast-cash", "property24", base_url + "p24-moddereast-cash", "Modder East", cents(380000), 2, 1, 600, 130, "Private Seller", None, "major", "cash-only", "transfer-duty", cents(700000), cents(650000), cents(230000), cents(5200), cents(4300), cents(6700), 46, 44, 90, False),
        SourceRecord("myroof-moddereast-easysell", "myroof", base_url + "myroof-moddereast-easysell", "Modder East", cents(430000), 3, 1, 650, 140, "FNB Quick Sell", None, "major", "easysell", "transfer-duty", cents(700000), cents(690000), cents(220000), cents(5600), cents(4700), cents(6900), 46, 44, 70, False),
        SourceRecord("p24-strubenvale-6bed", "property24", base_url + "p24-strubenvale-6bed", "Strubenvale", cents(980000), 6, 3, 900, 280, "RE/MAX", None, "cosmetic", "none", "transfer-duty", cents(900000), cents(1250000), cents(170000), cents(12000), cents(10100), cents(9600), 68, 62, 18, False),
    ]


class SeedRadarSource:
    def fetch(self) -> Sequence[SourceRecord]:
        if not config.radar_seed_enabled:
            return []
        return springs_seed_records()


def run_ingestion(
    baserow: BaserowClient,
    email_client: EmailClient,
    sources: Iterable[RadarSource],
    *,
    listings_table_id: str,
    quarantine_table_id: str,
    radar_enabled: bool,
    source_registry: Optional[Dict[str, Dict[str, Any]]] = None,
    now: Optional[datetime] = None,
) -> Dict[str, Any]:
    if not listings_table_id:
        raise ValueError("TABLE_DEAL_RADAR_LISTINGS is required for DealRadarRefresh")

    registry = source_registry or DEFAULT_SOURCE_REGISTRY
    seen: set[str] = set()
    staged = 0
    published = 0
    quarantined_rows: List[Dict[str, Any]] = []
    existing_rows = list_existing_rows_by_source_key(baserow, listings_table_id)
    batch_records = [record for source in sources for record in source.fetch()]
    batch_reasons = row_count_delta_reasons(
        len(existing_rows),
        len(batch_records),
        config.radar_row_delta_threshold_pct,
    )

    for record in batch_records:
        record_key = source_key_for(record)
        qa = qa_record(record, seen, registry)
        if batch_reasons:
            qa = QaResult(False, tuple(dict.fromkeys((*qa.reasons, *batch_reasons))))
        seen.add(record_key)
        row = build_listing_row(record, qa, radar_enabled=radar_enabled, now=now)
        row = append_price_change(existing_rows.get(record_key), row)
        upsert_row_by_source_key(baserow, listings_table_id, row["Source Key"], row)
        if row["Publish Status"] == "published":
            published += 1
        else:
            staged += 1
        if not qa.passed:
            quarantined_rows.append(row)
            write_quarantine(baserow, quarantine_table_id, row)

    notification_sent = notify_exceptions(email_client, quarantined_rows)
    delisted = mark_delisted_rows(baserow, listings_table_id, existing_rows, seen, now=now)
    return {
        "processed": len(seen),
        "published": published,
        "staged": staged,
        "quarantined": len(quarantined_rows),
        "delisted": delisted,
        "notificationSent": notification_sent,
        "radarEnabled": radar_enabled,
    }
