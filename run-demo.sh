#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ECOM_PID=""
PETSTORE_PID=""

print_step() {
  printf "\n==> %s\n" "$1"
}

ensure_deps() {
  local project_dir="$1"
  if [[ ! -d "${project_dir}/node_modules" ]]; then
    print_step "Installing dependencies in $(basename "${project_dir}")"
    (cd "${project_dir}" && npm install)
  fi
}

wait_for_server() {
  local url="$1"
  local attempts="$2"
  local label="$3"
  if command -v curl >/dev/null 2>&1; then
    for _ in $(seq 1 "$attempts"); do
      if curl -sSf "$url" >/dev/null; then
        return 0
      fi
      sleep 0.5
    done
  else
    sleep 2
  fi
  if [[ -n "$label" && -f "$label" ]]; then
    echo "Last 20 lines of $(basename "$label")"
    tail -n 20 "$label" || true
  fi
  return 1
}

cleanup() {
  if [[ -n "${ECOM_PID}" ]]; then
    kill "${ECOM_PID}" >/dev/null 2>&1 || true
  fi
  if [[ -n "${PETSTORE_PID}" ]]; then
    kill "${PETSTORE_PID}" >/dev/null 2>&1 || true
  fi
}

trap cleanup EXIT

print_step "Why this script exists"
cat <<'EOF'
This demo runs the StrawBerry-REST pipeline end-to-end:
1) Build/type-check both projects.
2) Analyze OpenAPI specs to infer dependencies (static analysis).
3) Start sample REST services and run refinement to verify dependencies at runtime.
EOF

ensure_deps "${ROOT_DIR}/strawberry-rest"
ensure_deps "${ROOT_DIR}/rest-mini-e-commerce"

print_step "Build (type-check)"
(cd "${ROOT_DIR}/strawberry-rest" && npm run build)
(cd "${ROOT_DIR}/rest-mini-e-commerce" && npm run build)

print_step "Static analysis: infer dependencies from OpenAPI (e-commerce)"
(cd "${ROOT_DIR}/strawberry-rest" && npm run analyze -- --spec ../rest-mini-e-commerce/openapi.yaml)

print_step "Start e-commerce REST service"
(
  cd "${ROOT_DIR}/rest-mini-e-commerce"
  npm run dev >"${ROOT_DIR}/.tmp-rest-server.log" 2>&1 &
  echo $! >"${ROOT_DIR}/.tmp-rest-server.pid"
)
ECOM_PID="$(cat "${ROOT_DIR}/.tmp-rest-server.pid")"

if ! wait_for_server "http://localhost:3000/health" 20 "${ROOT_DIR}/.tmp-rest-server.log"; then
  echo "E-commerce service did not become ready. Check .tmp-rest-server.log"
  exit 1
fi

print_step "Runtime refinement: verify inferred dependencies (e-commerce)"
(cd "${ROOT_DIR}/strawberry-rest" && npm run refine -- --spec ../rest-mini-e-commerce/openapi.yaml --base http://localhost:3000)

print_step "Static analysis: infer dependencies from OpenAPI (petstore)"
(cd "${ROOT_DIR}/strawberry-rest" && npm run analyze -- --spec ../third-party/src/main/resources/openapi.yaml)

print_step "Starting Petstore REST service..."
(
  cd "${ROOT_DIR}/third-party"
  mvn package jetty:run >"${ROOT_DIR}/.tmp-petstore.log" 2>&1 &
  echo $! >"${ROOT_DIR}/.tmp-petstore.pid"
)
PETSTORE_PID="$(cat "${ROOT_DIR}/.tmp-petstore.pid")"

if ! wait_for_server "http://localhost:8080/api/v3/openapi.json" 160 "${ROOT_DIR}/.tmp-petstore.log"; then
  echo "Petstore service did not become ready. Check .tmp-petstore.log"
  exit 1
fi

print_step "Runtime refinement: verify inferred dependencies (petstore)"
if ! (cd "${ROOT_DIR}/strawberry-rest" && npm run refine -- --spec ../third-party/src/main/resources/openapi.yaml --base http://localhost:8080); then
  echo "Petstore refinement failed. This is expected if the API does not provide input examples for all endpoints."
fi

print_step "Outputs"
cat <<'EOF'
See reports in strawberry-rest/output/<app>-<timestamp>:
- dependencies.json (full data)
- summary.md (human-readable summary with confidence and verification)
EOF
