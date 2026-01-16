#!/usr/bin/env python3
"""
VPS Management API for SaaS Production System
Provides secure endpoints for Update, Rollback, Backup, Restore operations
"""

import os
import json
import subprocess
import datetime
import hashlib
import shutil
import tarfile
from pathlib import Path
from functools import wraps
from flask import Flask, request, jsonify

app = Flask(__name__)

# Configuration
CONFIG = {
    "APP_DIR": "/opt/radius-saas",
    "BACKUP_DIR": "/opt/backups",
    "GIT_REPO": "https://github.com/your-repo/radius-saas.git",
    "GIT_BRANCH": "main",
    "API_SECRET": os.environ.get("VPS_API_SECRET", "your-secure-secret-here"),
    "MAX_BACKUPS": 30,
    "SERVICES": {
        "app": "radius-saas",
        "freeradius": "freeradius",
        "vpn": "softether-vpnserver",
        "dhcp": "isc-dhcp-server"
    }
}

# Ensure backup directory exists
Path(CONFIG["BACKUP_DIR"]).mkdir(parents=True, exist_ok=True)


def require_auth(f):
    """Decorator to require API authentication"""
    @wraps(f)
    def decorated(*args, **kwargs):
        auth_header = request.headers.get("Authorization")
        if not auth_header or not auth_header.startswith("Bearer "):
            return jsonify({"success": False, "error": "Unauthorized"}), 401
        
        token = auth_header.split(" ")[1]
        if token != CONFIG["API_SECRET"]:
            return jsonify({"success": False, "error": "Invalid token"}), 401
        
        return f(*args, **kwargs)
    return decorated


def run_command(cmd, cwd=None, timeout=300):
    """Run a shell command and return result"""
    try:
        result = subprocess.run(
            cmd,
            shell=True,
            cwd=cwd,
            capture_output=True,
            text=True,
            timeout=timeout
        )
        return {
            "success": result.returncode == 0,
            "stdout": result.stdout,
            "stderr": result.stderr,
            "returncode": result.returncode
        }
    except subprocess.TimeoutExpired:
        return {"success": False, "error": "Command timed out"}
    except Exception as e:
        return {"success": False, "error": str(e)}


def get_current_version():
    """Get current git commit hash"""
    result = run_command("git rev-parse HEAD", cwd=CONFIG["APP_DIR"])
    if result["success"]:
        return result["stdout"].strip()[:8]
    return "unknown"


def get_service_status(service_name):
    """Get status of a systemd service"""
    result = run_command(f"systemctl is-active {service_name}")
    return result["stdout"].strip() if result["success"] else "unknown"


def health_check():
    """Perform health check on the application"""
    checks = {
        "app_running": get_service_status(CONFIG["SERVICES"]["app"]) == "active",
        "api_responding": False,
        "db_connected": False
    }
    
    # Check if API is responding
    try:
        import urllib.request
        with urllib.request.urlopen("http://localhost:3000/api/health", timeout=5) as response:
            checks["api_responding"] = response.status == 200
    except:
        pass
    
    # Check database connection
    result = run_command("cd /opt/radius-saas && pnpm db:check 2>/dev/null || echo 'ok'")
    checks["db_connected"] = "error" not in result.get("stdout", "").lower()
    
    return checks


# ==================== API ENDPOINTS ====================

@app.route("/api/status", methods=["GET"])
@require_auth
def status():
    """Get system status"""
    services = {}
    for name, service in CONFIG["SERVICES"].items():
        services[name] = get_service_status(service)
    
    # Get version info
    version = get_current_version()
    
    # Get available backups
    backups = list_backups()
    
    # Get disk usage
    disk_result = run_command("df -h / | tail -1 | awk '{print $5}'")
    disk_usage = disk_result["stdout"].strip() if disk_result["success"] else "unknown"
    
    return jsonify({
        "success": True,
        "data": {
            "version": version,
            "services": services,
            "disk_usage": disk_usage,
            "backups_count": len(backups),
            "health": health_check(),
            "timestamp": datetime.datetime.utcnow().isoformat()
        }
    })


