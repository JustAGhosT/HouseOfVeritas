"""
House of Veritas - Azure Function: Deal Radar Refresh

Daily dark-mode ingestion for Property Deal Radar.

Trigger: Timer (Daily at 04:00 UTC)
Schedule: 0 0 4 * * *
"""

import sys

import azure.functions as func

sys.path.append("..")
from shared.radar_ingestion import SeedRadarSource, run_ingestion
from shared.utils import BaserowClient, EmailClient, config, setup_logging

logger = setup_logging("deal-radar-refresh")


def main(timer: func.TimerRequest) -> None:
    """Azure Function entry point."""
    logger.info("Deal Radar refresh started")

    if timer.past_due:
        logger.warning("Deal Radar refresh timer is running late")

    baserow = BaserowClient()
    email_client = EmailClient()

    result = run_ingestion(
        baserow,
        email_client,
        [SeedRadarSource()],
        listings_table_id=config.table_deal_radar_listings,
        quarantine_table_id=config.table_deal_radar_quarantine,
        radar_enabled=config.radar_enabled,
    )

    logger.info("Deal Radar refresh complete: %s", result)
