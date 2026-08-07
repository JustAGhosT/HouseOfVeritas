"""PostgreSQL write client for Deal Radar ingestion.

Implements the same four methods the ingestion pipeline already uses against
``BaserowClient`` -- ``list_rows``, ``create_row``, ``update_row`` and
``find_row_by_field`` -- so ``radar_ingestion`` needs no restructuring to run on
Postgres. The pipeline keeps speaking Baserow-style display names
("Source Key", "Publish Status"); translation to snake_case columns happens
here, in one place.

Column names are a contract shared with ``lib/db/radar-schema.ts``. Change them
in both or not at all.
"""

from __future__ import annotations

import json
import logging
import os
from typing import Any, Dict, List, Optional

logger = logging.getLogger(__name__)

# Display name -> column. Anything not listed is dropped on write rather than
# guessed at, so a new pipeline field fails loudly in review instead of silently
# vanishing into a JSONB blob.
FIELD_TO_COLUMN: Dict[str, str] = {
    "Source Key": "source_key",
    "Listing ID": "listing_id",
    "Source URL": "source_url",
    "Source Portal": "source_portal",
    "Suburb": "suburb",
    "Price Cents": "price_cents",
    "Bedrooms": "bedrooms",
    "Bathrooms": "bathrooms",
    "Erf Size M2": "erf_size_m2",
    "Floor Size M2": "floor_size_m2",
    "Property Type": "property_type",
    "Confidence": "confidence",
    "Status": "status",
    "Distress Flag": "distress_flag",
    "Effort": "effort",
    "Buy In Cents": "buy_in_cents",
    "All In Cents": "all_in_cents",
    "Flip Pct": "flip_pct",
    "Deal Score": "deal_score",
    "Rental Yield Gross": "rental_yield_gross",
    "ARV Estimate Cents": "arv_estimate_cents",
    "Reno Cost Estimate Cents": "reno_cost_estimate_cents",
    "Area Quality Index": "area_quality_index",
    "Proximity Index": "proximity_index",
    "Days On Market": "days_on_market",
    "Subdivide Potential": "subdivide_potential",
    "Transfer Friction": "transfer_friction",
    "Physical Risk Dolomite": "physical_risk_dolomite",
    "Physical Risk Flood": "physical_risk_flood",
    "Analyst Note": "analyst_note",
    "Canonical Key": "canonical_key",
    "Last Seen": "last_seen",
    "Publish Status": "publish_status",
    "Agency": "agency",
    "AI Generated": "ai_generated",
    "Classification Reasons": "classification_reasons",
    "Holding Cost Monthly Cents": "holding_cost_monthly_cents",
    "Monthly Bond Cents": "monthly_bond_cents",
    "Monthly Rent Cents": "monthly_rent_cents",
    "Suburb Median Cents": "suburb_median_cents",
    "QA Status": "qa_status",
    "QA Reasons": "qa_reasons",
    "Change Log": "change_log",
    "Delisted At": "delisted_at",
}

COLUMN_TO_FIELD: Dict[str, str] = {column: field for field, column in FIELD_TO_COLUMN.items()}

# The quarantine table keeps only identifying columns plus the failure reason;
# the full rejected record goes to `payload` because its shape is by definition
# untrusted.
QUARANTINE_COLUMNS = {
    "source_key",
    "source_url",
    "source_portal",
    "suburb",
    "price_cents",
    "qa_failure_reason",
}


def is_postgres_configured() -> bool:
    return bool(os.environ.get("DATABASE_URL") or os.environ.get("POSTGRES_URL"))


def _dsn() -> str:
    dsn = os.environ.get("DATABASE_URL") or os.environ.get("POSTGRES_URL")
    if not dsn:
        raise RuntimeError("DATABASE_URL or POSTGRES_URL is required for the Postgres radar client")
    return dsn


