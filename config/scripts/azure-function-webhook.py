"""
House of Veritas - Azure Function: DocuSeal Webhook Handler

This Azure Function receives webhooks from DocuSeal when documents are signed
and updates the corresponding records in Baserow.

Deployment:
1. Create Azure Function App (Python runtime)
2. Deploy this function
3. Configure application settings (environment variables)
4. Register webhook URL in DocuSeal

Environment Variables Required:
- BASEROW_URL: Base URL of Baserow instance
- BASEROW_TOKEN: API token with write permissions
- DOCUSEAL_WEBHOOK_SECRET: Secret for webhook validation
- TABLE_EMPLOYEES: Employee table ID in Baserow
- TABLE_DOCUMENTS: Document expiry table ID in Baserow
"""

import json
import hmac
import hashlib
import logging
import os
from datetime import datetime
from typing import Dict, Any, Optional

import azure.functions as func
import requests

# Configuration from environment
BASEROW_URL = os.environ.get("BASEROW_URL", "")
BASEROW_TOKEN = os.environ.get("BASEROW_TOKEN", "")
WEBHOOK_SECRET = os.environ.get("DOCUSEAL_WEBHOOK_SECRET", "")
TABLE_EMPLOYEES = os.environ.get("TABLE_EMPLOYEES", "")
TABLE_DOCUMENTS = os.environ.get("TABLE_DOCUMENTS", "")

# Logger
logger = logging.getLogger("docuseal-webhook")


def validate_webhook_signature(payload: bytes, signature: str) -> bool:
    """Validate DocuSeal webhook signature."""
    if not WEBHOOK_SECRET:
        logger.warning("No webhook secret configured - skipping validation")
        return True
    
    expected_signature = hmac.new(
        WEBHOOK_SECRET.encode(),
        payload,
        hashlib.sha256
    ).hexdigest()
    
    return hmac.compare_digest(signature, expected_signature)


def update_baserow_row(table_id: str, row_id: int, data: Dict[str, Any]) -> Optional[Dict]:
    """Update a row in Baserow."""
    url = f"{BASEROW_URL}/api/database/rows/table/{table_id}/{row_id}/"
    headers = {
        "Authorization": f"Token {BASEROW_TOKEN}",
        "Content-Type": "application/json"
    }
    
    try:
        response = requests.patch(url, headers=headers, json=data)
        response.raise_for_status()
        return response.json()
    except requests.RequestException as e:
        logger.error(f"Failed to update Baserow row: {e}")
        return None


def find_baserow_row(table_id: str, field: str, value: str) -> Optional[int]:
    """Find a row in Baserow by field value."""
    url = f"{BASEROW_URL}/api/database/rows/table/{table_id}/"
    headers = {
        "Authorization": f"Token {BASEROW_TOKEN}"
    }
    params = {
        f"filter__{field}__equal": value
    }
    
    try:
        response = requests.get(url, headers=headers, params=params)
        response.raise_for_status()
        results = response.json().get("results", [])
        if results:
            return results[0]["id"]
        return None
    except requests.RequestException as e:
        logger.error(f"Failed to find Baserow row: {e}")
        return None


def handle_submission_completed(submission: Dict[str, Any]) -> Dict[str, Any]:
    """Handle a completed document submission."""
    result = {
        "success": False,
        "actions": []
    }
    
    # Extract submission details
    submission_id = submission.get("id")
    template_name = submission.get("template", {}).get("name", "")
    submitters = submission.get("submitters", [])
    completed_at = submission.get("completed_at", datetime.utcnow().isoformat())
    document_url = submission.get("documents", [{}])[0].get("url", "")
    
    logger.info(f"Processing completed submission: {submission_id} - {template_name}")
    
    # Update employee contract status if this is an employment contract
    if "Employment Contract" in template_name:
        for submitter in submitters:
            email = submitter.get("email", "")
            if email:
                employee_row = find_baserow_row(TABLE_EMPLOYEES, "Email", email)
                if employee_row:
                    update_data = {
                        "Contract Ref": document_url,
                        "Probation Status": "Completed"
                    }
                    update_result = update_baserow_row(TABLE_EMPLOYEES, employee_row, update_data)
                    if update_result:
                        result["actions"].append(f"Updated employee {email} contract status")
    
    # Update document expiry record
    doc_row = find_baserow_row(TABLE_DOCUMENTS, "Doc Name", template_name)
    if doc_row:
        update_data = {
            "DocuSeal Ref": document_url,
            "Last Review": completed_at[:10],  # Extract date portion
            "Status": "Active"
        }
        update_result = update_baserow_row(TABLE_DOCUMENTS, doc_row, update_data)
        if update_result:
            result["actions"].append(f"Updated document expiry record for {template_name}")
    
    result["success"] = len(result["actions"]) > 0
    return result


def main(req: func.HttpRequest) -> func.HttpResponse:
    """Azure Function entry point."""
    logger.info("DocuSeal webhook received")
    
    # Validate signature
    signature = req.headers.get("X-DocuSeal-Signature", "")
    body = req.get_body()
    
    if not validate_webhook_signature(body, signature):
        logger.warning("Invalid webhook signature")
        return func.HttpResponse(
            json.dumps({"error": "Invalid signature"}),
            status_code=401,
            mimetype="application/json"
        )
    
    # Parse payload
    try:
        payload = req.get_json()
    except ValueError:
        logger.error("Invalid JSON payload")
        return func.HttpResponse(
            json.dumps({"error": "Invalid JSON"}),
            status_code=400,
            mimetype="application/json"
        )
    
    # Extract event type
    event_type = payload.get("event_type", "")
    submission = payload.get("data", {})
    
    logger.info(f"Event type: {event_type}")
    
    # Process event
    result = {"event": event_type, "processed": False}
    
    if event_type == "submission.completed":
        result = handle_submission_completed(submission)
    elif event_type == "submission.viewed":
        logger.info(f"Document viewed: {submission.get('id')}")
        result["processed"] = True
    else:
        logger.info(f"Unhandled event type: {event_type}")
    
    return func.HttpResponse(
        json.dumps(result),
        status_code=200,
        mimetype="application/json"
    )


# Local testing
if __name__ == "__main__":
    # Test payload
    test_payload = {
        "event_type": "submission.completed",
        "data": {
            "id": 123,
            "template": {"name": "Employment Contract - Charl"},
            "submitters": [{"email": "charl@nexamesh.ai"}],
            "completed_at": "2025-01-15T10:30:00Z",
            "documents": [{"url": "https://sign.nexamesh.ai/docs/123.pdf"}]
        }
    }
    
    print(json.dumps(test_payload, indent=2))
    print("\nTo test: Set environment variables and run handle_submission_completed()")
