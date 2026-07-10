#!/usr/bin/env python3
"""
House of Veritas - Azure Deployment Checklist & Verification Script

This script automates the verification of Azure infrastructure deployment,
providing detailed status for each component and clear guidance on what
needs to be set up.

Usage:
    python3 deployment-checklist.py [--verbose] [--json] [--fix]

Options:
    --verbose    Show detailed output for each check
    --json       Output results in JSON format
    --fix        Attempt to fix issues where possible

Requirements:
    - Azure CLI installed and authenticated
    - Terraform installed (for IaC checks)
    - Python 3.8+

Environment Variables (optional):
    AZURE_SUBSCRIPTION_ID - Target subscription ID
    AZURE_RESOURCE_GROUP - Resource group name (default: rg-houseofveritas)
    AZURE_LOCATION - Azure region (default: southafricanorth)
"""

import subprocess
import json
import sys
import os
from pathlib import Path
from dataclasses import dataclass, field, asdict
from typing import List, Optional, Dict, Any
from datetime import datetime
from enum import Enum


class Status(Enum):
    PASS = "✅ PASS"
    FAIL = "❌ FAIL"
    WARN = "⚠️ WARNING"
    SKIP = "⏭️ SKIPPED"
    INFO = "ℹ️ INFO"


@dataclass
class CheckResult:
    name: str
    status: Status
    message: str
    details: Optional[str] = None
    fix_command: Optional[str] = None
    documentation: Optional[str] = None


@dataclass
class CheckCategory:
    name: str
    description: str
    checks: List[CheckResult] = field(default_factory=list)
    
    @property
    def passed(self) -> int:
        return sum(1 for c in self.checks if c.status == Status.PASS)
    
    @property
    def failed(self) -> int:
        return sum(1 for c in self.checks if c.status == Status.FAIL)
    
    @property
    def warnings(self) -> int:
        return sum(1 for c in self.checks if c.status == Status.WARN)