class RadarPostgresClient:
    """Drop-in replacement for BaserowClient, scoped to the radar tables.

    ``table_id`` in the Baserow interface becomes a table *name* here. Callers
    pass whatever ``TABLE_DEAL_RADAR_LISTINGS`` / ``_QUARANTINE`` hold, so those
    settings carry table names rather than numeric ids when running on Postgres.
    """

    def __init__(self, dsn: Optional[str] = None) -> None:
        self._dsn = dsn or _dsn()

    def _connect(self):
        # Imported lazily so Baserow-backed deployments do not need psycopg
        # installed at all.
        import psycopg

        return psycopg.connect(self._dsn)

    @staticmethod
    def _to_columns(table: str, data: Dict[str, Any]) -> Dict[str, Any]:
        if table.endswith("quarantine"):
            mapped: Dict[str, Any] = {}
            payload: Dict[str, Any] = {}
            for field, value in data.items():
                column = FIELD_TO_COLUMN.get(field)
                if column in QUARANTINE_COLUMNS:
                    mapped[column] = value
                else:
                    payload[field] = value
            if "qa_failure_reason" not in mapped:
                mapped["qa_failure_reason"] = str(
                    data.get("QA Reasons") or data.get("qa_failure_reason") or ""
                )
            mapped["payload"] = json.dumps(payload)
            return mapped

        mapped = {}
        for field, value in data.items():
            column = FIELD_TO_COLUMN.get(field)
            if column is None:
                logger.warning("Dropping unmapped radar field on write: %s", field)
                continue
            mapped[column] = value
        return mapped

    @staticmethod
    def _to_fields(row: Dict[str, Any]) -> Dict[str, Any]:
        """Return a Baserow-shaped dict so callers see the keys they expect."""
        out: Dict[str, Any] = {"id": row.get("id")}
        for column, value in row.items():
            field = COLUMN_TO_FIELD.get(column)
            if field is not None:
                out[field] = value
        return out

    def list_rows(
        self, table_id: str, filters: Dict = None, page: int = 1, size: int = 100
    ) -> List[Dict]:
        offset = max(0, (page - 1) * size)
        with self._connect() as conn, conn.cursor() as cur:
            cur.execute(
                f"SELECT * FROM {_safe_table(table_id)} ORDER BY id ASC LIMIT %s OFFSET %s",
                (size, offset),
            )
            columns = [c.name for c in cur.description]
            return [self._to_fields(dict(zip(columns, r))) for r in cur.fetchall()]

    def find_row_by_field(self, table_id: str, field: str, value: str) -> Optional[Dict]:
        column = FIELD_TO_COLUMN.get(field)
        if column is None:
            raise ValueError(f"Cannot search radar table by unmapped field: {field}")

        with self._connect() as conn, conn.cursor() as cur:
            cur.execute(
                f"SELECT * FROM {_safe_table(table_id)} WHERE {column} = %s LIMIT 1",
                (value,),
            )
            row = cur.fetchone()
            if row is None:
                return None
            columns = [c.name for c in cur.description]
            return self._to_fields(dict(zip(columns, row)))

    def create_row(self, table_id: str, data: Dict) -> Optional[Dict]:
        mapped = self._to_columns(table_id, data)
        if not mapped:
            return None

        columns = list(mapped)
        placeholders = ", ".join(["%s"] * len(columns))
        with self._connect() as conn, conn.cursor() as cur:
            cur.execute(
                f"INSERT INTO {_safe_table(table_id)} ({', '.join(columns)}) "
                f"VALUES ({placeholders}) RETURNING *",
                tuple(mapped[c] for c in columns),
            )
            row = cur.fetchone()
            names = [c.name for c in cur.description]
            conn.commit()
            return self._to_fields(dict(zip(names, row))) if row else None

    def update_row(self, table_id: str, row_id: int, data: Dict) -> Optional[Dict]:
        mapped = self._to_columns(table_id, data)
        if not mapped:
            return None

        columns = list(mapped)
        assignments = ", ".join(f"{c} = %s" for c in columns)
        with self._connect() as conn, conn.cursor() as cur:
            cur.execute(
                f"UPDATE {_safe_table(table_id)} SET {assignments} WHERE id = %s RETURNING *",
                tuple(mapped[c] for c in columns) + (row_id,),
            )
            row = cur.fetchone()
            names = [c.name for c in cur.description]
            conn.commit()
            return self._to_fields(dict(zip(names, row))) if row else None


LISTINGS_TABLE = "deal_radar_listings"
QUARANTINE_TABLE = "deal_radar_quarantine"
ALLOWED_TABLES = {LISTINGS_TABLE, QUARANTINE_TABLE}


