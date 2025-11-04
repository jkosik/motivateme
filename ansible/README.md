# K3s Deployment with Ansible

Automated K3s deployment on Ubuntu 24.04 for Hetzner VMs with security hardening.

## Quick Start
```bash
ansible all -i inventory/hosts.yml -m ping

ansible-playbook -i inventory/hosts.yml playbook.yml

ansible all -i inventory/hosts.yml -a "kubectl get nodes"
ansible all -i inventory/hosts.yml -a "systemctl status k3s"
```

## Access K3s

### From local machine (SSH tunnel)

```bash
# Terminal 1: Create tunnel
ssh -L 6443:127.0.0.1:6443 root@YOUR_VM_IP

# Terminal 2: Download kubeconfig and use kubectl
scp root@YOUR_VM_IP:/etc/rancher/k3s/k3s.yaml ~/.kube/config
kubectl get nodes
```

## Troubleshooting on VM

```bash
sudo ufw status verbose
systemctl status k3s
journalctl -u k3s -f
kubectl get nodes -o wide
kubectl get pods -A
```

### Check API Bind Address

```bash
# Verify K3s API is bound to localhost only
ss -tlnp | grep 6443
# Should show: 127.0.0.1:6443

# Test external access (should fail)
curl -k https://YOUR_VM_IP:6443
# Connection refused or timeout = good (blocked by firewall)
```

### View Logs

```bash
# K3s logs
journalctl -u k3s -f

# Specific pod logs
kubectl logs -n kube-system POD_NAME

# Ingress logs
kubectl logs -n kube-system -l app.kubernetes.io/name=traefik --tail=50
```

### Reset K3s (if needed)

```bash
# WARNING: Deletes everything!
/usr/local/bin/k3s-uninstall.sh

# Then re-run Ansible
ansible-playbook -i inventory/hosts.yml playbook.yml
```

### Allow Your IP to Access K3s API (optional)

```bash
# On the VM
sudo ufw allow from YOUR_IP to any port 6443 proto tcp

# Then on local machine, edit kubeconfig
# Replace: server: https://127.0.0.1:6443
# With:    server: https://YOUR_VM_IP:6443
```

