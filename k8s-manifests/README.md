# Kubernetes Manifests

Kubernetes deployment manifests for MotivateMe with automatic Let's Encrypt TLS certificates.

```bash
# 1. Install cert-manager
kubectl create namespace cert-manager
kubectl apply -f https://github.com/cert-manager/cert-manager/releases/download/v1.16.2/cert-manager.yaml

# Wait for cert-manager to be ready
kubectl wait --for=condition=Available --timeout=300s deployment/cert-manager -n cert-manager

# 2. Create Let's Encrypt issuers
kubectl apply -f 01-letsencrypt-issuer.yaml

# 3. Deploy MotivateMe
kubectl apply -f 02-motivateme.yaml
```