@app.route("/api/update", methods=["POST"])
@require_auth
def update():
    """Pull latest code and update application"""
    app_dir = CONFIG["APP_DIR"]
    
    # Step 1: Create backup before update
    backup_result = create_backup("pre-update")
    if not backup_result["success"]:
        return jsonify({"success": False, "error": "Failed to create pre-update backup", "details": backup_result})
    
    # Step 2: Store current version for rollback
    old_version = get_current_version()
    
    # Step 3: Pull latest code
    pull_result = run_command(f"git pull origin {CONFIG['GIT_BRANCH']}", cwd=app_dir)
    if not pull_result["success"]:
        return jsonify({"success": False, "error": "Git pull failed", "details": pull_result})
    
    # Step 4: Install dependencies
    deps_result = run_command("pnpm install", cwd=app_dir, timeout=600)
    if not deps_result["success"]:
        # Rollback on failure
        run_command(f"git checkout {old_version}", cwd=app_dir)
        return jsonify({"success": False, "error": "Dependency install failed", "details": deps_result})
    
    # Step 5: Run database migrations
    migrate_result = run_command("pnpm db:push", cwd=app_dir, timeout=300)
    if not migrate_result["success"]:
        # Rollback on failure
        run_command(f"git checkout {old_version}", cwd=app_dir)
        return jsonify({"success": False, "error": "Migration failed", "details": migrate_result})
    
    # Step 6: Build application
    build_result = run_command("pnpm build", cwd=app_dir, timeout=600)
    if not build_result["success"]:
        run_command(f"git checkout {old_version}", cwd=app_dir)
        return jsonify({"success": False, "error": "Build failed", "details": build_result})
    
    # Step 7: Restart application ONLY (NOT FreeRADIUS)
    restart_result = run_command(f"systemctl restart {CONFIG['SERVICES']['app']}")
    if not restart_result["success"]:
        return jsonify({"success": False, "error": "Restart failed", "details": restart_result})
    
    # Step 8: Health check
    import time
    time.sleep(5)  # Wait for app to start
    health = health_check()
    
    if not health["app_running"]:
        # Auto-rollback
        rollback_to_version(old_version)
        return jsonify({
            "success": False,
            "error": "Health check failed - auto rollback performed",
            "rollback_version": old_version
        })
    
    new_version = get_current_version()
    
    return jsonify({
        "success": True,
        "data": {
            "old_version": old_version,
            "new_version": new_version,
            "health": health,
            "backup_id": backup_result.get("backup_id")
        }
    })


@app.route("/api/rollback", methods=["POST"])
@require_auth
def rollback():
    """Rollback to a specific version"""
    data = request.get_json() or {}
    version = data.get("version")
    
    if not version:
        # Get previous version from git
        result = run_command("git rev-parse HEAD~1", cwd=CONFIG["APP_DIR"])
        if result["success"]:
            version = result["stdout"].strip()[:8]
        else:
            return jsonify({"success": False, "error": "No version specified and cannot determine previous version"})
    
    return rollback_to_version(version)


def rollback_to_version(version):
    """Perform rollback to specific version"""
    app_dir = CONFIG["APP_DIR"]
    current_version = get_current_version()
    
    # Checkout specific version
    checkout_result = run_command(f"git checkout {version}", cwd=app_dir)
    if not checkout_result["success"]:
        return jsonify({"success": False, "error": "Git checkout failed", "details": checkout_result})
    
    # Reinstall dependencies
    run_command("pnpm install", cwd=app_dir, timeout=600)
    
    # Rebuild
    run_command("pnpm build", cwd=app_dir, timeout=600)
    
    # Restart app only
    run_command(f"systemctl restart {CONFIG['SERVICES']['app']}")
    
    return jsonify({
        "success": True,
        "data": {
            "previous_version": current_version,
            "current_version": version
        }
    })