class DeploymentChecker:
    """Azure deployment verification checker."""
    
    def __init__(self, verbose: bool = False):
        self.verbose = verbose
        self.categories: List[CheckCategory] = []
        self.repo_root = Path(__file__).resolve().parents[2]
        
        # Configuration
        self.subscription_id = os.environ.get("AZURE_SUBSCRIPTION_ID", "")
        self.resource_group = os.environ.get("AZURE_RESOURCE_GROUP", "nl-prod-hov-rg")
        self.location = os.environ.get("AZURE_LOCATION", "southafricanorth")
        self.env = os.environ.get("AZURE_ENV", "prod")
        self.enable_operational_services = os.environ.get("ENABLE_OPERATIONAL_SERVICES", "false").lower() == "true"
        self.enable_application_gateway = os.environ.get("ENABLE_APPLICATION_GATEWAY", "false").lower() == "true"

        # Naming convention: nl-{env}-hov-{resourcetype}
        self.expected_resources = {
            "vnet": f"nl-{self.env}-hov-vnet",
            "postgres": f"nl-{self.env}-hov-pg",
            "storage": f"nl{self.env}hovst",  # Storage accounts can't have hyphens
            "keyvault": f"nl-{self.env}-hov-kv",
            "appgateway": f"nl-{self.env}-hov-agw",
            "docuseal": f"{self.env}-docuseal",
            "baserow": f"{self.env}-baserow",
            "functionapp": f"nl-{self.env}-hov-func",
        }
    
    def run_command(self, command: List[str], capture_output: bool = True) -> tuple:
        """Run a shell command and return (success, output, error)."""
        try:
            result = subprocess.run(
                command,
                capture_output=capture_output,
                text=True,
                timeout=60
            )
            return (
                result.returncode == 0,
                result.stdout.strip() if result.stdout else "",
                result.stderr.strip() if result.stderr else ""
            )
        except subprocess.TimeoutExpired:
            return False, "", "Command timed out"
        except FileNotFoundError:
            return False, "", f"Command not found: {command[0]}"
        except Exception as e:
            return False, "", str(e)
    
    def check_azure_cli(self) -> CheckResult:
        """Check if Azure CLI is installed and authenticated."""
        success, output, error = self.run_command(["az", "version"])
        
        if not success:
            return CheckResult(
                name="Azure CLI Installation",
                status=Status.FAIL,
                message="Azure CLI is not installed",
                details=error,
                fix_command="curl -sL https://aka.ms/InstallAzureCLIDeb | sudo bash",
                documentation="https://docs.microsoft.com/en-us/cli/azure/install-azure-cli"
            )
        
        # Check authentication
        success, output, error = self.run_command(["az", "account", "show"])
        
        if not success:
            return CheckResult(
                name="Azure CLI Authentication",
                status=Status.FAIL,
                message="Azure CLI is not authenticated",
                details="You need to log in to Azure CLI",
                fix_command="az login",
                documentation="https://docs.microsoft.com/en-us/cli/azure/authenticate-azure-cli"
            )
        
        try:
            account = json.loads(output)
            return CheckResult(
                name="Azure CLI",
                status=Status.PASS,
                message=f"Authenticated as: {account.get('user', {}).get('name', 'Unknown')}",
                details=f"Subscription: {account.get('name', 'Unknown')}"
            )
        except json.JSONDecodeError:
            return CheckResult(
                name="Azure CLI",
                status=Status.WARN,
                message="Azure CLI installed but unable to parse account info",
                details=output
            )
    
    def check_subscription(self) -> CheckResult:
        """Check if correct Azure subscription is selected."""
        success, output, error = self.run_command(["az", "account", "show", "-o", "json"])
        
        if not success:
            return CheckResult(
                name="Azure Subscription",
                status=Status.FAIL,
                message="Unable to get subscription info",
                details=error
            )
        
        try:
            account = json.loads(output)
            sub_id = account.get("id", "")
            sub_name = account.get("name", "Unknown")
            
            if self.subscription_id and sub_id != self.subscription_id:
                return CheckResult(
                    name="Azure Subscription",
                    status=Status.WARN,
                    message=f"Current subscription ({sub_name}) may not be correct",
                    details=f"Expected: {self.subscription_id}, Got: {sub_id}",
                    fix_command=f"az account set --subscription {self.subscription_id}"
                )
            
            return CheckResult(
                name="Azure Subscription",
                status=Status.PASS,
                message=f"Using subscription: {sub_name}",
                details=f"ID: {sub_id}"
            )
        except json.JSONDecodeError:
            return CheckResult(
                name="Azure Subscription",
                status=Status.FAIL,
                message="Unable to parse subscription info",
                details=output
            )
    
    def check_resource_group(self) -> CheckResult:
        """Check if resource group exists."""
        success, output, error = self.run_command([
            "az", "group", "show",
            "--name", self.resource_group,
            "-o", "json"
        ])
        
        if not success:
            return CheckResult(
                name="Resource Group",
                status=Status.FAIL,
                message=f"Resource group '{self.resource_group}' does not exist",
                details="The resource group needs to be created before deploying resources",
                fix_command=f"az group create --name {self.resource_group} --location {self.location}",
                documentation="https://docs.microsoft.com/en-us/cli/azure/group"
            )
        
        try:
            rg = json.loads(output)
            return CheckResult(
                name="Resource Group",
                status=Status.PASS,
                message=f"Resource group '{self.resource_group}' exists",
                details=f"Location: {rg.get('location', 'Unknown')}"
            )
        except json.JSONDecodeError:
            return CheckResult(
                name="Resource Group",
                status=Status.WARN,
                message="Resource group exists but unable to parse details",
                details=output
            )
    
    def check_terraform(self) -> CheckResult:
        """Check if Terraform is installed and state is configured."""
        success, output, error = self.run_command(["terraform", "version"])
        
        if not success:
            return CheckResult(
                name="Terraform Installation",
                status=Status.FAIL,
                message="Terraform is not installed",
                details=error,
                fix_command="curl -fsSL https://apt.releases.hashicorp.com/gpg | sudo apt-key add - && sudo apt-add-repository \"deb [arch=amd64] https://apt.releases.hashicorp.com $(lsb_release -cs) main\" && sudo apt-get update && sudo apt-get install terraform",
                documentation="https://learn.hashicorp.com/tutorials/terraform/install-cli"
            )
        
        # Check if terraform is initialized in the project
        terraform_dir = self.repo_root / "terraform" / "environments" / "production"
        if not terraform_dir.exists():
            terraform_dir = self.repo_root / "terraform" / "prod"
        
        if not terraform_dir.exists():
            return CheckResult(
                name="Terraform Configuration",
                status=Status.WARN,
                message="Terraform directory not found",
                details="Expected at terraform/environments/production or terraform/prod",
                fix_command="Check terraform directory structure"
            )
        
        # Check for .terraform directory (initialized)
        if not (terraform_dir / ".terraform").exists():
            return CheckResult(
                name="Terraform State",
                status=Status.WARN,
                message="Terraform not initialized",
                details="Run terraform init to initialize the backend",
                fix_command=f"cd {terraform_dir} && terraform init"
            )
        
        return CheckResult(
            name="Terraform",
            status=Status.PASS,
            message="Terraform is installed and configured",
            details=output.split("\n")[0]
        )
    
    def check_vnet(self) -> CheckResult:
        """Check if Virtual Network exists."""
        vnet_name = self.expected_resources["vnet"]
        success, output, error = self.run_command([
            "az", "network", "vnet", "show",
            "--resource-group", self.resource_group,
            "--name", vnet_name,
            "-o", "json"
        ])
        
        if not success:
            return CheckResult(
                name="Virtual Network",
                status=Status.FAIL,
                message=f"VNet '{vnet_name}' does not exist",
                details="Network infrastructure needs to be deployed first",
                fix_command="cd /app/terraform/environments/production && terraform apply -target=module.network",
                documentation="/app/docs/03-deployment/01-deployment-guide.md"
            )
        
        try:
            vnet = json.loads(output)
            subnets = [s.get("name") for s in vnet.get("subnets", [])]
            return CheckResult(
                name="Virtual Network",
                status=Status.PASS,
                message=f"VNet '{vnet_name}' exists with {len(subnets)} subnets",
                details=f"Subnets: {', '.join(subnets)}"
            )
        except json.JSONDecodeError:
            return CheckResult(
                name="Virtual Network",
                status=Status.WARN,
                message="VNet exists but unable to parse details"
            )
    
    def check_postgres(self) -> CheckResult:
        """Check if PostgreSQL server exists."""
        pg_name = self.expected_resources["postgres"]
        success, output, error = self.run_command([
            "az", "postgres", "flexible-server", "show",
            "--resource-group", self.resource_group,
            "--name", pg_name,
            "-o", "json"
        ])
        
        if not success:
            return CheckResult(
                name="PostgreSQL Server",
                status=Status.FAIL,
                message=f"PostgreSQL server '{pg_name}' does not exist",
                details="Database infrastructure needs to be deployed",
                fix_command="cd /app/terraform/environments/production && terraform apply -target=module.database",
                documentation="/app/docs/02-architecture/01-technical-design.md#database-design"
            )
        
        try:
            pg = json.loads(output)
            state = pg.get("state", "Unknown")
            version = pg.get("version", "Unknown")
            
            if state != "Ready":
                return CheckResult(
                    name="PostgreSQL Server",
                    status=Status.WARN,
                    message=f"PostgreSQL server exists but state is '{state}'",
                    details=f"Version: {version}"
                )
            
            return CheckResult(
                name="PostgreSQL Server",
                status=Status.PASS,
                message=f"PostgreSQL server '{pg_name}' is ready",
                details=f"Version: {version}, State: {state}"
            )
        except json.JSONDecodeError:
            return CheckResult(
                name="PostgreSQL Server",
                status=Status.WARN,
                message="PostgreSQL server exists but unable to parse details"
            )
    
    def check_storage_account(self) -> CheckResult:
        """Check if Storage Account exists."""
        storage_name = self.expected_resources["storage"]
        success, output, error = self.run_command([
            "az", "storage", "account", "show",
            "--resource-group", self.resource_group,
            "--name", storage_name,
            "-o", "json"
        ])
        
        if not success:
            return CheckResult(
                name="Storage Account",
                status=Status.FAIL,
                message=f"Storage account '{storage_name}' does not exist",
                details="Storage infrastructure needs to be deployed for documents and backups",
                fix_command="cd /app/terraform/environments/production && terraform apply -target=module.storage",
                documentation="/app/docs/02-architecture/01-technical-design.md#storage"
            )
        
        try:
            storage = json.loads(output)
            return CheckResult(
                name="Storage Account",
                status=Status.PASS,
                message=f"Storage account '{storage_name}' exists",
                details=f"SKU: {storage.get('sku', {}).get('name', 'Unknown')}"
            )
        except json.JSONDecodeError:
            return CheckResult(
                name="Storage Account",
                status=Status.WARN,
                message="Storage account exists but unable to parse details"
            )
    
    def check_key_vault(self) -> CheckResult:
        """Check if Key Vault exists and has required secrets."""
        kv_name = self.expected_resources["keyvault"]
        success, output, error = self.run_command([
            "az", "keyvault", "show",
            "--resource-group", self.resource_group,
            "--name", kv_name,
            "-o", "json"
        ])
        
        if not success:
            return CheckResult(
                name="Key Vault",
                status=Status.FAIL,
                message=f"Key Vault '{kv_name}' does not exist",
                details="Key Vault is required for secure storage of secrets",
                fix_command="cd /app/terraform/environments/production && terraform apply -target=module.security",
                documentation="/app/docs/02-architecture/01-technical-design.md#secret-management"
            )
        
        # Check for required secrets
        required_secrets = [
            "postgres-admin-password",
            "docuseal-secret-key",
            "baserow-secret-key",
            "smtp-password"
        ]
        
        success, output, error = self.run_command([
            "az", "keyvault", "secret", "list",
            "--vault-name", kv_name,
            "-o", "json"
        ])
        
        if success:
            try:
                secrets = json.loads(output)
                existing_secrets = [s.get("name", "") for s in secrets]
                missing_secrets = [s for s in required_secrets if s not in existing_secrets]
                
                if missing_secrets:
                    return CheckResult(
                        name="Key Vault",
                        status=Status.WARN,
                        message=f"Key Vault exists but missing {len(missing_secrets)} secrets",
                        details=f"Missing: {', '.join(missing_secrets)}",
                        fix_command=f"az keyvault secret set --vault-name {kv_name} --name <secret-name> --value <secret-value>"
                    )
                
                return CheckResult(
                    name="Key Vault",
                    status=Status.PASS,
                    message=f"Key Vault '{kv_name}' configured with all required secrets",
                    details=f"Secrets configured: {len(existing_secrets)}"
                )
            except json.JSONDecodeError:
                pass
        
        return CheckResult(
            name="Key Vault",
            status=Status.PASS,
            message=f"Key Vault '{kv_name}' exists",
            details="Unable to verify secrets (may require additional permissions)"
        )
    
    def check_container_instance(self, name: str, display_name: str) -> CheckResult:
        """Check if a Container Instance exists."""
        success, output, error = self.run_command([
            "az", "container", "show",
            "--resource-group", self.resource_group,
            "--name", name,
            "-o", "json"
        ])
        
        if not success:
            return CheckResult(
                name=f"{display_name} Container",
                status=Status.FAIL,
                message=f"Container instance '{name}' does not exist",
                details=f"{display_name} needs to be deployed as a container instance",
                fix_command="cd /app/terraform/environments/production && terraform apply -target=module.compute",
                documentation=f"/app/config/{display_name.lower()}/README.md"
            )
        
        try:
            container = json.loads(output)
            state = container.get("instanceView", {}).get("state", "Unknown")
            
            if state != "Running":
                return CheckResult(
                    name=f"{display_name} Container",
                    status=Status.WARN,
                    message=f"{display_name} container exists but state is '{state}'",
                    details="Container may need to be started or is experiencing issues",
                    fix_command=f"az container restart --resource-group {self.resource_group} --name {name}"
                )
            
            return CheckResult(
                name=f"{display_name} Container",
                status=Status.PASS,
                message=f"{display_name} container is running",
                details=f"State: {state}"
            )
        except json.JSONDecodeError:
            return CheckResult(
                name=f"{display_name} Container",
                status=Status.WARN,
                message=f"{display_name} container exists but unable to parse details"
            )
    
    def check_app_gateway(self) -> CheckResult:
        """Check if Application Gateway exists."""
        agw_name = self.expected_resources["appgateway"]
        success, output, error = self.run_command([
            "az", "network", "application-gateway", "show",
            "--resource-group", self.resource_group,
            "--name", agw_name,
            "-o", "json"
        ])
        
        if not success:
            return CheckResult(
                name="Application Gateway",
                status=Status.FAIL,
                message=f"Application Gateway '{agw_name}' does not exist",
                details="Application Gateway is required for SSL termination and routing",
                fix_command="cd /app/terraform/environments/production && terraform apply -target=module.gateway",
                documentation="/app/docs/02-architecture/01-technical-design.md#application-gateway"
            )
        
        try:
            agw = json.loads(output)
            state = agw.get("operationalState", "Unknown")
            
            # Check for SSL certificate
            ssl_certs = agw.get("sslCertificates", [])
            
            if state != "Running":
                return CheckResult(
                    name="Application Gateway",
                    status=Status.WARN,
                    message=f"Application Gateway exists but state is '{state}'",
                    details="Gateway may be starting or experiencing issues"
                )
            
            if not ssl_certs:
                return CheckResult(
                    name="Application Gateway",
                    status=Status.WARN,
                    message="Application Gateway running but no SSL certificate configured",
                    details="HTTPS will not work without SSL certificates",
                    fix_command="Upload SSL certificate to Key Vault and configure in Application Gateway"
                )
            
            return CheckResult(
                name="Application Gateway",
                status=Status.PASS,
                message=f"Application Gateway '{agw_name}' is running",
                details=f"SSL Certificates: {len(ssl_certs)}"
            )
        except json.JSONDecodeError:
            return CheckResult(
                name="Application Gateway",
                status=Status.WARN,
                message="Application Gateway exists but unable to parse details"
            )
    
    def check_dns(self) -> CheckResult:
        """Check DNS configuration (basic check)."""
        domains = ["docs.nexamesh.ai", "ops.nexamesh.ai"]
        
        # This is a basic check - in reality you'd check Azure DNS or external DNS
        return CheckResult(
            name="DNS Configuration",
            status=Status.INFO,
            message="DNS configuration requires manual verification",
            details=f"Verify that {', '.join(domains)} point to Application Gateway IP",
            fix_command="Create A records pointing to Application Gateway public IP",
            documentation="/app/docs/03-deployment/01-deployment-guide.md#dns-configuration"
        )
    
    def check_ssl_certificates(self) -> CheckResult:
        """Check SSL certificate status."""
        kv_name = self.expected_resources["keyvault"]
        
        success, output, error = self.run_command([
            "az", "keyvault", "certificate", "list",
            "--vault-name", kv_name,
            "-o", "json"
        ])
        
        if not success:
            return CheckResult(
                name="SSL Certificates",
                status=Status.WARN,
                message="Unable to check SSL certificates",
                details="Key Vault may not exist or you may lack permissions",
                fix_command="Generate Let's Encrypt certificates and upload to Key Vault",
                documentation="/app/docs/03-deployment/01-deployment-guide.md#ssl-setup"
            )
        
        try:
            certs = json.loads(output)
            if not certs:
                return CheckResult(
                    name="SSL Certificates",
                    status=Status.FAIL,
                    message="No SSL certificates found in Key Vault",
                    details="SSL certificates are required for HTTPS",
                    fix_command="certbot certonly --standalone -d docs.nexamesh.ai -d ops.nexamesh.ai && az keyvault certificate import ...",
                    documentation="/app/docs/03-deployment/01-deployment-guide.md#ssl-setup"
                )
            
            return CheckResult(
                name="SSL Certificates",
                status=Status.PASS,
                message=f"Found {len(certs)} SSL certificate(s) in Key Vault",
                details=", ".join([c.get("name", "Unknown") for c in certs])
            )
        except json.JSONDecodeError:
            return CheckResult(
                name="SSL Certificates",
                status=Status.WARN,
                message="Unable to parse SSL certificate info"
            )
    
    def check_local_config(self) -> CheckResult:
        """Check if local configuration files exist."""
        required_files = [
            self.repo_root / "config" / "docker-compose.yml",
            self.repo_root / ".env.example",
            self.repo_root / "docs" / "04-configuration" / "01-docuseal-setup.md",
            self.repo_root / "docs" / "04-configuration" / "02-baserow-setup.md",
            self.repo_root / "config" / "scripts" / "seed-baserow.py"
        ]
        
        missing = [str(f.relative_to(self.repo_root)) for f in required_files if not f.exists()]
        
        if missing:
            return CheckResult(
                name="Local Configuration",
                status=Status.FAIL,
                message=f"Missing {len(missing)} configuration files",
                details=f"Missing: {', '.join(missing)}",
                fix_command="Run Phase 3 setup to create configuration files"
            )
        
        return CheckResult(
            name="Local Configuration",
            status=Status.PASS,
            message="All local configuration files present",
            details=f"Checked {len(required_files)} files"
        )
    
    def check_env_file(self) -> CheckResult:
        """Check if .env file exists and has required variables."""
        env_file = self.repo_root / ".env.local"
        template_file = self.repo_root / ".env.example"
        
        if not env_file.exists():
            return CheckResult(
                name="Environment File",
                status=Status.WARN,
                message=".env.local file not created",
                details="Local development can copy .env.example to .env.local; CI/CD should use GitHub secrets",
                fix_command="Copy .env.example to .env.local and fill in values"
            )
        
        # Check for placeholder values
        with open(env_file, 'r') as f:
            content = f.read()
        
        placeholders = ["CHANGE_ME", "YOUR_", "GENERATE_WITH"]
        has_placeholders = any(p in content for p in placeholders)
        
        if has_placeholders:
            return CheckResult(
                name="Environment File",
                status=Status.WARN,
                message=".env file exists but contains placeholder values",
                details="Replace all placeholder values with actual credentials",
                fix_command="Edit .env.local"
            )
        
        return CheckResult(
            name="Environment File",
            status=Status.PASS,
            message=".env file configured",
            details="All placeholder values replaced"
        )
    
    def run_all_checks(self, json_only: bool = False):
        """Run all deployment checks."""
        if not json_only:
            print("\n" + "=" * 70)
            print("🔍 House of Veritas - Azure Deployment Checklist")
            print("=" * 70)
            print(f"📅 Date: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
            print(f"🎯 Resource Group: {self.resource_group}")
            print(f"📍 Location: {self.location}")
            print("=" * 70 + "\n")

        # Category 1: Prerequisites
        prereqs = CheckCategory(
            name="Prerequisites",
            description="Required tools and authentication"
        )
        prereqs.checks.append(self.check_azure_cli())
        prereqs.checks.append(self.check_subscription())
        prereqs.checks.append(self.check_terraform())
        prereqs.checks.append(self.check_local_config())
        prereqs.checks.append(self.check_env_file())
        self.categories.append(prereqs)
        
        # Category 2: Azure Resources
        resources = CheckCategory(
            name="Azure Resources",
            description="Core infrastructure components"
        )
        resources.checks.append(self.check_resource_group())
        resources.checks.append(self.check_vnet())
        resources.checks.append(self.check_storage_account())
        resources.checks.append(self.check_key_vault())
        resources.checks.append(self.check_postgres())
        self.categories.append(resources)
        
        # Category 3: Application Services
        services = CheckCategory(
            name="Application Services",
            description="DocuSeal and Baserow containers"
        )
        if self.enable_operational_services:
            services.checks.append(self.check_container_instance(
                self.expected_resources["docuseal"], "DocuSeal"
            ))
            services.checks.append(self.check_container_instance(
                self.expected_resources["baserow"], "Baserow"
            ))
        else:
            services.checks.append(CheckResult(
                name="Operational Services",
                status=Status.SKIP,
                message="DocuSeal and Baserow containers are disabled for the low-usage canonical stack"
            ))
        self.categories.append(services)
        
        # Category 4: Networking & Security
        networking = CheckCategory(
            name="Networking & Security",
            description="Gateway, DNS, and SSL"
        )
        if self.enable_application_gateway:
            networking.checks.append(self.check_app_gateway())
            networking.checks.append(self.check_dns())
            networking.checks.append(self.check_ssl_certificates())
        else:
            networking.checks.append(CheckResult(
                name="Application Gateway",
                status=Status.SKIP,
                message="Application Gateway WAF is disabled for the low-usage canonical stack"
            ))
            networking.checks.append(CheckResult(
                name="DNS/SSL for Ops Services",
                status=Status.SKIP,
                message="docs/ops DNS and gateway SSL checks are skipped until operational services are enabled"
            ))
        self.categories.append(networking)

        if not json_only:
            self.print_results()
    
    def print_results(self):
        """Print formatted results."""
        total_passed = 0
        total_failed = 0
        total_warnings = 0
        
        for category in self.categories:
            print(f"\n📦 {category.name}")
            print(f"   {category.description}")
            print("-" * 60)
            
            for check in category.checks:
                print(f"  {check.status.value} {check.name}")
                print(f"      {check.message}")
                
                if self.verbose and check.details:
                    print(f"      📋 Details: {check.details}")
                
                if check.status == Status.FAIL and check.fix_command:
                    print(f"      🔧 Fix: {check.fix_command}")
                
                if check.status == Status.FAIL and check.documentation:
                    print(f"      📚 Docs: {check.documentation}")
            
            total_passed += category.passed
            total_failed += category.failed
            total_warnings += category.warnings
            
            print(f"\n   Summary: {category.passed} passed, {category.failed} failed, {category.warnings} warnings")
        
        # Overall summary
        print("\n" + "=" * 70)
        print("📊 OVERALL DEPLOYMENT STATUS")
        print("=" * 70)
        print(f"  ✅ Passed:   {total_passed}")
        print(f"  ❌ Failed:   {total_failed}")
        print(f"  ⚠️  Warnings: {total_warnings}")
        
        if total_failed == 0 and total_warnings == 0:
            print("\n🎉 All checks passed! Infrastructure is ready for deployment.")
        elif total_failed == 0:
            print("\n⚠️  Some warnings detected. Review and address if needed.")
        else:
            print(f"\n❌ {total_failed} critical issue(s) need to be resolved before deployment.")
        
        # Deployment steps
        print("\n" + "=" * 70)
        print("📋 DEPLOYMENT STEPS")
        print("=" * 70)
        
        steps = self.get_deployment_steps()
        for i, step in enumerate(steps, 1):
            status_icon = "✅" if step["complete"] else "⏳"
            print(f"  {status_icon} Step {i}: {step['name']}")
            if not step["complete"]:
                print(f"      Command: {step['command']}")
        
        print("\n" + "=" * 70)
    
    def get_deployment_steps(self) -> List[Dict]:
        """Get ordered deployment steps with status."""
        # Determine what's complete based on checks
        has_rg = any(
            c.status == Status.PASS 
            for cat in self.categories 
            for c in cat.checks 
            if c.name == "Resource Group"
        )
        has_vnet = any(
            c.status == Status.PASS 
            for cat in self.categories 
            for c in cat.checks 
            if c.name == "Virtual Network"
        )
        has_storage = any(
            c.status == Status.PASS 
            for cat in self.categories 
            for c in cat.checks 
            if c.name == "Storage Account"
        )
        has_keyvault = any(
            c.status == Status.PASS 
            for cat in self.categories 
            for c in cat.checks 
            if c.name == "Key Vault"
        )
        has_postgres = any(
            c.status == Status.PASS 
            for cat in self.categories 
            for c in cat.checks 
            if c.name == "PostgreSQL Server"
        )
        has_docuseal = any(
            c.status == Status.PASS 
            for cat in self.categories 
            for c in cat.checks 
            if "DocuSeal" in c.name
        )
        has_baserow = any(
            c.status == Status.PASS 
            for cat in self.categories 
            for c in cat.checks 
            if "Baserow" in c.name
        )
        has_gateway = any(
            c.status == Status.PASS 
            for cat in self.categories 
            for c in cat.checks 
            if c.name == "Application Gateway"
        )
        
        return [
            {
                "name": "Azure Login & Subscription",
                "complete": any(c.status == Status.PASS for cat in self.categories for c in cat.checks if c.name == "Azure CLI"),
                "command": "az login && az account set --subscription <subscription-id>"
            },
            {
                "name": "Create Resource Group",
                "complete": has_rg,
                "command": f"az group create --name {self.resource_group} --location {self.location}"
            },
            {
                "name": "Initialize Terraform",
                "complete": (self.repo_root / "terraform" / "environments" / "production" / ".terraform").exists(),
                "command": "cd /app/terraform/environments/production && terraform init"
            },
            {
                "name": "Deploy Network Infrastructure",
                "complete": has_vnet,
                "command": "terraform apply -target=module.network"
            },
            {
                "name": "Deploy Security (Key Vault)",
                "complete": has_keyvault,
                "command": "terraform apply -target=module.security"
            },
            {
                "name": "Deploy Storage Account",
                "complete": has_storage,
                "command": "terraform apply -target=module.storage"
            },
            {
                "name": "Deploy PostgreSQL Database",
                "complete": has_postgres,
                "command": "terraform apply -target=module.database"
            },
            {
                "name": "Deploy DocuSeal Container",
                "complete": has_docuseal,
                "command": "terraform apply -target=module.compute (docuseal)"
            },
            {
                "name": "Deploy Baserow Container",
                "complete": has_baserow,
                "command": "terraform apply -target=module.compute (baserow)"
            },
            {
                "name": "Deploy Application Gateway",
                "complete": has_gateway,
                "command": "terraform apply -target=module.gateway"
            },
            {
                "name": "Configure DNS Records",
                "complete": False,  # Manual step
                "command": "Create A records for docs.nexamesh.ai and ops.nexamesh.ai"
            },
            {
                "name": "Configure SSL Certificates",
                "complete": False,  # Requires manual check
                "command": "certbot certonly && az keyvault certificate import"
            },
            {
                "name": "Seed Initial Data",
                "complete": False,  # Post-deployment
                "command": "python /app/config/scripts/seed-baserow.py"
            },
            {
                "name": "Create User Accounts",
                "complete": False,  # Post-deployment
                "command": "See /app/docs/04-configuration/01-docuseal-setup.md and /app/docs/04-configuration/02-baserow-setup.md"
            }
        ]
    
    def to_json(self) -> str:
        """Export results as JSON."""
        results = {
            "timestamp": datetime.now().isoformat(),
            "resource_group": self.resource_group,
            "location": self.location,
            "categories": []
        }
        
        for category in self.categories:
            cat_data = {
                "name": category.name,
                "description": category.description,
                "passed": category.passed,
                "failed": category.failed,
                "warnings": category.warnings,
                "checks": []
            }
            
            for check in category.checks:
                cat_data["checks"].append({
                    "name": check.name,
                    "status": check.status.name,
                    "message": check.message,
                    "details": check.details,
                    "fix_command": check.fix_command,
                    "documentation": check.documentation
                })
            
            results["categories"].append(cat_data)
        
        results["deployment_steps"] = self.get_deployment_steps()
        
        return json.dumps(results, indent=2)


def main():
    """Main entry point."""
    import argparse
    
    parser = argparse.ArgumentParser(
        description="House of Veritas - Azure Deployment Checklist"
    )
    parser.add_argument(
        "--verbose", "-v",
        action="store_true",
        help="Show detailed output"
    )
    parser.add_argument(
        "--json", "-j",
        action="store_true",
        help="Output results as JSON only (no human-readable text)"
    )
    
    args = parser.parse_args()
    
    checker = DeploymentChecker(verbose=args.verbose)
    checker.run_all_checks(json_only=args.json)

    if args.json:
        print(checker.to_json())


if __name__ == "__main__":
    main()
