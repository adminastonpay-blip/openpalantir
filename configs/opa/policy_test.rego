package openpalantir

import rego.v1

test_deny_by_default if {
  not allow with input as {}
}
test_allow_same_tenant_with_permission if {
  allow with input as {
    "principal": {"active": true, "tenant_id": "tenant-a", "permissions": ["ontology:read"]},
    "resource": {"tenant_id": "tenant-a"},
    "action": "ontology:read"
  }
}
test_deny_cross_tenant if {
  not allow with input as {
    "principal": {"active": true, "tenant_id": "tenant-a", "permissions": ["ontology:read"]},
    "resource": {"tenant_id": "tenant-b"},
    "action": "ontology:read"
  }
}
test_deny_missing_permission if {
  not allow with input as {
    "principal": {"active": true, "tenant_id": "tenant-a", "permissions": []},
    "resource": {"tenant_id": "tenant-a"},
    "action": "ontology:read"
  }
}
