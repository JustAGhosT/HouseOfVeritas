# HOV target edge binding

This root is intentionally limited to the App Service custom-hostname binding,
managed certificate and SNI certificate binding for `hov.neuralliquid.ai`.
It reads the target runtime state and cannot manage Cloudflare, Mystira OIDC,
the source runtime, source DNS records or source Terraform state.

The default plan is inert because `hostname_binding_approved=false`. Before an
operator enables it, all of the following must be completed and evidenced:

1. Publish Azure's domain-verification record through the separately managed
   Cloudflare account without changing production routing.
2. Verify the target Azure hostname, data plane and restart persistence.
3. Coordinate the Mystira relying-party registration, redirect URI, issuer and
   client-secret rotation as one external transaction.
4. Lower TTL and capture the exact source CNAME rollback value, then generate
   and approve a sealed edge plan with both external preconditions attested.
5. In the maintenance window, move the CNAME directly to the target App Service
   before applying the edge plan. App Service managed-certificate issuance and
   renewal require that direct mapping.
6. Apply the exact edge plan, verify certificate issuance/SNI and complete
   authentic acceptance. Restore the captured source CNAME immediately if
   issuance or acceptance fails.

Source retirement is not represented in this root. A DNS rollback does not
require destroying the target hostname or certificate resources.
