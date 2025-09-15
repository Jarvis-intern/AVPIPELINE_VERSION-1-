#!/bin/bash
set -e

PROTO_DIR=$(dirname "$0")
cd "$PROTO_DIR"

PROTOC_GEN_GO_FLAGS="--go_out=paths=source_relative:. --go-grpc_out=paths=source_relative:."

for proto in *.proto; do
  echo "Generating Go files for $proto..."
  protoc $PROTOC_GEN_GO_FLAGS "$proto"
  echo "Done: $proto"
done

echo "All proto files generated successfully." 