def _safe_table(table: str) -> str:
    """Guard against identifier injection.

    Table names arrive from configuration rather than user input, but they are
    interpolated into SQL (identifiers cannot be parameterised), so restrict
    them to the known radar tables.
    """
    if table not in ALLOWED_TABLES:
        raise ValueError(f"Refusing to query non-radar table: {table!r}")
    return table


# ---------------------------------------------------------------------------
# Schema ownership
# ---------------------------------------------------------------------------
#
# Mirrors lib/db/radar-schema.ts. Duplicated deliberately: the ingestion timer
# fires at 04:00 and may well run before the web app has ever served a request
# with Postgres configured, in which case ensureRadarSchema() has not run and
# the first SELECT would raise UndefinedTable and abort the whole job.
#
# Both definitions are CREATE TABLE IF NOT EXISTS, so whichever side runs first
# wins and the other is a no-op. The column list is a contract with the TS file
# and with FIELD_TO_COLUMN above -- a schema/field-map contract test is the
# right place to keep the three honest.

_LISTINGS_DDL = """
CREATE TABLE IF NOT EXISTS deal_radar_listings (
    id INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    source_key TEXT NOT NULL UNIQUE,
    listing_id TEXT NOT NULL DEFAULT '',
    source_url TEXT NOT NULL,
    source_portal TEXT NOT NULL,
    suburb TEXT NOT NULL DEFAULT '',
    price_cents BIGINT NOT NULL DEFAULT 0,
    bedrooms INTEGER,
    bathrooms INTEGER,
    erf_size_m2 INTEGER,
    floor_size_m2 INTEGER,
    property_type TEXT NOT NULL DEFAULT 'unknown',
    confidence TEXT NOT NULL DEFAULT 'estimate',
    status TEXT NOT NULL DEFAULT 'active',
    distress_flag TEXT NOT NULL DEFAULT 'none',
    effort TEXT NOT NULL DEFAULT 'unknown',
    buy_in_cents BIGINT,
    all_in_cents BIGINT,
    flip_pct NUMERIC,
    deal_score NUMERIC,
    rental_yield_gross NUMERIC,
    arv_estimate_cents BIGINT,
    reno_cost_estimate_cents BIGINT,
    area_quality_index NUMERIC,
    proximity_index NUMERIC,
    days_on_market INTEGER,
    subdivide_potential BOOLEAN NOT NULL DEFAULT false,
    transfer_friction TEXT NOT NULL DEFAULT 'unknown',
    physical_risk_dolomite BOOLEAN NOT NULL DEFAULT false,
    physical_risk_flood BOOLEAN NOT NULL DEFAULT false,
    analyst_note TEXT,
    canonical_key TEXT,
    last_seen DATE,
    agency TEXT,
    ai_generated BOOLEAN NOT NULL DEFAULT false,
    classification_reasons TEXT,
    holding_cost_monthly_cents BIGINT,
    monthly_bond_cents BIGINT,
    monthly_rent_cents BIGINT,
    suburb_median_cents BIGINT,
    qa_status TEXT,
    qa_reasons TEXT,
    change_log TEXT,
    delisted_at DATE,
    publish_status TEXT NOT NULL DEFAULT 'staged'
);
CREATE INDEX IF NOT EXISTS idx_radar_publish_status ON deal_radar_listings(publish_status);
CREATE INDEX IF NOT EXISTS idx_radar_canonical_key ON deal_radar_listings(canonical_key);
CREATE INDEX IF NOT EXISTS idx_radar_suburb ON deal_radar_listings(suburb);
"""

_QUARANTINE_DDL = """
CREATE TABLE IF NOT EXISTS deal_radar_quarantine (
    id INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    source_key TEXT NOT NULL UNIQUE,
    source_url TEXT,
    source_portal TEXT,
    suburb TEXT,
    price_cents BIGINT,
    payload JSONB,
    qa_failure_reason TEXT NOT NULL DEFAULT '',
    quarantined_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_radar_quarantine_at ON deal_radar_quarantine(quarantined_at DESC);
"""


def ensure_radar_schema(dsn: Optional[str] = None) -> None:
    """Create the radar tables if absent. Idempotent."""
    import psycopg

    with psycopg.connect(dsn or _dsn()) as conn, conn.cursor() as cur:
        cur.execute(_LISTINGS_DDL)
        cur.execute(_QUARANTINE_DDL)
        conn.commit()
    logger.info("Radar Postgres schema ensured")
