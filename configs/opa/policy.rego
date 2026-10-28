package openpalantir

import rego.v1

# Deny by default. Input must come from a trusted authentication/authorization layer.
default allow := false

allow if {
  input.principal.active == true
  input.principal.tenant_id == input.resource.tenant_id
  input.action in input.principal.permissions
}
