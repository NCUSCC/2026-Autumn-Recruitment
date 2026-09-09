# Infrastructure deployment baseline

This directory contains the immutable profile contract and Kubernetes policy baseline described by `docs/design/infrastructure-design.md`.

The manifests are intentionally platform-only: they do not include participant content, secrets, host paths, or floating image tags. Apply them to a staging cluster after replacing the controller image references and setting the cluster's Kata `RuntimeClass`.

The TypeScript implementation in `src/infrastructure/` is the transport-neutral control-plane reference used by local tests. PostgreSQL, object storage, Kubernetes clients, and a real PTY connector can replace the in-memory implementations behind the exported interfaces.
