"""
House of Veritas - Shared Utilities for Azure Functions

Common utilities used across all Azure Functions including:
- Baserow API client
- Email sending (Azure Communication Services)
- SMS sending (Twilio)
- Logging utilities
- Configuration management
"""

import os
import json
import logging
from datetime import datetime, timezone
from typing import Dict, List, Any, Optional
from dataclasses import dataclass
from enum import Enum

import requests

try:
    # azure-communication-email is the only ACS dep we need; keep it lazy so
    # local imports / unit tests don't blow up if it isn't installed.
    from azure.communication.email import EmailClient as _AcsEmailClient  # type: ignore
except ImportError:  # pragma: no cover
    _AcsEmailClient = None  # type: ignore

# ============================================
# Configuration
# ============================================

@dataclass
class Config:
    """Configuration loaded from environment variables."""
    # Baserow
    baserow_url: str = ""
    baserow_token: str = ""
    
    # Table IDs (update after Baserow setup)
    table_employees: str = ""
    table_assets: str = ""
    table_tasks: str = ""
    table_time_clock: str = ""
    table_incidents: str = ""
    table_vehicle_logs: str = ""
    table_expenses: str = ""
    table_document_expiry: str = ""
    
    # DocuSeal
    docuseal_url: str = ""
    docuseal_api_key: str = ""
    docuseal_webhook_secret: str = ""
    
    # Email (Azure Communication Services)
    acs_connection_string: str = ""
    email_from: str = "alerts@nexamesh.ai"
    
    # SMS (Twilio)
    twilio_account_sid: str = ""
    twilio_auth_token: str = ""
    twilio_phone_number: str = ""
    
    # Admin contacts
    admin_email: str = "hans@nexamesh.ai"
    admin_phone: str = ""
    
    # Azure Storage
    storage_connection_string: str = ""
    backup_container: str = "backups"
    archive_container: str = "archive"
    
    @classmethod
    def from_env(cls) -> "Config":
        """Load configuration from environment variables."""
        return cls(
            baserow_url=os.environ.get("BASEROW_URL", ""),
            baserow_token=os.environ.get("BASEROW_TOKEN", ""),
            table_employees=os.environ.get("TABLE_EMPLOYEES", "1"),
            table_assets=os.environ.get("TABLE_ASSETS", "2"),
            table_tasks=os.environ.get("TABLE_TASKS", "3"),
            table_time_clock=os.environ.get("TABLE_TIME_CLOCK", "4"),
            table_incidents=os.environ.get("TABLE_INCIDENTS", "5"),
            table_vehicle_logs=os.environ.get("TABLE_VEHICLE_LOGS", "6"),
            table_expenses=os.environ.get("TABLE_EXPENSES", "7"),
            table_document_expiry=os.environ.get("TABLE_DOCUMENT_EXPIRY", "8"),
            docuseal_url=os.environ.get("DOCUSEAL_URL", ""),
            docuseal_api_key=os.environ.get("DOCUSEAL_API_KEY", ""),
            docuseal_webhook_secret=os.environ.get("DOCUSEAL_WEBHOOK_SECRET", ""),
            acs_connection_string=os.environ.get("ACS_CONNECTION_STRING", ""),
            email_from=os.environ.get("EMAIL_FROM", "alerts@nexamesh.ai"),
            twilio_account_sid=os.environ.get("TWILIO_ACCOUNT_SID", ""),
            twilio_auth_token=os.environ.get("TWILIO_AUTH_TOKEN", ""),
            twilio_phone_number=os.environ.get("TWILIO_PHONE_NUMBER", ""),
            admin_email=os.environ.get("ADMIN_EMAIL", "hans@nexamesh.ai"),
            admin_phone=os.environ.get("ADMIN_PHONE", ""),
            storage_connection_string=os.environ.get("AZURE_STORAGE_CONNECTION_STRING", ""),
            backup_container=os.environ.get("BACKUP_CONTAINER", "backups"),
            archive_container=os.environ.get("ARCHIVE_CONTAINER", "archive"),
        )


# Global config instance
config = Config.from_env()


# ============================================
# Baserow API Client
# ============================================

