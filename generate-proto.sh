#!/bin/bash

# Colors for output
GREEN='\033[0;32m'
BLUE='\033[0;34m'
RED='\033[0;31m'
NC='\033[0m' # No Color

echo -e "${BLUE}Generating gRPC files...${NC}"

# Generate Go files for the av-scanner-service
echo -e "${GREEN}Generating Go files...${NC}"
protoc -I../av-scanner-service/proto \
    --go_out=av-scanner-service \
    --go_opt=paths=source_relative \
    --go-grpc_out=av-scanner-service \
    --go-grpc_opt=paths=source_relative \
    ../av-scanner-service/proto/av_scanner.proto

# Generate TypeScript files for the client using @protobuf-ts/plugin
echo -e "${GREEN}Generating TypeScript files for client...${NC}"
protoc -I../av-scanner-service/proto \
    --ts_out="client_generic":client/src/proto \
    ../av-scanner-service/proto/av_scanner.proto

echo -e "${BLUE}Done!${NC}" 