@app.route("/api/versions", methods=["GET"])
@require_auth
def list_versions():
    """List available versions (git commits)"""
    result = run_command(
        "git log --oneline -20 --format='%h|%s|%ci'",
        cwd=CONFIG["APP_DIR"]
    )
    
    if not result["success"]:
        return jsonify({"success": False, "error": "Failed to get versions"})
    
    versions = []
    for line in result["stdout"].strip().split("\n"):
        if "|" in line:
            parts = line.split("|")
            versions.append({
                "hash": parts[0],
                "message": parts[1] if len(parts) > 1 else "",
                "date": parts[2] if len(parts) > 2 else ""
            })
    
    return jsonify({
        "success": True,
        "data": {
            "current": get_current_version(),
            "versions": versions
        }
    })


def list_backups():
    """List available backups"""
    backup_dir = Path(CONFIG["BACKUP_DIR"])
    backups = []
    
    for f in sorted(backup_dir.glob("*.tar.gz"), reverse=True):
        stat = f.stat()
        backups.append({
            "id": f.stem.replace(".tar", ""),
            "filename": f.name,
            "size": stat.st_size,
            "created": datetime.datetime.fromtimestamp(stat.st_mtime).isoformat()
        })
    
    return backups


@app.route("/api/backups", methods=["GET"])
@require_auth
def get_backups():
    """List available backups"""
    return jsonify({
        "success": True,
        "data": list_backups()
    })


def create_backup(prefix="manual"):
    """Create a backup of database and important files"""
    timestamp = datetime.datetime.now().strftime("%Y%m%d_%H%M%S")
    backup_id = f"{prefix}_{timestamp}"
    backup_path = Path(CONFIG["BACKUP_DIR"]) / f"{backup_id}.tar.gz"
    temp_dir = Path(f"/tmp/backup_{backup_id}")
    
    try:
        temp_dir.mkdir(parents=True, exist_ok=True)
        
        # Backup database
        db_backup = temp_dir / "database.sql"
        # Note: For TiDB cloud, we export via mysqldump
        db_result = run_command(
            f"mysqldump --single-transaction --routines --triggers "
            f"-h $DB_HOST -P $DB_PORT -u $DB_USER -p$DB_PASS $DB_NAME > {db_backup}",
            timeout=600
        )
        
        # Backup important config files
        config_backup = temp_dir / "config"
        config_backup.mkdir(exist_ok=True)
        
        # Copy FreeRADIUS config
        if Path("/etc/freeradius/3.0").exists():
            shutil.copytree("/etc/freeradius/3.0", config_backup / "freeradius", dirs_exist_ok=True)
        
        # Copy DHCP config
        if Path("/etc/dhcp").exists():
            shutil.copytree("/etc/dhcp", config_backup / "dhcp", dirs_exist_ok=True)
        
        # Copy app .env
        env_file = Path(CONFIG["APP_DIR"]) / ".env"
        if env_file.exists():
            shutil.copy(env_file, config_backup / ".env")
        
        # Save version info
        version_info = {
            "version": get_current_version(),
            "timestamp": datetime.datetime.utcnow().isoformat(),
            "prefix": prefix
        }
        with open(temp_dir / "version.json", "w") as f:
            json.dump(version_info, f)
        
        # Create tarball
        with tarfile.open(backup_path, "w:gz") as tar:
            tar.add(temp_dir, arcname=backup_id)
        
        # Cleanup temp
        shutil.rmtree(temp_dir)
        
        # Remove old backups if exceeding max
        cleanup_old_backups()
        
        return {
            "success": True,
            "backup_id": backup_id,
            "path": str(backup_path),
            "size": backup_path.stat().st_size
        }
        
    except Exception as e:
        if temp_dir.exists():
            shutil.rmtree(temp_dir)
        return {"success": False, "error": str(e)}


@app.route("/api/backup", methods=["POST"])
@require_auth
def backup():
    """Create a new backup"""
    data = request.get_json() or {}
    prefix = data.get("prefix", "manual")
    
    result = create_backup(prefix)
    return jsonify(result)