class BaserowClient:
    """Client for interacting with Baserow API."""
    
    def __init__(self, base_url: str = None, token: str = None):
        self.base_url = (base_url or config.baserow_url).rstrip("/")
        self.token = token or config.baserow_token
        self.logger = logging.getLogger("baserow-client")
    
    @property
    def headers(self) -> Dict[str, str]:
        return {
            "Authorization": f"Token {self.token}",
            "Content-Type": "application/json"
        }
    
    def _request(self, method: str, endpoint: str, **kwargs) -> Optional[Dict]:
        """Make an API request."""
        url = f"{self.base_url}{endpoint}"
        try:
            response = requests.request(method, url, headers=self.headers, **kwargs)
            response.raise_for_status()
            return response.json() if response.content else {}
        except requests.RequestException as e:
            self.logger.error(f"Baserow API error: {e}")
            return None
    
    # ---- Row Operations ----
    
    def list_rows(self, table_id: str, filters: Dict = None, page: int = 1, size: int = 100) -> List[Dict]:
        """List rows from a table with optional filters."""
        params = {"page": page, "size": size}
        if filters:
            for field, value in filters.items():
                params[f"filter__{field}__equal"] = value
        
        result = self._request("GET", f"/api/database/rows/table/{table_id}/", params=params)
        return result.get("results", []) if result else []
    
    def get_row(self, table_id: str, row_id: int) -> Optional[Dict]:
        """Get a single row by ID."""
        return self._request("GET", f"/api/database/rows/table/{table_id}/{row_id}/")
    
    def create_row(self, table_id: str, data: Dict) -> Optional[Dict]:
        """Create a new row."""
        return self._request("POST", f"/api/database/rows/table/{table_id}/", json=data)
    
    def update_row(self, table_id: str, row_id: int, data: Dict) -> Optional[Dict]:
        """Update an existing row."""
        return self._request("PATCH", f"/api/database/rows/table/{table_id}/{row_id}/", json=data)
    
    def delete_row(self, table_id: str, row_id: int) -> bool:
        """Delete a row."""
        result = self._request("DELETE", f"/api/database/rows/table/{table_id}/{row_id}/")
        return result is not None
    
    def batch_create_rows(self, table_id: str, rows: List[Dict]) -> List[Dict]:
        """Create multiple rows at once."""
        result = self._request("POST", f"/api/database/rows/table/{table_id}/batch/", json={"items": rows})
        return result.get("items", []) if result else []
    
    def batch_update_rows(self, table_id: str, rows: List[Dict]) -> List[Dict]:
        """Update multiple rows at once. Each row dict must include 'id'."""
        result = self._request("PATCH", f"/api/database/rows/table/{table_id}/batch/", json={"items": rows})
        return result.get("items", []) if result else []
    
    # ---- Convenience Methods ----
    
    def find_row_by_field(self, table_id: str, field: str, value: str) -> Optional[Dict]:
        """Find a single row by field value."""
        rows = self.list_rows(table_id, filters={field: value}, size=1)
        return rows[0] if rows else None
    
    def get_employees(self, active_only: bool = True) -> List[Dict]:
        """Get all employees."""
        filters = {"Active": "true"} if active_only else {}
        return self.list_rows(config.table_employees, filters=filters)
    
    def get_employee_by_email(self, email: str) -> Optional[Dict]:
        """Get employee by email address."""
        return self.find_row_by_field(config.table_employees, "Email", email)
    
    def get_tasks_for_employee(self, employee_id: int, status: str = None) -> List[Dict]:
        """Get tasks assigned to an employee."""
        filters = {"Assigned To": str(employee_id)}
        if status:
            filters["Status"] = status
        return self.list_rows(config.table_tasks, filters=filters)
    
    def get_expiring_documents(self, days_ahead: int = 60) -> List[Dict]:
        """Get documents expiring within specified days."""
        # Note: This is a simplified version. In production, use date filters.
        all_docs = self.list_rows(config.table_document_expiry)
        today = datetime.now(timezone.utc).date()
        
        expiring = []
        for doc in all_docs:
            next_review = doc.get("Next Review")
            if next_review:
                try:
                    review_date = datetime.strptime(next_review, "%Y-%m-%d").date()
                    days_until = (review_date - today).days
                    if 0 <= days_until <= days_ahead:
                        doc["_days_until_expiry"] = days_until
                        expiring.append(doc)
                except ValueError:
                    pass
        
        return sorted(expiring, key=lambda x: x.get("_days_until_expiry", 999))


# ============================================
# Email Client (Azure Communication Services)
# ============================================

