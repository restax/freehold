#!/bin/sh
# Generates a self-signed PKCS#12 signing certificate for a LOCAL/DEV
# Documenso instance (Documenso stamps signed PDFs with it). Do not use a
# self-signed cert for real closings — buy a document-signing certificate.
set -e
cd "$(dirname "$0")"

openssl genrsa -out key.pem 2048
openssl req -new -x509 -key key.pem -out cert.pem -days 3650 \
  -subj "/CN=Freehold Dev Signing"
openssl pkcs12 -export -out cert.p12 -inkey key.pem -in cert.pem \
  -passout pass:freehold-dev
rm key.pem cert.pem
echo "wrote $(pwd)/cert.p12 (passphrase: freehold-dev)"
