import { Component, HostListener, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

@Component({
  selector: 'app-admin-security',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="admin-security-page">
      <!-- HEADER -->
      <div class="header-bar">
        <div>
          <h2>Security & Compliance Policy Settings</h2>
          <p>Configure multi-factor authentication (MFA), session timeouts, IP whitelist ranges, and security headers.</p>
        </div>
        <div class="header-actions">
          <button type="button" class="btn-primary" (click)="saveSecuritySettings()">Save Security Settings</button>
        </div>
      </div>

      @if (hasUnsavedChanges()) {
        <div class="unsaved-warning-bar">
          ⚠️ You have unsaved security configuration changes. Click "Save Security Settings" to persist changes.
        </div>
      }

      <div class="settings-grid">
        <!-- MFA & PRIVILEGED ROLES -->
        <div class="setting-card">
          <h3>Authentication & MFA Enforcement</h3>
          <div class="form-group checkbox-group">
            <label>
              <input type="checkbox" [(ngModel)]="securitySettings.requireMfaPrivileged" (change)="markDirty()" />
              <strong>Require MFA for Privileged Roles</strong> (Org Admin, Approver, Platform Operator)
            </label>
          </div>
          <div class="form-group checkbox-group">
            <label>
              <input type="checkbox" [(ngModel)]="securitySettings.allowRememberDevice" (change)="markDirty()" />
              Allow "Remember Device for 30 Days"
            </label>
          </div>
          <div class="form-group">
            <label>Allowed MFA Methods:</label>
            <select [(ngModel)]="securitySettings.mfaMethod" (change)="markDirty()" class="form-select">
              <option value="totp">TOTP Authenticator Apps (Google/Microsoft)</option>
              <option value="webauthn">FIDO2 / WebAuthn Hardware Keys Only</option>
              <option value="any">TOTP or Email OTP</option>
            </select>
          </div>
        </div>

        <!-- SESSION & TIMEOUT -->
        <div class="setting-card">
          <h3>Session Inactivity & Timeout Controls</h3>
          <div class="form-group">
            <label>Idle Session Timeout Minutes:</label>
            <select [(ngModel)]="securitySettings.sessionTimeoutMinutes" (change)="markDirty()" class="form-select">
              <option [ngValue]="15">15 Minutes (High Security)</option>
              <option [ngValue]="30">30 Minutes (Recommended)</option>
              <option [ngValue]="60">60 Minutes</option>
            </select>
          </div>
          <div class="form-group checkbox-group">
            <label>
              <input type="checkbox" [(ngModel)]="securitySettings.revokeTokenOnRoleChange" (change)="markDirty()" />
              Revoke active JWT tokens immediately on user role or permission modification
            </label>
          </div>
        </div>

        <!-- NETWORK & IP RESTRICTION -->
        <div class="setting-card full-width">
          <h3>IP Whitelisting & Network Restrictions</h3>
          <div class="form-group checkbox-group">
            <label>
              <input type="checkbox" [(ngModel)]="securitySettings.enableIpRestriction" (change)="markDirty()" />
              Enable Strict IP CIDR Whitelist for Admin & API Access
            </label>
          </div>
          <div class="form-group">
            <label>Allowed IP Ranges (comma-separated CIDRs):</label>
            <input type="text" [(ngModel)]="securitySettings.ipWhitelist" (change)="markDirty()" class="form-input" placeholder="e.g. 192.168.1.0/24, 10.0.0.0/16, 203.0.113.4" [disabled]="!securitySettings.enableIpRestriction" />
          </div>
        </div>
      </div>

      @if (toastMessage) {
        <div class="toast-popup"><span>{{ toastMessage }}</span></div>
      }
    </div>
  `,
  styles: [`
    .admin-security-page { display: flex; flex-direction: column; gap: 1.25rem; }
    .header-bar { display: flex; justify-content: space-between; align-items: flex-start; h2 { margin: 0; font-size: 1.25rem; color: #0f172a; font-weight: 700; } p { margin: 0.2rem 0 0 0; color: #64748b; font-size: 0.85rem; } .btn-primary { background: #4f46e5; color: #ffffff; border: none; border-radius: 8px; padding: 0.55rem 1.1rem; font-weight: 600; font-size: 0.85rem; cursor: pointer; transition: all 0.2s; &:hover { background: #4338ca; } } }
    .unsaved-warning-bar { background: #fffbe6; border: 1px solid #ffe58f; color: #d48806; padding: 0.75rem 1rem; border-radius: 8px; font-size: 0.85rem; font-weight: 600; }
    .settings-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 1.25rem; .full-width { grid-column: span 2; } }
    .setting-card { background: #ffffff; border: 1px solid #e2e8f0; border-radius: 12px; padding: 1.25rem; display: flex; flex-direction: column; gap: 1rem; box-shadow: 0 1px 3px rgba(15,23,42,0.04); h3 { margin: 0; font-size: 1.05rem; color: #0f172a; font-weight: 600; } .form-group { label { font-size: 0.8rem; color: #475569; display: block; margin-bottom: 0.35rem; font-weight: 500; } .form-select, .form-input { width: 100%; background: #ffffff; border: 1px solid #cbd5e1; color: #0f172a; padding: 0.5rem 0.75rem; border-radius: 6px; box-sizing: border-box; font-size: 0.85rem; transition: border-color 0.2s; &:focus { border-color: #4f46e5; outline: none; } &:disabled { opacity: 0.5; background: #f8fafc; } } } .checkbox-group label { display: flex; align-items: center; gap: 0.5rem; font-size: 0.85rem; color: #0f172a; cursor: pointer; } }
    .toast-popup { position: fixed; bottom: 2rem; right: 2rem; z-index: 300; background: #15803d; color: #ffffff; padding: 0.75rem 1.25rem; border-radius: 8px; font-weight: 600; font-size: 0.85rem; box-shadow: 0 4px 12px rgba(0,0,0,0.15); }
  `]
})
export class AdminSecurity {
  hasUnsavedChanges = signal(false);
  toastMessage: string | null = null;

  securitySettings = {
    requireMfaPrivileged: true,
    allowRememberDevice: true,
    mfaMethod: 'totp',
    sessionTimeoutMinutes: 30,
    revokeTokenOnRoleChange: true,
    enableIpRestriction: false,
    ipWhitelist: '192.168.1.0/24',
  };

  @HostListener('window:beforeunload', ['$event'])
  unloadNotification($event: BeforeUnloadEvent): void {
    if (this.hasUnsavedChanges()) {
      $event.returnValue = 'You have unsaved security configuration changes.';
    }
  }

  markDirty(): void {
    this.hasUnsavedChanges.set(true);
  }

  saveSecuritySettings(): void {
    this.hasUnsavedChanges.set(false);
    this.showToast('Security & Compliance settings updated successfully.');
  }

  showToast(msg: string): void {
    this.toastMessage = msg;
    setTimeout(() => { if (this.toastMessage === msg) this.toastMessage = null; }, 3500);
  }
}
