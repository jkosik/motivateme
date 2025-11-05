# K3s Deployment with Ansible

Automated K3s deployment using the official [k3s-ansible collection](https://github.com/k3s-io/k3s-ansible) with custom security hardening for production use on Ubuntu 24.04.

## Install
```bash
cd ansible/
ansible-galaxy collection install -r requirements.yml
ansible-playbook -i inventory/hosts.yml playbook.yml
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

### Reset K3s (Nuclear Option)

```bash
# WARNING: Deletes everything!
ssh root@YOUR_VM_IP
/usr/local/bin/k3s-uninstall.sh
```
