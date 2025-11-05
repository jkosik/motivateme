#!/bin/bash
# Deployment script for MotivateMe with cert-manager and Let's Encrypt
# This script installs everything in the correct order

set -e

echo "=========================================="
echo "MotivateMe Deployment Script"
echo "=========================================="
echo ""

# Check if kubectl is available
if ! command -v kubectl &> /dev/null; then
    echo "❌ kubectl not found. Please install kubectl first."
    exit 1
fi

# Check if cluster is accessible
if ! kubectl cluster-info &> /dev/null; then
    echo "❌ Cannot connect to Kubernetes cluster."
    echo "   Make sure your kubeconfig is configured correctly."
    exit 1
fi

echo "✅ kubectl is configured and cluster is accessible"
echo ""

# Step 1: Install cert-manager
echo "=========================================="
echo "Step 1: Installing cert-manager..."
echo "=========================================="
echo ""

CERT_MANAGER_VERSION="v1.16.2"

if kubectl get namespace cert-manager &> /dev/null; then
    echo "⚠️  cert-manager namespace already exists. Skipping installation."
else
    echo "📦 Installing cert-manager $CERT_MANAGER_VERSION..."
    kubectl apply -f https://github.com/cert-manager/cert-manager/releases/download/$CERT_MANAGER_VERSION/cert-manager.yaml

    echo ""
    echo "⏳ Waiting for cert-manager to be ready (max 5 minutes)..."
    kubectl wait --for=condition=Available --timeout=300s deployment/cert-manager -n cert-manager
    kubectl wait --for=condition=Available --timeout=300s deployment/cert-manager-webhook -n cert-manager
    kubectl wait --for=condition=Available --timeout=300s deployment/cert-manager-cainjector -n cert-manager

    echo "✅ cert-manager is ready"
fi

echo ""

# Step 2: Create Let's Encrypt ClusterIssuers
echo "=========================================="
echo "Step 2: Creating Let's Encrypt issuers..."
echo "=========================================="
echo ""

if ! grep -q "your-email@example.com" 01-letsencrypt-issuer.yaml; then
    echo "✅ Email address configured in issuer manifest"
else
    echo "⚠️  WARNING: Update email address in 01-letsencrypt-issuer.yaml"
    echo "   Current: your-email@example.com"
    echo ""
    read -p "Continue anyway? (y/n) " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        echo "❌ Deployment cancelled. Please update the email address first."
        exit 1
    fi
fi

echo "📝 Creating ClusterIssuers (staging and production)..."
kubectl apply -f 01-letsencrypt-issuer.yaml

echo "✅ ClusterIssuers created"
echo ""

# Step 3: Deploy MotivateMe application
echo "=========================================="
echo "Step 3: Deploying MotivateMe application..."
echo "=========================================="
echo ""

if ! grep -q "motivateme.yourdomain.com" k8s-deployment.yaml; then
    echo "✅ Domain configured in deployment manifest"
else
    echo "⚠️  WARNING: Update domain in k8s-deployment.yaml"
    echo "   Current: motivateme.yourdomain.com"
    echo ""
    read -p "Continue anyway? (y/n) " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        echo "❌ Deployment cancelled. Please update the domain first."
        exit 1
    fi
fi

echo "🚀 Deploying MotivateMe..."
kubectl apply -f k8s-deployment.yaml

echo ""
echo "⏳ Waiting for deployment to be ready..."
kubectl wait --for=condition=Available --timeout=300s deployment/motivateme -n motivateme

echo "✅ MotivateMe deployed successfully"
echo ""

# Step 4: Check certificate status
echo "=========================================="
echo "Step 4: Checking certificate status..."
echo "=========================================="
echo ""

echo "⏳ Waiting 10 seconds for cert-manager to process the ingress..."
sleep 10

echo ""
echo "📜 Certificate status:"
kubectl get certificate -n motivateme

echo ""
echo "📝 Certificate details:"
kubectl describe certificate -n motivateme | grep -A 10 "Status:"

echo ""
echo "=========================================="
echo "🎉 Deployment Complete!"
echo "=========================================="
echo ""
echo "Next steps:"
echo ""
echo "1. Check ingress:"
echo "   kubectl get ingress -n motivateme"
echo ""
echo "2. Monitor certificate issuance (takes 1-2 minutes):"
echo "   kubectl get certificate -n motivateme -w"
echo ""
echo "3. View cert-manager logs if there are issues:"
echo "   kubectl logs -n cert-manager -l app=cert-manager --tail=50 -f"
echo ""
echo "4. Test your site:"
echo "   curl -I https://your-domain.com"
echo "   # Or visit in browser"
echo ""
echo "5. Check certificate expiry:"
echo "   kubectl get certificate -n motivateme -o wide"
echo ""
echo "Note: Let's Encrypt certificates are valid for 90 days."
echo "      cert-manager will automatically renew them."
echo ""

