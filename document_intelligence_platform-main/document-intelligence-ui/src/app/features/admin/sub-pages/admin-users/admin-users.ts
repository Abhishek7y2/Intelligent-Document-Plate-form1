import { Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpAdminService, UserInvitation as PendingInvitation } from '../../../../core/services/http-admin.service';

export interface UserAccount {
  id: string;
  name: string;
  email: string;
  role: 'org_admin' | 'reviewer' | 'approver' | 'contributor' | 'auditor';
  workspaceScope: string;
  status: 'active' | 'deactivated';
  mfaEnabled: boolean;
  mfaRequired: boolean;
  lastActive: string;
}

@Component({
  selector: 'app-admin-users',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="admin-users-page">
      <div class="header-bar">
        <div>
          <h2>User Accounts & Role Permissions</h2>
          <p>Invite organization members, manage canonical roles with session revocation, and enforce MFA policies.</p>
        </div>
        <button type="button" class="btn-primary" (click)="openInviteModal()">+ Invite New User</button>
      </div>

      <!-- FILTER BAR -->
      <div class="filter-card">
        <div class="search-box">
          <span>⌕</span>
          <input type="text" [(ngModel)]="searchTerm" placeholder="Search by name, email, or workspace..." />
        </div>

        <select [(ngModel)]="selectedRole">
          <option value="all">All Roles</option>
          @for (r of availableRoles; track r.role) {
            <option [value]="r.role">{{ r.role }}</option>
          }
        </select>

        <select [(ngModel)]="selectedStatus">
          <option value="all">All Status</option>
          <option value="active">Active</option>
          <option value="deactivated">Deactivated</option>
        </select>
      </div>

      <!-- USERS TABLE -->
      <div class="table-card">
        <table class="users-table">
          <thead>
            <tr>
              <th>USER NAME & EMAIL</th>
              <th>ASSIGNED ROLE</th>
              <th>WORKSPACE SCOPE</th>
              <th>MFA STATUS</th>
              <th>STATUS</th>
              <th class="text-right">ACTIONS</th>
            </tr>
          </thead>
          <tbody>
            @for (u of filteredUsers; track u.id) {
              <tr [class.deactivated-row]="u.status === 'deactivated'">
                <td>
                  <strong>{{ u.name }}</strong>
                  <span class="email-sub">{{ u.email }}</span>
                </td>
                <td><span class="role-badge {{ u.role }}">{{ u.role | uppercase }}</span></td>
                <td><span class="scope-tag">{{ u.workspaceScope }}</span></td>
                <td>
                  <div class="mfa-cell">
                    <span class="mfa-dot" [class.enabled]="u.mfaEnabled"></span>
                    <span>{{ u.mfaEnabled ? 'MFA Active' : 'Not Set' }}</span>
                    <button type="button" class="btn-toggle-mfa" (click)="toggleRequireMfa(u)">
                      {{ u.mfaRequired ? 'Required ★' : 'Optional' }}
                    </button>
                  </div>
                </td>
                <td>
                  <span class="status-chip {{ u.status }}">{{ u.status | uppercase }}</span>
                </td>
                <td class="text-right">
                  <button type="button" class="btn-act-edit" (click)="openEditRoleModal(u)">Change Role</button>
                  @if (u.status === 'active') {
                    <button type="button" class="btn-act-deactivate" (click)="confirmDeactivateUser(u)">Deactivate</button>
                  } @else {
                    <button type="button" class="btn-act-activate" (click)="reactivateUser(u)">Reactivate</button>
                  }
                </td>
              </tr>
            }
          </tbody>
        </table>
      </div>

      <!-- D.1: PENDING INVITATIONS LIST WITH REVOKE -->
      <div class="section-container">
        <div class="section-header">
          <h3>Pending Organization Invitations</h3>
          <span class="section-sub">Outstanding invites sent to members. Invites can be revoked at any time.</span>
        </div>

        <div class="table-card">
          @if (pendingInvitations().length === 0) {
            <div class="empty-invites">
              <span>No pending invitations outstanding.</span>
            </div>
          } @else {
            <table class="users-table">
              <thead>
                <tr>
                  <th>INVITEE EMAIL</th>
                  <th>ASSIGNED ROLE</th>
                  <th>SENT DATE</th>
                  <th>EXPIRES AT</th>
                  <th class="text-right">ACTION</th>
                </tr>
              </thead>
              <tbody>
                @for (inv of pendingInvitations(); track inv.id) {
                  <tr>
                    <td><strong>{{ inv.email }}</strong></td>
                    <td><span class="role-badge {{ inv.role }}">{{ inv.role | uppercase }}</span></td>
                    <td>{{ inv.createdAt | date:'short' }}</td>
                    <td>{{ inv.expiresAt | date:'short' }}</td>
                    <td class="text-right">
                      <button type="button" class="btn-act-revoke" (click)="revokeInvite(inv.id)" [disabled]="isRevoking()">
                        Revoke Invite
                      </button>
                    </td>
                  </tr>
                }
              </tbody>
            </table>
          }
        </div>
      </div>

      <!-- D.1: INVITE USER DIALOG -->
      @if (showInviteModal) {
        <div class="modal-backdrop" (click)="showInviteModal = false">
          <div class="user-modal-card" (click)="$event.stopPropagation()">
            <h3>Invite New Organization User</h3>
            <p class="modal-sub">An invitation will be generated with canonical role assignment.</p>

            <div class="form-group">
              <label>Email Address:</label>
              <input type="email" [(ngModel)]="inviteEmail" class="modal-input" placeholder="e.g. colleague@acme.com" />
            </div>

            <div class="form-group">
              <label>Canonical Role:</label>
              <select [(ngModel)]="inviteRole" class="modal-select">
                @for (r of availableRoles; track r.role) {
                  <option [value]="r.role">{{ r.label }}</option>
                }
              </select>
            </div>

            <div class="modal-actions">
              <button type="button" class="btn-secondary" (click)="showInviteModal = false">Cancel</button>
              <button type="button" class="btn-primary" (click)="sendInvitation()" [disabled]="!inviteEmail || isInviting()">
                {{ isInviting() ? 'Generating Invite...' : 'Send Invitation' }}
              </button>
            </div>
          </div>
        </div>
      }

      <!-- D.1: ONE-TIME INVITE TOKEN DISPLAY (SHOWN ONCE IN MEMORY, NEVER PERSISTED) -->
      @if (oneTimeInviteToken) {
        <div class="modal-backdrop" (click)="oneTimeInviteToken = null">
          <div class="user-modal-card token-card" (click)="$event.stopPropagation()">
            <div class="token-header">
              <span class="key-icon">🔑</span>
              <h3>One-Time Invitation Link Generated</h3>
            </div>
            <div class="token-warning">
              <strong>Security Policy:</strong>
              <p>This invite link contains a single-use token and is displayed only once in memory. It is never stored in plaintext logs or database storage.</p>
            </div>

            <div class="token-display-box">
              <code>{{ getInviteUrl() }}</code>
            </div>

            <div class="modal-actions">
              <button type="button" class="btn-primary" (click)="copyInviteLink()">
                📋 Copy Invitation Link
              </button>
              <button type="button" class="btn-secondary" (click)="oneTimeInviteToken = null">
                Done
              </button>
            </div>
          </div>
        </div>
      }

      <!-- D.1: CHANGE ROLE MODAL (WITH SESSION REVOCATION) -->
      @if (showRoleModal && selectedUserForRole) {
        <div class="modal-backdrop" (click)="showRoleModal = false">
          <div class="user-modal-card" (click)="$event.stopPropagation()">
            <h3>Change Role for {{ selectedUserForRole.name }}</h3>
            <div class="session-revocation-warning">
              <strong>⚠️ Immediate Session Revocation Notice:</strong>
              <p>Updating this user's role will immediately revoke all their active JWT sessions and refresh tokens. The user must sign in again with their new permissions.</p>
            </div>

            <div class="form-group">
              <label>Current Role:</label>
              <span class="role-badge {{ selectedUserForRole.role }}">{{ selectedUserForRole.role | uppercase }}</span>
            </div>

            <div class="form-group">
              <label>New Canonical Role:</label>
              <select [(ngModel)]="newSelectedRole" class="modal-select">
                @for (r of availableRoles; track r.role) {
                  <option [value]="r.role">{{ r.label }}</option>
                }
              </select>
            </div>

            <div class="modal-actions">
              <button type="button" class="btn-secondary" (click)="showRoleModal = false">Cancel</button>
              <button type="button" class="btn-primary" (click)="confirmRoleChange()" [disabled]="isUpdatingRole()">
                {{ isUpdatingRole() ? 'Updating & Revoking Sessions...' : 'Confirm Role Change' }}
              </button>
            </div>
          </div>
        </div>
      }

      @if (toastMessage) {
        <div class="toast-popup"><span>{{ toastMessage }}</span></div>
      }
    </div>
  `,
  styles: [`
    .admin-users-page { display: flex; flex-direction: column; gap: 1.25rem; }
    .header-bar { display: flex; justify-content: space-between; align-items: flex-start; h2 { margin: 0; font-size: 1.25rem; color: #0f172a; } p { margin: 0.2rem 0 0 0; color: #64748b; font-size: 0.85rem; } }
    .btn-primary { background: #4f46e5; color: #ffffff; border: none; border-radius: 6px; padding: 0.55rem 1.1rem; font-weight: 700; font-size: 0.85rem; cursor: pointer; &:hover:not(:disabled) { background: #4338ca; } &:disabled { opacity: 0.6; cursor: not-allowed; } }
    .filter-card { display: flex; gap: 1rem; background: #ffffff; border: 1px solid #e2e8f0; border-radius: 10px; padding: 0.85rem; box-shadow: 0 2px 8px rgba(15,23,42,0.04); .search-box { flex: 1; display: flex; align-items: center; background: #f8fafc; border: 1px solid #cbd5e1; border-radius: 6px; padding: 0 0.65rem; span { color: #64748b; margin-right: 0.4rem; } input { width: 100%; background: transparent; border: none; color: #0f172a; padding: 0.45rem 0; font-size: 0.82rem; &:focus { outline: none; } } } select { background: #f8fafc; border: 1px solid #cbd5e1; color: #0f172a; border-radius: 6px; padding: 0.45rem; font-size: 0.82rem; } }
    .table-card { background: #ffffff; border: 1px solid #e2e8f0; border-radius: 12px; overflow-x: auto; box-shadow: 0 2px 8px rgba(15,23,42,0.04); }
    .users-table { width: 100%; border-collapse: collapse; font-size: 0.82rem; th { background: #f8fafc; color: #64748b; padding: 0.65rem 0.85rem; text-align: left; font-size: 0.72rem; border-bottom: 1px solid #e2e8f0; } td { padding: 0.75rem 0.85rem; border-bottom: 1px solid #f1f5f9; color: #0f172a; } .email-sub { font-size: 0.7rem; color: #64748b; display: block; } .role-badge { background: #e0e7ff; color: #4338ca; padding: 0.15rem 0.45rem; border-radius: 4px; font-weight: 700; font-size: 0.7rem; &.org_admin { background: #fef3c7; color: #b45309; } &.approver { background: #dcfce7; color: #15803d; } &.contributor { background: #e0f2fe; color: #0369a1; } &.auditor { background: #f3e8ff; color: #7e22ce; } } .scope-tag { background: #f1f5f9; color: #475569; font-size: 0.7rem; padding: 0.1rem 0.4rem; border-radius: 4px; border: 1px solid #e2e8f0; } .mfa-cell { display: flex; align-items: center; gap: 0.4rem; .mfa-dot { width: 6px; height: 6px; border-radius: 50%; background: #ef4444; &.enabled { background: #16a34a; } } .btn-toggle-mfa { background: #ffffff; border: 1px solid #cbd5e1; color: #475569; border-radius: 4px; font-size: 0.68rem; padding: 0.1rem 0.35rem; cursor: pointer; } } .status-chip { padding: 0.15rem 0.45rem; border-radius: 9999px; font-size: 0.7rem; font-weight: 700; &.active { background: #dcfce7; color: #15803d; } &.deactivated { background: #fef2f2; color: #b91c1c; } } .btn-act-edit { background: #f1f5f9; color: #334155; border: 1px solid #cbd5e1; border-radius: 4px; padding: 0.25rem 0.5rem; font-size: 0.72rem; cursor: pointer; margin-right: 0.35rem; } .btn-act-deactivate { background: #fef2f2; color: #b91c1c; border: 1px solid #fecaca; border-radius: 4px; padding: 0.25rem 0.5rem; font-size: 0.72rem; cursor: pointer; } .btn-act-activate { background: #dcfce7; color: #15803d; border: 1px solid #bbf7d0; border-radius: 4px; padding: 0.25rem 0.5rem; font-size: 0.72rem; cursor: pointer; } .btn-act-revoke { background: #fee2e2; color: #b91c1c; border: 1px solid #fca5a5; border-radius: 4px; padding: 0.25rem 0.6rem; font-size: 0.72rem; font-weight: 600; cursor: pointer; &:hover { background: #fecaca; } } .deactivated-row { opacity: 0.6; } }
    .section-container { margin-top: 1rem; .section-header { margin-bottom: 0.75rem; h3 { margin: 0; font-size: 1.05rem; color: #0f172a; } .section-sub { font-size: 0.8rem; color: #64748b; } } .empty-invites { padding: 1.5rem; text-align: center; color: #64748b; font-size: 0.85rem; } }
    .modal-backdrop { position: fixed; inset: 0; background: rgba(15,23,42,0.6); backdrop-filter: blur(3px); z-index: 100; }
    .user-modal-card { position: fixed; top: 50%; left: 50%; transform: translate(-50%,-50%); width: 460px; background: #ffffff; border: 1px solid #cbd5e1; border-radius: 12px; padding: 1.5rem; box-shadow: 0 10px 30px rgba(0,0,0,0.15); z-index: 105; h3 { margin: 0 0 0.25rem 0; font-size: 1.1rem; color: #0f172a; } .modal-sub { margin: 0 0 1rem 0; font-size: 0.8rem; color: #64748b; } .session-revocation-warning, .token-warning { background: #fffbe8; border: 1px solid #fde68a; border-radius: 6px; padding: 0.75rem; font-size: 0.8rem; color: #92400e; margin-bottom: 1rem; strong { display: block; margin-bottom: 0.2rem; } p { margin: 0; line-height: 1.35; } } .token-warning { background: #eff6ff; border-color: #bfdbfe; color: #1e40af; } .token-display-box { background: #f8fafc; border: 1px dashed #94a3b8; border-radius: 6px; padding: 0.75rem; word-break: break-all; font-size: 0.78rem; color: #0f172a; margin-bottom: 1rem; } .token-header { display: flex; align-items: center; gap: 0.5rem; margin-bottom: 0.5rem; .key-icon { font-size: 1.25rem; } } .form-group { margin-bottom: 1rem; label { font-size: 0.78rem; color: #475569; display: block; margin-bottom: 0.35rem; } .modal-input, .modal-select { width: 100%; background: #f8fafc; border: 1px solid #cbd5e1; color: #0f172a; padding: 0.5rem; border-radius: 6px; box-sizing: border-box; } } .modal-actions { display: flex; justify-content: flex-end; gap: 0.75rem; margin-top: 1.25rem; .btn-secondary { background: #f1f5f9; color: #475569; border: 1px solid #cbd5e1; border-radius: 6px; padding: 0.5rem 1rem; font-size: 0.82rem; cursor: pointer; } } }
    .toast-popup { position: fixed; bottom: 2rem; right: 2rem; z-index: 300; background: #15803d; color: #ffffff; padding: 0.75rem 1.25rem; border-radius: 8px; font-weight: 600; font-size: 0.85rem; }
  `]
})
export class AdminUsers implements OnInit {
  private readonly adminService = inject(HttpAdminService);

  searchTerm = '';
  selectedRole = 'all';
  selectedStatus = 'all';

  showInviteModal = false;
  // Canonical Roles (Part 0.1)
  availableRoles: { role: string; label: string }[] = [
    { role: 'Admin', label: 'Admin (Full Administrative Access)' },
    { role: 'Reviewer', label: 'Reviewer (Verify & Edit Extractions)' },
    { role: 'Analyst', label: 'Analyst (Query & Analysis)' },
    { role: 'Auditor', label: 'Auditor (Compliance & Read-only Access)' },
    { role: 'contributor', label: 'contributor (Upload Documents)' },
    { role: 'approver', label: 'approver (Final Sign-off & Rule Override)' },
    { role: 'platform_operator', label: 'platform_operator (System Management)' },
  ];

  inviteEmail = '';
  inviteRole = 'Reviewer';
  isInviting = signal(false);
  oneTimeInviteToken: string | null = null;

  // Pending Invitations (D.1)
  pendingInvitations = signal<PendingInvitation[]>([]);
  isRevoking = signal(false);

  // Role Change Modal (D.1)
  showRoleModal = false;
  selectedUserForRole: UserAccount | null = null;
  newSelectedRole = 'Reviewer';
  isUpdatingRole = signal(false);

  toastMessage: string | null = null;

  users: UserAccount[] = [
    { id: 'USR-1', name: 'Abhishek Yadav', email: 'admin@docnexa.io', role: 'org_admin', workspaceScope: 'All Workspaces (Global)', status: 'active', mfaEnabled: true, mfaRequired: true, lastActive: 'Just now' },
    { id: 'USR-2', name: 'Rahul Sharma', email: 'reviewer@docnexa.io', role: 'reviewer', workspaceScope: 'Finance & Accounting Workspace', status: 'active', mfaEnabled: true, mfaRequired: false, lastActive: '12 min ago' },
    { id: 'USR-3', name: 'Priya Mehta', email: 'approver@docnexa.io', role: 'approver', workspaceScope: 'Finance & Accounting Workspace', status: 'active', mfaEnabled: true, mfaRequired: true, lastActive: '34 min ago' },
    { id: 'USR-4', name: 'Neha Verma', email: 'contributor@docnexa.io', role: 'contributor', workspaceScope: 'Operations Workspace', status: 'active', mfaEnabled: false, mfaRequired: false, lastActive: '1 hour ago' },
    { id: 'USR-5', name: 'Arjun Kapoor', email: 'auditor@docnexa.io', role: 'auditor', workspaceScope: 'All Workspaces (Global)', status: 'active', mfaEnabled: true, mfaRequired: false, lastActive: '2 hours ago' },
  ];

  ngOnInit(): void {
    this.loadPendingInvitations();
    this.adminService.getRoles().subscribe({
      next: (res) => {
        if (res.rolesDetails && res.rolesDetails.length > 0) {
          this.availableRoles = res.rolesDetails.map(r => ({ role: r.role, label: `${r.label || r.role} (${r.role})` }));
        } else if (res.roles && res.roles.length > 0) {
          this.availableRoles = res.roles.map(r => ({ role: r, label: r }));
        }
      },
    });
  }

  get filteredUsers(): UserAccount[] {
    const s = this.searchTerm.trim().toLowerCase();
    return this.users.filter(u => {
      const matchSearch = !s || u.name.toLowerCase().includes(s) || u.email.toLowerCase().includes(s) || u.workspaceScope.toLowerCase().includes(s);
      const matchRole = this.selectedRole === 'all' || u.role === this.selectedRole;
      const matchStatus = this.selectedStatus === 'all' || u.status === this.selectedStatus;
      return matchSearch && matchRole && matchStatus;
    });
  }

  loadPendingInvitations(): void {
    this.adminService.listPendingInvitations().subscribe({
      next: (invites: PendingInvitation[]) => {
        this.pendingInvitations.set(invites);
      },
      error: () => {
        this.pendingInvitations.set([]);
      },
    });
  }

  openInviteModal(): void {
    this.inviteEmail = '';
    this.inviteRole = 'reviewer';
    this.showInviteModal = true;
  }

  sendInvitation(): void {
    if (!this.inviteEmail) return;
    this.isInviting.set(true);

    this.adminService.inviteUser(this.inviteEmail.trim(), this.inviteRole).subscribe({
      next: (res) => {
        this.isInviting.set(false);
        this.showInviteModal = false;
        // Hold token strictly in memory, never persisted
        this.oneTimeInviteToken = res.inviteToken || null;
        this.showToast(`Invitation created for ${this.inviteEmail}`);
        this.loadPendingInvitations();
      },
      error: (err) => {
        this.isInviting.set(false);
        this.showToast(`Invitation failed: ${err?.error?.message || err?.message || 'Error'}`);
      },
    });
  }

  getInviteUrl(): string {
    const origin = typeof window !== 'undefined' ? window.location.origin : 'https://app.docintel.io';
    return `${origin}/accept-invite?token=${this.oneTimeInviteToken}`;
  }

  copyInviteLink(): void {
    if (typeof navigator !== 'undefined' && navigator.clipboard) {
      navigator.clipboard.writeText(this.getInviteUrl());
      this.showToast('Copied single-use invitation link to clipboard!');
    }
  }

  revokeInvite(invitationId: string): void {
    if (!confirm('Are you sure you want to revoke this invitation? The recipient will not be able to accept it.')) {
      return;
    }
    this.isRevoking.set(true);
    this.adminService.revokeInvitation(invitationId).subscribe({
      next: () => {
        this.isRevoking.set(false);
        this.showToast('Invitation revoked successfully');
        this.loadPendingInvitations();
      },
      error: (err) => {
        this.isRevoking.set(false);
        this.showToast(`Failed to revoke invitation: ${err?.error?.message || err?.message || 'Error'}`);
      },
    });
  }

  openEditRoleModal(user: UserAccount): void {
    this.selectedUserForRole = user;
    this.newSelectedRole = user.role;
    this.showRoleModal = true;
  }

  confirmRoleChange(): void {
    if (!this.selectedUserForRole) return;
    this.isUpdatingRole.set(true);
    const userId = this.selectedUserForRole.id;
    const newRole = this.newSelectedRole;

    this.adminService.updateUserRole(userId, newRole).subscribe({
      next: () => {
        this.isUpdatingRole.set(false);
        this.showRoleModal = false;
        if (this.selectedUserForRole) {
          this.selectedUserForRole.role = newRole as any;
        }
        this.showToast(`Role changed to ${newRole.toUpperCase()}. Active sessions revoked for ${this.selectedUserForRole?.name}.`);
      },
      error: (err) => {
        this.isUpdatingRole.set(false);
        this.showToast(`Role update failed: ${err?.error?.message || err?.message || 'Error'}`);
      },
    });
  }

  confirmDeactivateUser(user: UserAccount): void {
    if (confirm(`Deactivate access for ${user.name}? Access will be revoked immediately.`)) {
      user.status = 'deactivated';
      this.showToast(`Deactivated access for ${user.name}.`);
    }
  }

  reactivateUser(user: UserAccount): void {
    user.status = 'active';
    this.showToast(`Reactivated user account for ${user.name}`);
  }

  toggleRequireMfa(user: UserAccount): void {
    user.mfaRequired = !user.mfaRequired;
    this.showToast(`MFA enforcement policy updated for ${user.name}`);
  }

  showToast(msg: string): void {
    this.toastMessage = msg;
    setTimeout(() => { if (this.toastMessage === msg) this.toastMessage = null; }, 3500);
  }
}
