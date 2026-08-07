"""
House of Veritas - Azure Function: Deal Radar Refresh

Daily dark-mode ingestion for Property Deal Radar.

Trigger: Timer (Daily at 04:00 UTC)
Schedule: 0 0 4 * * *
"""

import json
import os
import sys

import azure.functions as func

sys.path.append("..")
from shared.radar_ingestion import SeedRadarSource, build_monitoring_payload, run_ingestion
from shared.radar_postgres import (
    LISTINGS_TABLE,
    QUARANTINE_TABLE,
    RadarPostgresClient,
    ensure_radar_schema,
    is_postgres_configured,
)
from shared.utils import BaserowClient, EmailClient, config, setup_logging

logger = setup_logging("deal-radar-refresh")


def _build_store_client():
    """Choose the radar write backend.

    Mirrors the web app's ESTATE_BACKEND switch so ingestion and the public read
    path cannot end up pointed at different stores. Falls back to Baserow when
    Postgres is selected but unconfigured, matching the fail-safe selection in
    lib/repositories/estate-repository.ts.
    """
    if os.environ.get("ESTATE_BACKEND", "").lower() != "postgres":
        return BaserowClient(), "baserow"

    if not is_postgres_configured():
        logger.warning(
            "ESTATE_BACKEND=postgres but DATABASE_URL is unset; falling back to Baserow"
        )
        return BaserowClient(), "baserow"

    return RadarPostgresClient(), "postgres"


def main(timer: func.TimerRequest) -> None:
    """Azure Function entry point."""
    logger.info("Deal Radar refresh started")

    if timer.past_due:
        logger.warning("Deal Radar refresh timer is running late")

    store, backend = _build_store_client()
    logger.info("Deal Radar refresh using %s backend", backend)

    if backend == "postgres":
        # Postgres addresses tables by NAME, owned by the client. The
        # TABLE_DEAL_RADAR_* settings carry Baserow numeric ids and are
        # meaningless here -- passing one through would trip the table
        # allowlist. Also create the schema: this job may run before the web
        # app has ever called ensureRadarSchema().
        ensure_radar_schema()
        listings_table = LISTINGS_TABLE
        quarantine_table = QUARANTINE_TABLE
    else:
        listings_table = config.table_deal_radar_listings
        quarantine_table = config.table_deal_radar_quarantine

    email_client = EmailClient()

    result = run_ingestion(
        store,
        email_client,
        [SeedRadarSource()],
        listings_table_id=listings_table,
        quarantine_table_id=quarantine_table,
        radar_enabled=config.radar_enabled,
    )

    monitoring_payload = build_monitoring_payload(result)
    logger.info("DealRadarRefreshTelemetry %s", json.dumps(monitoring_payload, sort_keys=True))
    if result["zeroRows"]:
        logger.warning("DealRadarRefreshZeroRows %s", json.dumps(monitoring_payload, sort_keys=True))
    if result["quarantined"] > 0:
        logger.warning("DealRadarRefreshQuarantine %s", json.dumps(monitoring_payload, sort_keys=True))
    if result["sourceShapeDrift"]:
        logger.warning("DealRadarRefreshSourceShapeDrift %s", json.dumps(monitoring_payload, sort_keys=True))
    logger.info("Deal Radar refresh complete: %s", result)