def cleanup_old_backups():
    """Remove old backups exceeding max count"""
    backups = list_backups()
    if len(backups) > CONFIG["MAX_BACKUPS"]:
        for backup in backups[CONFIG["MAX_BACKUPS"]:]:
            backup_path = Path(CONFIG["BACKUP_DIR"]) / backup["filename"]
            if backup_path.exists():
                backup_path.unlink()


@app.route("/api/restore", methods=["POST"])
@require_auth
def restore():
    """Restore from a backup"""
    data = request.get_json() or {}
    backup_id = data.get("backup_id")
    
    if not backup_id:
        return jsonify({"success": False, "error": "backup_id is required"})
    
    backup_path = Path(CONFIG["BACKUP_DIR"]) / f"{backup_id}.tar.gz"
    if not backup_path.exists():
        return jsonify({"success": False, "error": "Backup not found"})
    
    temp_dir = Path(f"/tmp/restore_{backup_id}")
    
    try:
        # Extract backup
        temp_dir.mkdir(parents=True, exist_ok=True)
        with tarfile.open(backup_path, "r:gz") as tar:
            tar.extractall(temp_dir)
        
        extracted_dir = temp_dir / backup_id
        
        # Restore database
        db_backup = extracted_dir / "database.sql"
        if db_backup.exists():
            db_result = run_command(
                f"mysql -h $DB_HOST -P $DB_PORT -u $DB_USER -p$DB_PASS $DB_NAME < {db_backup}",
                timeout=600
            )
            if not db_result["success"]:
                return jsonify({"success": False, "error": "Database restore failed", "details": db_result})
        
        # Restore config files (optional - be careful with this)
        # For now, we only restore the database
        
        # Cleanup
        shutil.rmtree(temp_dir)
        
        # Restart app
        run_command(f"systemctl restart {CONFIG['SERVICES']['app']}")
        
        return jsonify({
            "success": True,
            "data": {
                "restored_backup": backup_id,
                "timestamp": datetime.datetime.utcnow().isoformat()
            }
        })
        
    except Exception as e:
        if temp_dir.exists():
            shutil.rmtree(temp_dir)
        return jsonify({"success": False, "error": str(e)})


@app.route("/api/service/<service_name>/<action>", methods=["POST"])
@require_auth
def manage_service(service_name, action):
    """Manage a service (start/stop/restart/reload)"""
    # Only allow specific services
    allowed_services = ["app", "dhcp"]  # NOT freeradius or vpn
    
    if service_name not in allowed_services:
        return jsonify({"success": False, "error": f"Service '{service_name}' cannot be managed via API"})
    
    if action not in ["start", "stop", "restart", "reload"]:
        return jsonify({"success": False, "error": "Invalid action"})
    
    service = CONFIG["SERVICES"].get(service_name)
    if not service:
        return jsonify({"success": False, "error": "Unknown service"})
    
    result = run_command(f"systemctl {action} {service}")
    
    return jsonify({
        "success": result["success"],
        "data": {
            "service": service_name,
            "action": action,
            "new_status": get_service_status(service)
        }
    })


@app.route("/api/logs/<service_name>", methods=["GET"])
@require_auth
def get_logs(service_name):
    """Get recent logs for a service"""
    lines = request.args.get("lines", 100, type=int)
    lines = min(lines, 500)  # Max 500 lines
    
    service = CONFIG["SERVICES"].get(service_name)
    if not service:
        return jsonify({"success": False, "error": "Unknown service"})
    
    result = run_command(f"journalctl -u {service} --no-pager -n {lines}")
    
    return jsonify({
        "success": result["success"],
        "data": {
            "service": service_name,
            "logs": result["stdout"] if result["success"] else result.get("error", "")
        }
    })


@app.route("/api/health", methods=["GET"])
def health():
    """Public health check endpoint"""
    return jsonify({"status": "ok", "timestamp": datetime.datetime.utcnow().isoformat()})


if __name__ == "__main__":
    app.run(host="127.0.0.1", port=8081, debug=False)
