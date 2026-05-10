# Backend configuration for Terraform state
# Use this file with: terraform init -backend-config="backend.hcl"

resource_group_name  = "hov-shared-tfstate-rg"
storage_account_name = "hovsharedtfstatesa"
container_name       = "tfstate"
key                  = "production.terraform.tfstate"