class EmailClient:
    """Client for sending emails via Azure Communication Services.

    Public surface (`send_email`, `send_html_email`, `send_template_email`)
    is unchanged from the previous SendGrid implementation so all existing
    Functions keep working.
    """

    def __init__(self, connection_string: str = None, from_email: str = None):
        self.connection_string = connection_string or config.acs_connection_string
        self.from_email = from_email or config.email_from
        self.logger = logging.getLogger("email-client")
        self._client = None
        if self.connection_string and _AcsEmailClient is not None:
            try:
                self._client = _AcsEmailClient.from_connection_string(self.connection_string)
            except Exception as exc:  # pragma: no cover — defensive
                self.logger.error(f"ACS EmailClient init failed: {exc}")

    def send_email(
        self,
        to_email: str,
        subject: str,
        content: str,
        content_type: str = "text/plain",
        cc: List[str] = None,
        attachments: List[Dict] = None,
    ) -> bool:
        """Send an email via Azure Communication Services Email."""
        if self._client is None:
            self.logger.warning("ACS EmailClient not configured (ACS_CONNECTION_STRING missing)")
            return False

        is_html = content_type.lower() == "text/html"
        body = {"subject": subject}
        if is_html:
            body["html"] = content
        else:
            body["plainText"] = content

        message: Dict[str, Any] = {
            "senderAddress": self.from_email,
            "recipients": {
                "to": [{"address": to_email}],
            },
            "content": body,
        }

        if cc:
            message["recipients"]["cc"] = [{"address": e} for e in cc]

        if attachments:
            # ACS attachments expect: { name, contentType, contentInBase64 }.
            # Translate from the SendGrid-shaped dicts the existing callers
            # pass in (which look like { filename, type, content }) on a
            # best-effort basis.
            message["attachments"] = [
                {
                    "name": a.get("name") or a.get("filename") or "attachment",
                    "contentType": a.get("contentType") or a.get("type") or "application/octet-stream",
                    "contentInBase64": a.get("contentInBase64") or a.get("content") or "",
                }
                for a in attachments
            ]

        try:
            poller = self._client.begin_send(message)
            result = poller.result()
            status = result.get("status") if isinstance(result, dict) else getattr(result, "status", None)
            if status == "Succeeded":
                self.logger.info(f"Email sent to {to_email}")
                return True
            self.logger.error(f"Email send did not succeed: status={status}")
            return False
        except Exception as exc:
            self.logger.error(f"Email send error: {exc}")
            return False
    
    def send_html_email(self, to_email: str, subject: str, html_content: str, **kwargs) -> bool:
        """Send an HTML email."""
        return self.send_email(to_email, subject, html_content, content_type="text/html", **kwargs)
    
    def send_template_email(
        self,
        to_email: str,
        template_name: str,
        context: Dict[str, Any],
        **kwargs
    ) -> bool:
        """Send email using a template."""
        template = EMAIL_TEMPLATES.get(template_name)
        if not template:
            self.logger.error(f"Template not found: {template_name}")
            return False
        
        subject = template["subject"].format(**context)
        content = template["body"].format(**context)
        
        return self.send_email(to_email, subject, content, **kwargs)


# ============================================
# SMS Client (Twilio)
# ============================================

class SMSClient:
    """Client for sending SMS via Twilio."""
    
    def __init__(
        self,
        account_sid: str = None,
        auth_token: str = None,
        from_number: str = None
    ):
        self.account_sid = account_sid or config.twilio_account_sid
        self.auth_token = auth_token or config.twilio_auth_token
        self.from_number = from_number or config.twilio_phone_number
        self.logger = logging.getLogger("sms-client")
    
    def send_sms(self, to_number: str, message: str) -> bool:
        """Send an SMS via Twilio."""
        if not all([self.account_sid, self.auth_token, self.from_number]):
            self.logger.warning("Twilio not fully configured")
            return False
        
        url = f"https://api.twilio.com/2010-04-01/Accounts/{self.account_sid}/Messages.json"
        
        try:
            response = requests.post(
                url,
                auth=(self.account_sid, self.auth_token),
                data={
                    "From": self.from_number,
                    "To": to_number,
                    "Body": message
                }
            )
            
            if response.status_code == 201:
                self.logger.info(f"SMS sent to {to_number}")
                return True
            else:
                self.logger.error(f"SMS send failed: {response.status_code}")
                return False
        except requests.RequestException as e:
            self.logger.error(f"SMS send error: {e}")
            return False


# ============================================
# Email Templates
# ============================================

