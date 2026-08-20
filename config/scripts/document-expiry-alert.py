"""
House of Veritas - Azure Function: Document Expiry Alert

This Azure Function runs daily at 6am to check for expiring documents
and send notification emails to responsible parties.

Deployment:
1. Create Azure Function App (Python runtime) with Timer trigger
2. Deploy this function
3. Configure application settings (environment variables)
4. Set CRON schedule: 0 0 6 * * * (daily at 6am)

Environment Variables Required:
- BASEROW_URL: Base URL of Baserow instance
- BASEROW_TOKEN: API token with read permissions
- TABLE_DOCUMENTS: Document expiry table ID
- TABLE_EMPLOYEES: Employee table ID
- SENDGRID_API_KEY: SendGrid API key for emails
- ALERT_FROM_EMAIL: From email address
- ALERT_TO_ADMIN: Admin email (Hans) for summaries
"""

import json
import logging
import os
from datetime import datetime, timedelta
from typing import Dict, List, Any

import azure.functions as func
import requests
from sendgrid import SendGridAPIClient
from sendgrid.helpers.mail import Mail, Email, To, Content

# Configuration
BASEROW_URL = os.environ.get("BASEROW_URL", "")
BASEROW_TOKEN = os.environ.get("BASEROW_TOKEN", "")
TABLE_DOCUMENTS = os.environ.get("TABLE_DOCUMENTS", "")
TABLE_EMPLOYEES = os.environ.get("TABLE_EMPLOYEES", "")
SENDGRID_API_KEY = os.environ.get("SENDGRID_API_KEY", "")
ALERT_FROM_EMAIL = os.environ.get("ALERT_FROM_EMAIL", "alerts@nexamesh.ai")
ALERT_TO_ADMIN = os.environ.get("ALERT_TO_ADMIN", "hans@nexamesh.ai")

# Alert thresholds (days)
ALERT_THRESHOLDS = [60, 30, 7]

# Logger
logger = logging.getLogger("document-expiry-alert")


def get_baserow_headers() -> Dict[str, str]:
    """Get headers for Baserow API requests."""
    return {
        "Authorization": f"Token {BASEROW_TOKEN}",
        "Content-Type": "application/json"
    }


def fetch_documents() -> List[Dict[str, Any]]:
    """Fetch all documents from Baserow."""
    url = f"{BASEROW_URL}/api/database/rows/table/{TABLE_DOCUMENTS}/"
    try:
        response = requests.get(url, headers=get_baserow_headers())
        response.raise_for_status()
        return response.json().get("results", [])
    except requests.RequestException as e:
        logger.error(f"Failed to fetch documents: {e}")
        return []


def fetch_employee(employee_id: int) -> Dict[str, Any]:
    """Fetch employee details from Baserow."""
    url = f"{BASEROW_URL}/api/database/rows/table/{TABLE_EMPLOYEES}/{employee_id}/"
    try:
        response = requests.get(url, headers=get_baserow_headers())
        response.raise_for_status()
        return response.json()
    except requests.RequestException as e:
        logger.error(f"Failed to fetch employee {employee_id}: {e}")
        return {}


def calculate_days_until_expiry(next_review: str) -> int:
    """Calculate days until document expires."""
    if not next_review:
        return 999  # No expiry date
    
    try:
        review_date = datetime.strptime(next_review, "%Y-%m-%d")
        today = datetime.now().replace(hour=0, minute=0, second=0, microsecond=0)
        return (review_date - today).days
    except ValueError:
        return 999


def get_alert_level(days: int) -> str:
    """Get alert level based on days until expiry."""
    if days <= 7:
        return "URGENT"
    elif days <= 30:
        return "WARNING"
    elif days <= 60:
        return "NOTICE"
    else:
        return "OK"


def send_alert_email(to_email: str, subject: str, content: str) -> bool:
    """Send alert email via SendGrid."""
    if not SENDGRID_API_KEY:
        logger.warning("SendGrid API key not configured - email not sent")
        return False
    
    try:
        sg = SendGridAPIClient(SENDGRID_API_KEY)
        message = Mail(
            from_email=Email(ALERT_FROM_EMAIL),
            to_emails=To(to_email),
            subject=subject,
            plain_text_content=Content("text/plain", content)
        )
        response = sg.send(message)
        logger.info(f"Email sent to {to_email}: {response.status_code}")
        return response.status_code == 202
    except Exception as e:
        logger.error(f"Failed to send email: {e}")
        return False


