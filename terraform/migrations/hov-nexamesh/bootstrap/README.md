# HOV NexaMesh target backend bootstrap

This root creates a new backend in the approved Celladore Systems tenant and
`nexamesh-sub`. It never reads, copies, imports, or repoints an existing state.

The backend has a deliberate chicken-and-egg sequence:

1. Copy no credentials into this directory. Supply the bounded
   `backend_allowed_ip_cidrs` variable out of band.
2. Initialize with `terraform init -backend=false` and review a saved plan.
3. Apply that exact reviewed bootstrap plan only through the authorized
   migration workflow.
4. Wait for the deployer `Storage Blob Data Owner` assignment to propagate.
5. Copy `backend.hcl.example` to an ignored temporary path and run
   `terraform init -migrate-state -backend-config=<temporary-backend-file>`.
6. Confirm the local state was migrated to `hov/prod/bootstrap.tfstate`, then
   securely remove any local state artifacts.

All later roots use Azure AD backend authentication and separate state keys.
Do not enable storage account keys, widen the firewall to the internet, or use
the bootstrap state for application resources.