EMAIL_TEMPLATES = {
    "document_expiry_notice": {
        "subject": "[{level}] Document Expiry Alert: {doc_name}",
        "body": """
House of Veritas - Document Expiry Alert

Document: {doc_name}
Type: {doc_type}
Next Review Date: {next_review}
Days Until Expiry: {days}
Alert Level: {level}

Action Required:
Please review and renew this document before it expires.

Access the document management system at:
{docuseal_url}

---
This is an automated alert from House of Veritas Document Management.
"""
    },
    
    "document_expiry_summary": {
        "subject": "Document Expiry Summary - {date}",
        "body": """
House of Veritas - Daily Document Expiry Summary

Date: {date}
Total Documents Requiring Attention: {total_count}

{urgent_section}
{warning_section}
{notice_section}

---
Access the document management system at:
{docuseal_url}

For operations dashboard:
{baserow_url}

---
This is an automated summary from House of Veritas Document Management.
"""
    },
    
    "expense_approval_request": {
        "subject": "[Action Required] New Expense Submission - R{amount}",
        "body": """
House of Veritas - Expense Approval Request

A new expense has been submitted for your approval.

Details:
- Requester: {requester}
- Amount: R{amount}
- Category: {category}
- Type: {expense_type}
- Date: {date}
- Description: {description}

Please review and approve/reject this expense at:
{baserow_url}

---
This is an automated notification from House of Veritas.
"""
    },
    
    "overtime_alert": {
        "subject": "Overtime Alert: {employee_name} - {overtime_hours}hrs",
        "body": """
House of Veritas - Overtime Alert

Employee {employee_name} has worked overtime this week.

Details:
- Employee: {employee_name}
- Week: {week_start} to {week_end}
- Total Hours: {total_hours}
- Regular Hours: 45
- Overtime Hours: {overtime_hours}
- Estimated Overtime Cost: R{overtime_cost}

Please review and approve the overtime at:
{baserow_url}

---
Per BCEA regulations, overtime must be approved and properly compensated.
"""
    },
    
    "task_assignment": {
        "subject": "New Task Assigned: {task_title}",
        "body": """
House of Veritas - Task Assignment

A new task has been assigned to you.

Task: {task_title}
Due Date: {due_date}
Priority: {priority}
Description: {description}

View your tasks at:
{baserow_url}

---
This is an automated notification from House of Veritas.
"""
    },
    
    "leave_balance_update": {
        "subject": "Leave Balance Update - {month} {year}",
        "body": """
House of Veritas - Leave Balance Update

Your leave balance has been updated for {month} {year}.

Leave Summary:
- Annual Leave Balance: {annual_leave} days
- Sick Leave Balance: {sick_leave} days (3-year cycle)
- Family Responsibility: {family_leave} days

Note: Annual leave accrues at 1.25 days per month (15 days/year).

For leave requests, please contact Hans or submit via:
{baserow_url}

---
This is an automated notification from House of Veritas.
"""
    },
    
    "backup_complete": {
        "subject": "Weekly Backup Complete - {date}",
        "body": """
House of Veritas - Backup Report

Weekly backup completed successfully.

Date: {date}
Tables Exported: {table_count}
Total Records: {record_count}
Storage Location: {storage_location}

Backup Files:
{file_list}

---
This is an automated notification from House of Veritas.
"""
    }
}


# ============================================
# Logging Utilities
# ============================================

def setup_logging(name: str = "hov-function") -> logging.Logger:
    """Set up logging for Azure Functions."""
    logger = logging.getLogger(name)
    logger.setLevel(logging.INFO)
    
    if not logger.handlers:
        handler = logging.StreamHandler()
        formatter = logging.Formatter(
            "%(asctime)s - %(name)s - %(levelname)s - %(message)s"
        )
        handler.setFormatter(formatter)
        logger.addHandler(handler)
    
    return logger


# ============================================
# Date/Time Utilities
# ============================================

def get_current_datetime() -> datetime:
    """Get current datetime in UTC."""
    return datetime.now(timezone.utc)


def format_date(dt: datetime, fmt: str = "%Y-%m-%d") -> str:
    """Format datetime to string."""
    return dt.strftime(fmt)


def parse_date(date_str: str, fmt: str = "%Y-%m-%d") -> Optional[datetime]:
    """Parse date string to datetime."""
    try:
        return datetime.strptime(date_str, fmt)
    except ValueError:
        return None


def get_week_range(dt: datetime = None) -> tuple:
    """Get start and end of the week for a given date."""
    if dt is None:
        dt = get_current_datetime()
    
    start = dt - timedelta(days=dt.weekday())
    end = start + timedelta(days=6)
    
    return start.date(), end.date()


def get_month_name(month: int) -> str:
    """Get month name from number."""
    months = [
        "January", "February", "March", "April", "May", "June",
        "July", "August", "September", "October", "November", "December"
    ]
    return months[month - 1] if 1 <= month <= 12 else ""


# Import timedelta for date calculations
from datetime import timedelta
