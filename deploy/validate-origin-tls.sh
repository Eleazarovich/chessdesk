#!/bin/bash
set -euo pipefail

tls_dir="${1:?TLS directory is required}"
origin_name="${2:?Origin hostname is required}"

if ! command -v openssl >/dev/null 2>&1; then
  echo "Install the openssl command on the origin host before deployment." >&2
  exit 1
fi
if [[ ! -r "$tls_dir/fullchain.pem" || ! -r "$tls_dir/privkey.pem" ]]; then
  echo "Install the trusted origin certificate and key in $tls_dir before deployment. See deploy/README.md." >&2
  exit 1
fi

# x509 -checkhost reports mismatches without a failing exit status. verify
# checks the hostname AND the chain against the host's trusted CA store.
openssl verify -purpose sslserver -verify_hostname "$origin_name" \
  -untrusted "$tls_dir/fullchain.pem" "$tls_dir/fullchain.pem"
openssl x509 -in "$tls_dir/fullchain.pem" -noout -checkend 86400
certificate_key="$(openssl x509 -in "$tls_dir/fullchain.pem" -pubkey -noout | openssl pkey -pubin -outform DER | sha256sum)"
private_key="$(openssl pkey -in "$tls_dir/privkey.pem" -pubout -outform DER | sha256sum)"
if [[ "$certificate_key" != "$private_key" ]]; then
  echo "The origin certificate and private key do not match." >&2
  exit 1
fi
