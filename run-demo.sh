#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SERVER_PID=""

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
  if command -v curl >/dev/null 2>&1; then
    for _ in {1..20}; do
      if curl -sSf "http://localhost:3000/health" >/dev/null; then
        return 0
      fi
      sleep 0.5
    done
  else
    sleep 2
  fi
  return 1
}

cleanup() {
  if [[ -n "${SERVER_PID}" ]]; then
    kill "${SERVER_PID}" >/dev/null 2>&1 || true
  fi
}

trap cleanup EXIT

print_step "Why this script exists"
cat <<'EOF'
This demo runs the StrawBerry-REST pipeline end-to-end:
1) Build/type-check both projects.
2) Analyze the OpenAPI spec to infer dependencies (static analysis).
3) Start the sample REST service and run refinement to verify dependencies at runtime.
EOF

ensure_deps "${ROOT_DIR}/strawberry-rest"
ensure_deps "${ROOT_DIR}/rest-mini-e-commerce"

print_step "Build (type-check)"
(cd "${ROOT_DIR}/strawberry-rest" && npm run build)
(cd "${ROOT_DIR}/rest-mini-e-commerce" && npm run build)

print_step "Static analysis: infer dependencies from OpenAPI"
(cd "${ROOT_DIR}/strawberry-rest" && npm run analyze -- --spec ../rest-mini-e-commerce/openapi.yaml)

print_step "Start sample REST service"
(
  cd "${ROOT_DIR}/rest-mini-e-commerce"
  npm run dev >"${ROOT_DIR}/.tmp-rest-server.log" 2>&1 &
  echo $! >"${ROOT_DIR}/.tmp-rest-server.pid"
)
SERVER_PID="$(cat "${ROOT_DIR}/.tmp-rest-server.pid")"

if ! wait_for_server; then
  echo "Service did not become ready. Check .tmp-rest-server.log"
  exit 1
fi

print_step "Runtime refinement: verify inferred dependencies"
(cd "${ROOT_DIR}/strawberry-rest" && npm run refine -- --spec ../rest-mini-e-commerce/openapi.yaml --base http://localhost:3000)

print_step "Outputs"
cat <<'EOF'
See reports in strawberry-rest/output:
- dependencies.json (full data)
- summary.md (human-readable summary with confidence and verification)
EOF
