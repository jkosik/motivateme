#!/bin/bash
# Certificate verification script for MotivateMe
# Checks Let's Encrypt certificate status and troubleshoots issues

set -e

NAMESPACE="motivateme"

echo "=========================================="
echo "Certificate Status Check"
echo "=========================================="
echo ""

# Check if kubectl is available
if ! command -v kubectl &> /dev/null; then
    echo "❌ kubectl not found"
    exit 1
fi

# Check if namespace exists
if ! kubectl get namespace $NAMESPACE &> /dev/null; then
    echo "❌ Namespace $NAMESPACE does not exist"
    echo "   Run: kubectl apply -f k8s-deployment.yaml"
    exit 1
fi

echo "📋 Checking components..."
echo ""

# Check cert-manager
echo "1️⃣  cert-manager pods:"
kubectl get pods -n cert-manager
echo ""

# Check ClusterIssuers
echo "2️⃣  ClusterIssuers:"
kubectl get clusterissuer
echo ""

# Check Certificate
echo "3️⃣  Certificate:"
if kubectl get certificate -n $NAMESPACE &> /dev/null; then
    kubectl get certificate -n $NAMESPACE
    echo ""

    CERT_NAME=$(kubectl get certificate -n $NAMESPACE -o jsonpath='{.items[0].metadata.name}')

    echo "4️⃣  Certificate details for: $CERT_NAME"
    kubectl describe certificate $CERT_NAME -n $NAMESPACE | grep -A 15 "Status:"
    echo ""
else
    echo "❌ No certificate found in namespace $NAMESPACE"
    echo "   Check if ingress has cert-manager.io/cluster-issuer annotation"
    echo ""
fi

# Check CertificateRequest
echo "5️⃣  CertificateRequest:"
kubectl get certificaterequest -n $NAMESPACE
echo ""

# Check Order (ACME challenge)
echo "6️⃣  ACME Order:"
kubectl get order -n $NAMESPACE 2>/dev/null || echo "No orders found (expected after certificate is issued)"
echo ""

# Check Challenge
echo "7️⃣  ACME Challenge:"
kubectl get challenge -n $NAMESPACE 2>/dev/null || echo "No challenges found (expected after certificate is issued)"
echo ""

# Check Ingress
echo "8️⃣  Ingress:"
kubectl get ingress -n $NAMESPACE
echo ""

echo "9️⃣  Ingress annotations:"
kubectl get ingress -n $NAMESPACE -o jsonpath='{.items[0].metadata.annotations}' | jq .
echo ""

# Check Secret (contains the TLS certificate)
echo "🔟 TLS Secret:"
SECRET_NAME=$(kubectl get ingress -n $NAMESPACE -o jsonpath='{.items[0].spec.tls[0].secretName}')
if kubectl get secret $SECRET_NAME -n $NAMESPACE &> /dev/null; then
    echo "✅ Secret $SECRET_NAME exists"
    kubectl get secret $SECRET_NAME -n $NAMESPACE
    echo ""

    # Show certificate details
    echo "📜 Certificate details:"
    kubectl get secret $SECRET_NAME -n $NAMESPACE -o jsonpath='{.data.tls\.crt}' | base64 -d | openssl x509 -noout -text | grep -A 5 "Subject:\|Issuer:\|Validity"
    echo ""
else
    echo "❌ Secret $SECRET_NAME does not exist yet"
    echo "   Certificate is still being issued..."
    echo ""
fi

echo "=========================================="
echo "📝 Summary"
echo "=========================================="
echo ""

# Determine overall status
CERT_READY=$(kubectl get certificate -n $NAMESPACE -o jsonpath='{.items[0].status.conditions[?(@.type=="Ready")].status}' 2>/dev/null || echo "Unknown")

if [ "$CERT_READY" == "True" ]; then
    echo "✅ Certificate is READY and valid"
    echo ""
    echo "Next steps:"
    echo "  • Test: curl -I https://your-domain.com"
    echo "  • Check browser: https://your-domain.com"
    echo "  • Verify certificate: echo | openssl s_client -connect your-domain.com:443 -servername your-domain.com 2>/dev/null | openssl x509 -noout -issuer -dates"
elif [ "$CERT_READY" == "False" ]; then
    echo "⚠️  Certificate is NOT ready yet"
    echo ""
    echo "Common issues:"
    echo ""
    echo "1. DNS not pointing to your server"
    echo "   • Check: dig +short your-domain.com"
    echo "   • Should return your server's public IP"
    echo ""
    echo "2. Firewall blocking port 80 (needed for HTTP-01 challenge)"
    echo "   • Check: curl -I http://your-domain.com/.well-known/acme-challenge/test"
    echo "   • Should be accessible from the internet"
    echo ""
    echo "3. Ingress not properly configured"
    echo "   • Check annotations: kubectl describe ingress -n $NAMESPACE"
    echo ""
    echo "4. cert-manager logs show errors"
    echo "   • Check: kubectl logs -n cert-manager -l app=cert-manager --tail=50"
    echo ""
    echo "Troubleshooting:"
    echo "  kubectl describe certificate -n $NAMESPACE"
    echo "  kubectl describe certificaterequest -n $NAMESPACE"
    echo "  kubectl describe order -n $NAMESPACE"
    echo "  kubectl describe challenge -n $NAMESPACE"
    echo "  kubectl logs -n cert-manager -l app=cert-manager --tail=100"
else
    echo "❓ Certificate status unknown"
    echo "   Check if certificate resource exists:"
    echo "   kubectl get certificate -n $NAMESPACE"
fi

echo ""

