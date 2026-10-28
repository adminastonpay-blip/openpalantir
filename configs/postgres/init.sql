-- OpenPalantir multi-database init
CREATE DATABASE keycloak;
CREATE DATABASE ontology;
CREATE DATABASE superset;
CREATE DATABASE openmetadata;

GRANT ALL PRIVILEGES ON DATABASE keycloak TO openpalantir;
GRANT ALL PRIVILEGES ON DATABASE ontology TO openpalantir;
GRANT ALL PRIVILEGES ON DATABASE superset TO openpalantir;
GRANT ALL PRIVILEGES ON DATABASE openmetadata TO openpalantir;
