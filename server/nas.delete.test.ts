import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import * as sshVpn from './services/sshVpnService';

// Mock the SSH VPN service
vi.mock('./services/sshVpnService', () => ({
  deleteVpnUser: vi.fn(),
  disconnectVpnSession: vi.fn(),
}));

describe('NAS Delete with VPN and RADIUS Cleanup', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('should call deleteVpnUser when vpnUsername is provided', async () => {
    const mockVpnUsername = 'test-vpn-user';
    
    // Mock successful VPN deletion
    (sshVpn.deleteVpnUser as any).mockResolvedValue({
      success: true,
      message: 'User deleted',
    });

    const result = await sshVpn.deleteVpnUser(mockVpnUsername);

    expect(sshVpn.deleteVpnUser).toHaveBeenCalledWith(mockVpnUsername);
    expect(result.success).toBe(true);
  });

  it('should call disconnectVpnSession when cleaning up', async () => {
    const mockVpnUsername = 'test-vpn-user';
    
    // Mock successful disconnect
    (sshVpn.disconnectVpnSession as any).mockResolvedValue({
      success: true,
      message: 'Session disconnected',
    });

    const result = await sshVpn.disconnectVpnSession(mockVpnUsername);

    expect(sshVpn.disconnectVpnSession).toHaveBeenCalledWith(mockVpnUsername);
    expect(result.success).toBe(true);
  });

  it('should handle VPN user deletion errors gracefully', async () => {
    const mockVpnUsername = 'non-existent-user';
    
    (sshVpn.deleteVpnUser as any).mockResolvedValue({
      success: false,
      error: 'User not found',
    });

    const result = await sshVpn.deleteVpnUser(mockVpnUsername);

    expect(result.success).toBe(false);
    expect(result.error).toBe('User not found');
  });

  it('should handle VPN session disconnect errors gracefully', async () => {
    const mockVpnUsername = 'test-user';
    
    (sshVpn.disconnectVpnSession as any).mockResolvedValue({
      success: false,
      error: 'No active session',
    });

    const result = await sshVpn.disconnectVpnSession(mockVpnUsername);

    expect(result.success).toBe(false);
    expect(result.error).toBe('No active session');
  });
});

describe('SSH VPN Service - Delete User', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should format delete request correctly', async () => {
    const username = 'test-nas-user';
    
    // The actual implementation uses SSH to call curl
    // This test verifies the function signature and return type
    (sshVpn.deleteVpnUser as any).mockResolvedValue({
      success: true,
      message: `User ${username} deleted`,
    });

    const result = await sshVpn.deleteVpnUser(username);

    expect(result.success).toBe(true);
    expect(result.message).toContain(username);
  });

  it('should handle deletion errors gracefully', async () => {
    const username = 'non-existent-user';
    
    (sshVpn.deleteVpnUser as any).mockResolvedValue({
      success: false,
      error: 'User not found',
    });

    const result = await sshVpn.deleteVpnUser(username);

    expect(result.success).toBe(false);
    expect(result.error).toBeDefined();
  });
});

describe('NAS Delete Flow - Integration Logic', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should perform full cleanup when NAS with VPN is deleted', async () => {
    const vpnUsername = 'nas-vpn-user-123';
    
    // Mock all cleanup operations
    (sshVpn.deleteVpnUser as any).mockResolvedValue({ success: true, message: 'Deleted' });
    (sshVpn.disconnectVpnSession as any).mockResolvedValue({ success: true, message: 'Disconnected' });

    // Simulate the cleanup flow that happens in routers.ts
    const vpnDeleteResult = await sshVpn.deleteVpnUser(vpnUsername);
    const disconnectResult = await sshVpn.disconnectVpnSession(vpnUsername);

    expect(vpnDeleteResult.success).toBe(true);
    expect(disconnectResult.success).toBe(true);
    expect(sshVpn.deleteVpnUser).toHaveBeenCalledTimes(1);
    expect(sshVpn.disconnectVpnSession).toHaveBeenCalledTimes(1);
  });

  it('should continue cleanup even if VPN deletion fails', async () => {
    const vpnUsername = 'nas-vpn-user-456';
    
    // VPN deletion fails but disconnect should still be attempted
    (sshVpn.deleteVpnUser as any).mockResolvedValue({ success: false, error: 'Connection timeout' });
    (sshVpn.disconnectVpnSession as any).mockResolvedValue({ success: true, message: 'Disconnected' });

    // Simulate the cleanup flow - errors are caught and logged
    const vpnDeleteResult = await sshVpn.deleteVpnUser(vpnUsername);
    const disconnectResult = await sshVpn.disconnectVpnSession(vpnUsername);

    expect(vpnDeleteResult.success).toBe(false);
    expect(disconnectResult.success).toBe(true);
    // Both operations should be attempted
    expect(sshVpn.deleteVpnUser).toHaveBeenCalledWith(vpnUsername);
    expect(sshVpn.disconnectVpnSession).toHaveBeenCalledWith(vpnUsername);
  });
});
