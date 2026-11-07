#!/bin/bash
# Hunter passive recon — free, no tokens, no API keys
# Usage: ./recon.sh domain.com
# Returns: SSL status, DMARC/SPF, MX records, tech stack hints

DOMAIN="$1"
if [ -z "$DOMAIN" ]; then echo "Usage: $0 domain.com"; exit 1; fi

echo "=== RECON: $DOMAIN ==="
echo ""

# SSL Certificate check
echo "--- SSL ---"
SSL_INFO=$(echo | timeout 5 openssl s_client -servername "$DOMAIN" -connect "$DOMAIN:443" 2>/dev/null)
if [ $? -eq 0 ]; then
  EXPIRY=$(echo "$SSL_INFO" | openssl x509 -noout -enddate 2>/dev/null | cut -d= -f2)
  ISSUER=$(echo "$SSL_INFO" | openssl x509 -noout -issuer 2>/dev/null | sed 's/.*O = //' | cut -d, -f1)
  if [ -n "$EXPIRY" ]; then
    EXPIRY_EPOCH=$(date -j -f "%b %d %H:%M:%S %Y %Z" "$EXPIRY" +%s 2>/dev/null || date -d "$EXPIRY" +%s 2>/dev/null)
    NOW_EPOCH=$(date +%s)
    DAYS_LEFT=$(( (EXPIRY_EPOCH - NOW_EPOCH) / 86400 ))
    if [ "$DAYS_LEFT" -lt 0 ]; then
      echo "EXPIRED $((DAYS_LEFT * -1)) days ago! Issuer: $ISSUER"
    elif [ "$DAYS_LEFT" -lt 30 ]; then
      echo "EXPIRING in ${DAYS_LEFT} days. Issuer: $ISSUER"
    else
      echo "OK — expires in ${DAYS_LEFT} days. Issuer: $ISSUER"
    fi
  fi
else
  echo "NO SSL or connection failed"
fi

# DMARC
echo ""
echo "--- DMARC ---"
DMARC=$(dig +short TXT "_dmarc.$DOMAIN" 2>/dev/null | head -1)
if [ -n "$DMARC" ]; then
  echo "$DMARC"
  if echo "$DMARC" | grep -q "p=none"; then
    echo "WEAK: policy=none (monitoring only, no protection)"
  elif echo "$DMARC" | grep -q "p=reject\|p=quarantine"; then
    echo "OK: enforced"
  fi
else
  echo "MISSING — no DMARC record (email spoofing possible)"
fi

# SPF
echo ""
echo "--- SPF ---"
SPF=$(dig +short TXT "$DOMAIN" 2>/dev/null | grep "v=spf" | head -1)
if [ -n "$SPF" ]; then
  echo "$SPF"
  if echo "$SPF" | grep -q "+all"; then
    echo "DANGEROUS: +all allows anyone to send as $DOMAIN"
  elif echo "$SPF" | grep -q "~all"; then
    echo "WEAK: softfail (~all)"
  fi
else
  echo "MISSING — no SPF record"
fi

# MX Records (email provider hint)
echo ""
echo "--- MX (email provider) ---"
dig +short MX "$DOMAIN" 2>/dev/null | sort -n | head -3
MX=$(dig +short MX "$DOMAIN" 2>/dev/null | head -1)
if echo "$MX" | grep -qi "google\|gmail"; then echo "→ Google Workspace";
elif echo "$MX" | grep -qi "outlook\|microsoft"; then echo "→ Microsoft 365";
elif echo "$MX" | grep -qi "proton"; then echo "→ ProtonMail";
elif echo "$MX" | grep -qi "ionos\|1and1"; then echo "→ IONOS";
elif [ -z "$MX" ]; then echo "NO MX — no email configured";
fi

# HTTP headers (tech stack hints)
echo ""
echo "--- Tech Stack ---"
HEADERS=$(curl -sI "https://$DOMAIN" --connect-timeout 5 --max-time 10 2>/dev/null)
if [ -n "$HEADERS" ]; then
  SERVER=$(echo "$HEADERS" | grep -i "^server:" | head -1)
  POWERED=$(echo "$HEADERS" | grep -i "^x-powered-by:" | head -1)
  GENERATOR=$(curl -s "https://$DOMAIN" --connect-timeout 5 --max-time 10 2>/dev/null | grep -oi 'content="WordPress[^"]*"' | head -1)
  [ -n "$SERVER" ] && echo "$SERVER"
  [ -n "$POWERED" ] && echo "$POWERED"
  [ -n "$GENERATOR" ] && echo "CMS: $GENERATOR"
  if echo "$GENERATOR" | grep -qi "wordpress [0-5]\.\|wordpress 6\.[0-3]"; then
    echo "OUTDATED WordPress!"
  fi
else
  echo "Site unreachable"
fi

echo ""
echo "=== END RECON ==="