def generate_alert_content(doc: Dict, days: int, level: str) -> str:
    """Generate alert email content."""
    return f"""
House of Veritas - Document Expiry Alert

Document: {doc.get('Doc Name', 'Unknown')}
Type: {doc.get('Type', 'Unknown')}
Next Review Date: {doc.get('Next Review', 'Unknown')}
Days Until Expiry: {days}
Alert Level: {level}

Action Required:
Please review and renew this document before it expires.

Access the document management system at:
https://sign.nexamesh.ai

---
This is an automated alert from House of Veritas Document Management.
"""


def generate_admin_summary(alerts: List[Dict]) -> str:
    """Generate admin summary email content."""
    urgent = [a for a in alerts if a["level"] == "URGENT"]
    warning = [a for a in alerts if a["level"] == "WARNING"]
    notice = [a for a in alerts if a["level"] == "NOTICE"]
    
    content = f"""
House of Veritas - Daily Document Expiry Summary

Date: {datetime.now().strftime("%Y-%m-%d")}
Total Documents Requiring Attention: {len(alerts)}

"""
    
    if urgent:
        content += f"\n🔴 URGENT ({len(urgent)} documents expiring within 7 days):\n"
        for alert in urgent:
            content += f"  - {alert['doc_name']} (expires in {alert['days']} days)\n"
    
    if warning:
        content += f"\n🟡 WARNING ({len(warning)} documents expiring within 30 days):\n"
        for alert in warning:
            content += f"  - {alert['doc_name']} (expires in {alert['days']} days)\n"
    
    if notice:
        content += f"\n🟢 NOTICE ({len(notice)} documents expiring within 60 days):\n"
        for alert in notice:
            content += f"  - {alert['doc_name']} (expires in {alert['days']} days)\n"
    
    content += """
---
Access the document management system at:
https://sign.nexamesh.ai

For operations dashboard:
https://ops.nexamesh.ai

---
This is an automated summary from House of Veritas Document Management.
"""
    
    return content


def main(timer: func.TimerRequest) -> None:
    """Azure Function entry point (Timer trigger)."""
    logger.info("Document expiry check started")
    
    if timer.past_due:
        logger.warning("Timer is running late")
    
    # Fetch all documents
    documents = fetch_documents()
    logger.info(f"Found {len(documents)} documents")
    
    alerts = []
    emails_sent = 0
    
    for doc in documents:
        next_review = doc.get("Next Review", "")
        days = calculate_days_until_expiry(next_review)
        level = get_alert_level(days)
        
        # Check if alert should be sent
        if days in ALERT_THRESHOLDS or days <= 7:
            alert_info = {
                "doc_name": doc.get("Doc Name", "Unknown"),
                "type": doc.get("Type", "Unknown"),
                "days": days,
                "level": level,
                "next_review": next_review
            }
            alerts.append(alert_info)
            
            # Get responsible party email
            responsible_id = doc.get("Party Responsible", [{}])
            if isinstance(responsible_id, list) and responsible_id:
                responsible_id = responsible_id[0].get("id")
            
            if responsible_id:
                employee = fetch_employee(responsible_id)
                employee_email = employee.get("Email", "")
                
                if employee_email:
                    subject = f"[{level}] Document Expiry Alert: {doc.get('Doc Name')}"
                    content = generate_alert_content(doc, days, level)
                    
                    if send_alert_email(employee_email, subject, content):
                        emails_sent += 1
    
    # Send admin summary
    if alerts:
        subject = f"Document Expiry Summary - {datetime.now().strftime('%Y-%m-%d')}"
        summary = generate_admin_summary(alerts)
        send_alert_email(ALERT_TO_ADMIN, subject, summary)
        emails_sent += 1
    
    logger.info(f"Document expiry check complete. Alerts: {len(alerts)}, Emails sent: {emails_sent}")


# Local testing
if __name__ == "__main__":
    # Test data
    test_docs = [
        {"Doc Name": "Employment Contract - Charl", "Type": "HR", "Next Review": "2025-01-20"},
        {"Doc Name": "Workshop Safety Manual", "Type": "Safety", "Next Review": "2025-02-15"},
        {"Doc Name": "Property Charter", "Type": "Governance", "Next Review": "2025-06-01"}
    ]
    
    for doc in test_docs:
        days = calculate_days_until_expiry(doc["Next Review"])
        level = get_alert_level(days)
        print(f"{doc['Doc Name']}: {days} days, Level: {level}")
