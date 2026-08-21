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
5. Approve a maximum ten-minute TLS interruption window, identify the rollback
   operator, and continuously monitor public DNS plus both Azure hostnames. This
   edge root supports only the App Service managed-certificate path.
6. In the maintenance window, move the CNAME directly to the target App Service
   in Cloudflare DNS-only mode with CNAME flattening disabled. Start the
   interruption timer, then verify independent public resolvers expose the
   target `azurewebsites.net` CNAME directly before applying the edge plan.
   Retain DNS-only/unflattened mode for managed-certificate renewal.
7. Apply the exact edge plan, verify certificate issuance/SNI and complete
   authentic acceptance. Restore the captured source CNAME immediately if
   issuance or acceptance fails or the interruption deadline is reached, then
   verify source TLS before ending the incident watch.

Source retirement is not represented in this root. A DNS rollback does not
require destroying the target hostname or certificate resources.
