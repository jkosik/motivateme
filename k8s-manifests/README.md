# Kubernetes Manifests

Kubernetes deployment manifests for MotivateMe with automatic Let's Encrypt TLS certificates.

## Quick Start

### Prerequisites

1. K3s cluster deployed (see `../ansible/`)
2. Domain name pointing to your server's public IP
3. kubectl configured to access your cluster

### Deploy

```bash
cd k8s-manifests/

# 1. Update configuration
vim 01-letsencrypt-issuer.yaml  # Change email address
vim k8s-deployment.yaml          # Change domain name

# 2. Run deployment script
./deploy.sh

# 3. Monitor certificate issuance (takes 1-2 minutes)
kubectl get certificate -n motivateme -w

# 4. Check status
./check-cert.sh
```

## Files

| File | Purpose |
|------|---------|
| `00-cert-manager.yaml` | cert-manager installation instructions |
| `01-letsencrypt-issuer.yaml` | Let's Encrypt ClusterIssuers (staging + prod) |
| `k8s-deployment.yaml` | MotivateMe app deployment + ingress |
| `deploy.sh` | Automated deployment script |
| `check-cert.sh` | Certificate status verification |

## Manual Deployment

If you prefer to deploy manually:

```bash
# 1. Install cert-manager
kubectl apply -f https://github.com/cert-manager/cert-manager/releases/download/v1.16.2/cert-manager.yaml

# Wait for cert-manager to be ready
kubectl wait --for=condition=Available --timeout=300s deployment/cert-manager -n cert-manager

# 2. Create Let's Encrypt issuers
kubectl apply -f 01-letsencrypt-issuer.yaml

# 3. Deploy MotivateMe
kubectl apply -f k8s-deployment.yaml
```

## Configuration

### Email Address

Update in `01-letsencrypt-issuer.yaml`:

```yaml
email: your-email@example.com  # Change this
```

### Domain Name

Update in `k8s-deployment.yaml`:

```yaml
spec:
  tls:
  - hosts:
    - motivateme.yourdomain.com  # Change this
```

### Use Staging Issuer First (Recommended)

To avoid Let's Encrypt rate limits, test with staging first:

```yaml
# In k8s-deployment.yaml, change:
cert-manager.io/cluster-issuer: letsencrypt-staging
```

Once working, switch to production:

```yaml
cert-manager.io/cluster-issuer: letsencrypt-prod
```

## Verification

### Check Certificate Status

```bash
./check-cert.sh
```

Or manually:

```bash
# Certificate resource
kubectl get certificate -n motivateme
kubectl describe certificate -n motivateme

# Secret (contains TLS cert)
kubectl get secret motivateme-tls -n motivateme

# Ingress
kubectl get ingress -n motivateme

# cert-manager logs
kubectl logs -n cert-manager -l app=cert-manager --tail=50 -f
```

### Test Certificate

```bash
# Check certificate details
echo | openssl s_client -connect your-domain.com:443 -servername your-domain.com 2>/dev/null | openssl x509 -noout -text

# Check issuer (should be "Let's Encrypt")
curl -I https://your-domain.com
```

## Troubleshooting

### Certificate Not Issuing

1. **Check DNS:**
   ```bash
   dig +short your-domain.com
   # Should return your server's public IP
   ```

2. **Check HTTP-01 Challenge:**
   ```bash
   kubectl get challenge -n motivateme
   kubectl describe challenge -n motivateme
   ```

3. **Check Firewall:**
   ```bash
   # Port 80 must be accessible for ACME challenge
   curl -I http://your-domain.com/.well-known/acme-challenge/test
   ```

4. **Check cert-manager Logs:**
   ```bash
   kubectl logs -n cert-manager -l app=cert-manager --tail=100
   ```

### Staging Certificate Warning

If you used `letsencrypt-staging`, browsers will show a warning:
- Certificate is from "Fake LE Intermediate X1"
- This is expected for staging
- Switch to `letsencrypt-prod` for trusted certificates

### Rate Limits

Let's Encrypt has rate limits:
- **50 certificates per domain per week**
- **5 duplicate certificates per week**

Always test with staging issuer first!

### Delete and Recreate Certificate

```bash
# Delete certificate and secret
kubectl delete certificate motivateme-tls -n motivateme
kubectl delete secret motivateme-tls -n motivateme

# cert-manager will automatically recreate them
# Monitor progress:
kubectl get certificate -n motivateme -w
```

## Certificate Renewal

cert-manager automatically renews certificates:
- Renewal starts 30 days before expiry
- Let's Encrypt certificates are valid for 90 days
- No manual intervention needed

Check renewal status:

```bash
kubectl get certificate -n motivateme -o wide
```

## Updating the Application

To update the app after code changes:

```bash
# GitHub Actions builds new image automatically
# Then restart deployment to pull latest:
kubectl rollout restart deployment/motivateme -n motivateme

# Or update to specific version:
kubectl set image deployment/motivateme motivateme=ghcr.io/jkosik/motivateme:1.0.0 -n motivateme
```

Certificate remains valid during app updates.

## Uninstall

```bash
# Remove MotivateMe
kubectl delete -f k8s-deployment.yaml

# Remove cert-manager (optional)
kubectl delete -f https://github.com/cert-manager/cert-manager/releases/download/v1.16.2/cert-manager.yaml
```

## Resources

- [cert-manager Documentation](https://cert-manager.io/docs/)
- [Let's Encrypt Rate Limits](https://letsencrypt.org/docs/rate-limits/)
- [Traefik Ingress Documentation](https://doc.traefik.io/traefik/providers/kubernetes-ingress/)

