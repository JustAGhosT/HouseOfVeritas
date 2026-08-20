"""
House of Veritas - Azure Function: Document Expiry Alert

Daily check for documents approaching expiry dates.
Sends email alerts to responsible parties and summary to admin.

Trigger: Timer (Daily at 6:00 AM UTC)
Schedule: 0 0 6 * * *

Alert Levels:
- URGENT (🔴): ≤7 days until expiry
- WARNING (🟡): ≤30 days until expiry
- NOTICE (🟢): ≤60 days until expiry
"""

import json
import logging
from datetime import datetime, timezone, timedelta
from typing import List, Dict, Any

import azure.functions as func

import sys
sys.path.append("..")
from shared.utils import (
    BaserowClient, EmailClient, SMSClient, config, setup_logging,
    get_current_datetime, format_date, EMAIL_TEMPLATES
)

logger = setup_logging("document-expiry-alert")

# Alert thresholds (days)
THRESHOLDS = {
    "URGENT": 7,
    "WARNING": 30,
    "NOTICE": 60
}


def calculate_days_until_expiry(next_review: str) -> int:
    """Calculate days until document expires."""
    if not next_review:
        return 999
    
    try:
        review_date = datetime.strptime(next_review, "%Y-%m-%d").date()
        today = get_current_datetime().date()
        return (review_date - today).days
    except ValueError:
        return 999


def get_alert_level(days: int) -> str:
    """Get alert level based on days until expiry."""
    if days <= THRESHOLDS["URGENT"]:
        return "URGENT"
    elif days <= THRESHOLDS["WARNING"]:
        return "WARNING"
    elif days <= THRESHOLDS["NOTICE"]:
        return "NOTICE"
    return "OK"


def get_responsible_party_email(baserow: BaserowClient, doc: Dict) -> str:
    """Get email of responsible party for a document."""
    responsible = doc.get("Party Responsible")
    
    if isinstance(responsible, list) and responsible:
        # Baserow stores links as list of {id, value} objects
        employee_id = responsible[0].get("id")
        if employee_id:
            employee = baserow.get_row(config.table_employees, employee_id)
            if employee:
                return employee.get("Email", "")
    
    return ""


def send_individual_alerts(
    baserow: BaserowClient,
    email_client: EmailClient,
    sms_client: SMSClient,
    alerts: List[Dict]
) -> int:
    """Send individual alerts to responsible parties."""
    emails_sent = 0
    
    for alert in alerts:
        # Get responsible party email
        email = get_responsible_party_email(baserow, alert["doc"])
        
        if email:
            # Send email
            success = email_client.send_template_email(
                email,
                "document_expiry_notice",
                {
                    "level": alert["level"],
                    "doc_name": alert["doc_name"],
                    "doc_type": alert["doc_type"],
                    "next_review": alert["next_review"],
                    "days": alert["days"],
                    "docuseal_url": config.docuseal_url or "https://sign.nexamesh.ai"
                }
            )
            if success:
                emails_sent += 1
        
        # Send SMS for urgent items
        if alert["level"] == "URGENT" and config.admin_phone:
            sms_client.send_sms(
                config.admin_phone,
                f"🔴 URGENT: Document '{alert['doc_name']}' expires in {alert['days']} days. Review required."
            )
    
    return emails_sent


def send_admin_summary(
    email_client: EmailClient,
    alerts: List[Dict]
) -> bool:
    """Send summary email to admin."""
    urgent = [a for a in alerts if a["level"] == "URGENT"]
    warning = [a for a in alerts if a["level"] == "WARNING"]
    notice = [a for a in alerts if a["level"] == "NOTICE"]
    
    # Build sections
    def build_section(items: List[Dict], emoji: str, label: str) -> str:
        if not items:
            return ""
        lines = [f"\n{emoji} {label} ({len(items)} documents):"]
        for item in items:
            lines.append(f"  - {item['doc_name']} (expires in {item['days']} days)")
        return "\n".join(lines)
    
    urgent_section = build_section(urgent, "🔴", "URGENT - Expires within 7 days")
    warning_section = build_section(warning, "🟡", "WARNING - Expires within 30 days")
    notice_section = build_section(notice, "🟢", "NOTICE - Expires within 60 days")
    
    return email_client.send_template_email(
        config.admin_email,
        "document_expiry_summary",
        {
            "date": format_date(get_current_datetime()),
            "total_count": len(alerts),
            "urgent_section": urgent_section,
            "warning_section": warning_section,
            "notice_section": notice_section,
            "docuseal_url": config.docuseal_url or "https://sign.nexamesh.ai",
            "baserow_url": config.baserow_url or "https://ops.nexamesh.ai"
        }
    )


def main(timer: func.TimerRequest) -> None:
    """Azure Function entry point."""
    logger.info("Document expiry check started")
    
    if timer.past_due:
        logger.warning("Timer is running late")
    
    baserow = BaserowClient()
    email_client = EmailClient()
    sms_client = SMSClient()
    
    # Fetch all documents
    documents = baserow.list_rows(config.table_document_expiry, size=200)
    logger.info(f"Found {len(documents)} documents to check")
    
    alerts = []
    
    for doc in documents:
        next_review = doc.get("Next Review", "")
        days = calculate_days_until_expiry(next_review)
        level = get_alert_level(days)
        
        # Only include documents that need attention
        if level != "OK":
            alerts.append({
                "doc": doc,
                "doc_name": doc.get("Doc Name", "Unknown"),
                "doc_type": doc.get("Type", "Unknown"),
                "next_review": next_review,
                "days": days,
                "level": level
            })
    
    logger.info(f"Found {len(alerts)} documents requiring attention")
    
    if not alerts:
        logger.info("No documents expiring soon. No alerts sent.")
        return
    
    # Send individual alerts
    emails_sent = send_individual_alerts(baserow, email_client, sms_client, alerts)
    logger.info(f"Sent {emails_sent} individual alert emails")
    
    # Send admin summary
    if send_admin_summary(email_client, alerts):
        logger.info("Sent admin summary email")
    
    # Log summary
    urgent_count = sum(1 for a in alerts if a["level"] == "URGENT")
    warning_count = sum(1 for a in alerts if a["level"] == "WARNING")
    notice_count = sum(1 for a in alerts if a["level"] == "NOTICE")
    
    logger.info(f"Alert summary - URGENT: {urgent_count}, WARNING: {warning_count}, NOTICE: {notice_count}")
