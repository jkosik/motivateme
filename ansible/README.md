# K3s Deployment with Ansible

Automated K3s deployment using the official [k3s-ansible collection](https://github.com/k3s-io/k3s-ansible) with custom security hardening for production use on Ubuntu 24.04.

## Install
```bash
cd ansible/
ansible-galaxy collection install -r requirements.yml
ansible-playbook -i inventory/hosts.yml playbook.yml
```

## Troubleshooting

### Check K3s Status

```bash
ssh root@YOUR_VM_IP

# Service status
systemctl status k3s

# Logs
journalctl -u k3s -f
```

### Verify API Security

```bash
# Verify API is bound to localhost only
ss -tlnp | grep 6443
# Should show: 127.0.0.1:6443 (not 0.0.0.0:6443)

# Test external access (should fail)
curl -k https://YOUR_VM_IP:6443
# Connection refused or timeout = good (blocked by UFW)
```

### Check Firewall

```bash
# UFW status
sudo ufw status verbose

# Should show:
# - 22/tcp ALLOW
# - 80/tcp ALLOW
# - 443/tcp ALLOW
# - 6443/tcp DENY
# - 10250/tcp DENY
```

### View Traefik Ingress

```bash
# Traefik service
kubectl get svc -n kube-system traefik

# Traefik pods
kubectl get pods -n kube-system -l app.kubernetes.io/name=traefik

# Traefik logs
kubectl logs -n kube-system -l app.kubernetes.io/name=traefik --tail=50 -f
```

### Reset K3s (Nuclear Option)

```bash
# WARNING: Deletes everything!
ssh root@YOUR_VM_IP
/usr/local/bin/k3s-uninstall.sh

# Then re-deploy
ansible-playbook -i inventory/hosts.yml playbook.yml
```

## Advanced Configuration

### Disable Traefik (Use Different Ingress)

Edit `inventory/hosts.yml`:

```yaml
extra_server_args: >-
  --bind-address=127.0.0.1
  --disable=traefik
```

Then install your preferred ingress controller (nginx, etc.).

### High Availability (HA) Setup

For multi-server HA with embedded etcd, add more servers to inventory:

```yaml
k3s_cluster:
  children:
    server:
      hosts:
        server1:
          ansible_host: IP1
        server2:
          ansible_host: IP2
        server3:
          ansible_host: IP3  # Odd number required (3, 5, 7)
```

k3s-ansible will automatically configure HA mode.

### Add Worker Nodes

```yaml
k3s_cluster:
  children:
    server:
      hosts:
        server1:
          ansible_host: SERVER_IP
    agent:
      hosts:
        worker1:
          ansible_host: WORKER_IP1
        worker2:
          ansible_host: WORKER_IP2
```
