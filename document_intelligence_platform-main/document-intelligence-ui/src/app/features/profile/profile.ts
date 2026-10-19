import { Component, OnInit, inject, signal, ElementRef, ViewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { AuthService, SessionItemDto, UserProfileDto, UpdateProfileDto } from '../../core/services/auth';

export interface UserProfileData {
  // Personal Info
  firstName: string;
  lastName: string;
  workEmail: string;
  phoneNumber: string;
  preferredName: string;
  dateOfBirth: string;

  // Employment Details
  employeeId: string;
  employmentStatus: string;
  designation: string;
  manager: string;
  department: string;
  location: string;
  employeeType: string;
  dateJoined: string;

  // Account & Security
  passwordMasked: string;
  mfaEnabled: boolean;
  lastLogin: string;
  lastPasswordChange: string;
  activeSessionsCount: number;

  // Permissions & Preferences
  role: string;
  accessScope: string;
  timezone: string;
  language: string;
  emailAlerts: boolean;
  inAppNotifications: boolean;

  // Visual Assets
  coverImageUrl: string;
  avatarImageUrl: string;
}

@Component({
  selector: 'app-profile',
  standalone: true,
  imports: [CommonModule, FormsModule, ReactiveFormsModule],
  templateUrl: './profile.html',
  styleUrl: './profile.scss',
})
export class Profile implements OnInit {
  private readonly authService = inject(AuthService);
  private readonly fb = inject(FormBuilder);
  private readonly router = inject(Router);

  @ViewChild('coverFileInput') coverFileInput!: ElementRef<HTMLInputElement>;
  @ViewChild('avatarFileInput') avatarFileInput!: ElementRef<HTMLInputElement>;

  readonly profileData = signal<UserProfileData>({
    firstName: 'Olivia',
    lastName: 'Anderson',
    workEmail: 'olivia.anderson@acme-enterprise.example',
    phoneNumber: '+1 (555) 014-2280',
    preferredName: 'Olivia',
    dateOfBirth: 'Mar 15, 1990',

    employeeId: 'ACM-EMP-00241',
    employmentStatus: 'Active',
    designation: 'Senior Document Operations Manager',
    manager: 'Ethan Brooks',
    department: 'Document Intelligence',
    location: 'New York Office',
    employeeType: 'Full-time',
    dateJoined: '12 Feb 2022',

    passwordMasked: '••••••••••••••',
    mfaEnabled: true,
    lastLogin: 'Today, 10:42 AM',
    lastPasswordChange: '18 Aug 2026',
    activeSessionsCount: 2,

    role: 'Org Admin',
    accessScope: 'Acme Enterprise',
    timezone: 'America/New_York',
    language: 'English (US)',
    emailAlerts: true,
    inAppNotifications: true,

    coverImageUrl: '/profile-cover.jpg',
    avatarImageUrl: '/profile-avatar.jpg',
  });

  // Modals & UI State
  isEditProfileModalOpen = signal(false);
  isChangePasswordModalOpen = signal(false);
  isMfaModalOpen = signal(false);
  isSessionsModalOpen = signal(false);
  toastMessage = signal<string | null>(null);
  toastType = signal<'success' | 'info' | 'warning'>('success');

  // Reactive Forms
  editProfileForm!: FormGroup;
  changePasswordForm!: FormGroup;

  // Sessions state
  activeSessions = signal<SessionItemDto[]>([]);
  isLoadingSessions = signal<boolean>(false);

  ngOnInit(): void {
    const user = this.authService.currentUser();
    if (user) {
      const parts = (user.name || '').trim().split(' ');
      const fName = parts[0] || 'Olivia';
      const lName = parts.length > 1 ? parts.slice(1).join(' ') : 'Anderson';
      const roleDisplayName = user.role === 'org_admin' ? 'Org Admin' : (user.role || 'Org Admin');
      const orgName = user.organization || 'Acme Enterprise';

      this.profileData.update((prev) => ({
        ...prev,
        firstName: fName,
        lastName: lName,
        preferredName: fName,
        workEmail: user.email || prev.workEmail,
        role: roleDisplayName,
        accessScope: orgName,
      }));
    }

    this.initForms();
    this.loadProfile();
  }

  loadProfile(): void {
    this.authService.getProfile().then((res) => {
      if (res.success && res.profile) {
        const p = res.profile;
        this.profileData.update((prev) => ({
          ...prev,
          firstName: p.firstName || prev.firstName,
          lastName: p.lastName || prev.lastName,
          preferredName: p.preferredName || p.firstName || prev.preferredName,
          workEmail: p.email || prev.workEmail,
          phoneNumber: p.phoneNumber || prev.phoneNumber,
          dateOfBirth: p.dateOfBirth || prev.dateOfBirth,
          employeeId: p.employeeId || prev.employeeId,
          employmentStatus: p.employmentStatus || prev.employmentStatus,
          designation: p.designation || prev.designation,
          manager: p.managerName || prev.manager,
          department: p.department || prev.department,
          location: p.location || prev.location,
          employeeType: p.employeeType || prev.employeeType,
          dateJoined: p.dateJoined ? new Date(p.dateJoined).toLocaleDateString('en-US', { day: '2-digit', month: 'short', year: 'numeric' }) : prev.dateJoined,
          mfaEnabled: p.mfaEnabled ?? prev.mfaEnabled,
          lastLogin: p.lastLoginAt ? new Date(p.lastLoginAt).toLocaleString() : prev.lastLogin,
          lastPasswordChange: p.lastPasswordChangeAt ? new Date(p.lastPasswordChangeAt).toLocaleDateString('en-US', { day: '2-digit', month: 'short', year: 'numeric' }) : prev.lastPasswordChange,
          activeSessionsCount: p.activeSessionsCount ?? prev.activeSessionsCount,
          role: p.role || prev.role,
          accessScope: p.accessScope || prev.accessScope,
          timezone: p.timezone || prev.timezone,
          language: p.language || prev.language,
          emailAlerts: p.emailAlerts ?? prev.emailAlerts,
          inAppNotifications: p.inAppNotifications ?? prev.inAppNotifications,
          avatarImageUrl: p.avatarUrl || prev.avatarImageUrl,
          coverImageUrl: p.coverUrl || prev.coverImageUrl,
        }));
      }
    }).catch(() => {});
  }

  private initForms(): void {
    const current = this.profileData();
    this.editProfileForm = this.fb.group({
      firstName: [current.firstName, [Validators.required, Validators.pattern(/^[A-Za-z\s'-]{2,50}$/)]],
      lastName: [current.lastName, [Validators.required, Validators.pattern(/^[A-Za-z\s'-]{2,50}$/)]],
      workEmail: [{ value: current.workEmail, disabled: true }, [Validators.required, Validators.email]],
      phoneNumber: [current.phoneNumber, [Validators.required, Validators.pattern(/^\+?[0-9\s\-\(\)]{7,20}$/)]],
      preferredName: [current.preferredName],
      dateOfBirth: [current.dateOfBirth],
    });

    this.changePasswordForm = this.fb.group({
      currentPassword: ['', [Validators.required]],
      newPassword: [
        '',
        [
          Validators.required,
          Validators.minLength(12),
          Validators.pattern(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&_\-#])[A-Za-z\d@$!%*?&_\-#]{12,128}$/),
        ],
      ],
      confirmPassword: ['', [Validators.required]],
    });
  }

  // Cover Image Upload Handler
  triggerCoverFileInput(): void {
    this.coverFileInput?.nativeElement?.click();
  }

  onCoverFileSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    if (!input.files || input.files.length === 0) return;

    const file = input.files[0];
    if (!this.validateImageFile(file, 5 * 1024 * 1024)) return;

    const previewUrl = URL.createObjectURL(file);
    this.profileData.update((prev) => ({
      ...prev,
      coverImageUrl: previewUrl,
    }));

    this.showToast('Cover image updated for this session.', 'info');
    input.value = '';
  }

  // Avatar Upload Handler
  triggerAvatarFileInput(): void {
    this.avatarFileInput?.nativeElement?.click();
  }

  onAvatarFileSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    if (!input.files || input.files.length === 0) return;

    const file = input.files[0];
    if (!this.validateImageFile(file, 2 * 1024 * 1024)) return;

    this.authService.uploadAvatar(file).then((res) => {
      if (res.success && res.avatarUrl) {
        this.profileData.update((prev) => ({
          ...prev,
          avatarImageUrl: res.avatarUrl!,
        }));
        this.showToast('Profile photo updated successfully!', 'success');
      } else {
        this.showToast(res.message || 'Failed to upload avatar.', 'warning');
      }
    }).catch((err) => {
      this.showToast(err.message || 'Network error uploading avatar.', 'warning');
    });
    input.value = '';
  }

  onAvatarError(event: Event): void {
    const img = event.target as HTMLImageElement;
    img.src = '/docnexa-icon-transparent.png';
  }

  private validateImageFile(file: File, maxSizeBytes: number): boolean {
    const validTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
    if (!validTypes.includes(file.type)) {
      this.showToast('Invalid file format. Please upload a JPG, PNG, or WebP image.', 'warning');
      return false;
    }

    if (file.size > maxSizeBytes) {
      const mb = Math.round(maxSizeBytes / (1024 * 1024));
      this.showToast(`File size exceeds limit (${mb} MB). Please choose a smaller image.`, 'warning');
      return false;
    }

    return true;
  }

  // Date of birth clearing
  clearDob(): void {
    this.profileData.update((prev) => ({ ...prev, dateOfBirth: '' }));
    this.editProfileForm.patchValue({ dateOfBirth: '' });
    this.showToast('Cleared optional date of birth field', 'info');
  }

  // Edit Profile Modal
  openEditProfileModal(): void {
    const current = this.profileData();
    this.editProfileForm.patchValue({
      firstName: current.firstName,
      lastName: current.lastName,
      workEmail: current.workEmail,
      phoneNumber: current.phoneNumber,
      preferredName: current.preferredName,
      dateOfBirth: current.dateOfBirth,
    });
    this.isEditProfileModalOpen.set(true);
  }

  closeEditProfileModal(): void {
    this.isEditProfileModalOpen.set(false);
  }

  saveProfileChanges(): void {
    if (this.editProfileForm.invalid) {
      this.editProfileForm.markAllAsTouched();
      this.showToast('Please correct validation errors before saving (letters only for names, valid phone format).', 'warning');
      return;
    }

    const val = this.editProfileForm.getRawValue();
    const updateDto: UpdateProfileDto = {
      firstName: val.firstName.trim(),
      lastName: val.lastName.trim(),
      phoneNumber: val.phoneNumber.trim(),
      preferredName: val.preferredName?.trim() || val.firstName.trim(),
      dateOfBirth: val.dateOfBirth || undefined,
    };

    this.authService.updateProfile(updateDto).then((res) => {
      if (res.success && res.profile) {
        const p = res.profile;
        this.profileData.update((prev) => ({
          ...prev,
          firstName: p.firstName,
          lastName: p.lastName,
          preferredName: p.preferredName || p.firstName,
          phoneNumber: p.phoneNumber || '',
          dateOfBirth: p.dateOfBirth || '',
        }));
        this.isEditProfileModalOpen.set(false);
        this.showToast(res.message || 'Personal information updated successfully!', 'success');
      } else {
        this.showToast(res.message || 'Failed to update profile.', 'warning');
      }
    }).catch((err) => {
      this.showToast(err.message || 'Network error updating profile.', 'warning');
    });
  }

  // Change Password Modal
  openChangePasswordModal(): void {
    this.changePasswordForm.reset();
    this.isChangePasswordModalOpen.set(true);
  }

  closeChangePasswordModal(): void {
    this.isChangePasswordModalOpen.set(false);
  }

  submitPasswordChange(): void {
    if (this.changePasswordForm.invalid) {
      this.changePasswordForm.markAllAsTouched();
      this.showToast('Please fulfill all password requirements: minimum 12 characters, including uppercase, lowercase, number, and special character.', 'warning');
      return;
    }

    const { currentPassword, newPassword, confirmPassword } = this.changePasswordForm.value;
    if (newPassword !== confirmPassword) {
      this.showToast('New passwords do not match.', 'warning');
      return;
    }

    this.authService.changePassword(currentPassword, newPassword).then((res) => {
      if (res.success) {
        this.profileData.update((prev) => ({
          ...prev,
          lastPasswordChange: 'Just now',
          activeSessionsCount: 1,
        }));
        this.isChangePasswordModalOpen.set(false);
        this.showToast(res.message || 'Password changed successfully! A confirmation notice has been dispatched to your email.', 'success');
      } else {
        this.showToast(res.message || 'Password update failed. Verify current password.', 'warning');
      }
    }).catch((err) => {
      this.showToast(err.message || 'Network error changing password.', 'warning');
    });
  }

  // D.4: Multi-Step MFA State
  mfaStep = signal<'overview' | 're-enroll-auth' | 'enroll' | 'recovery-codes' | 'disable'>('overview');
  enrollSecret = signal<string>('');
  enrollQrCodeUrl = signal<string>('');
  enrollCurrentCode = '';
  verifyCode = '';
  disableCode = '';
  recoveryCodes = signal<string[]>([]);
  savedCodesConfirmed = false;
  isMfaLoading = signal(false);
  mfaErrorMessage = signal<string | null>(null);

  openMfaModal(): void {
    this.mfaStep.set('overview');
    this.enrollSecret.set('');
    this.enrollQrCodeUrl.set('');
    this.enrollCurrentCode = '';
    this.verifyCode = '';
    this.disableCode = '';
    this.recoveryCodes.set([]);
    this.savedCodesConfirmed = false;
    this.mfaErrorMessage.set(null);
    this.isMfaModalOpen.set(true);
  }

  closeMfaModal(): void {
    this.isMfaModalOpen.set(false);
    this.recoveryCodes.set([]); // Flush recovery codes from memory
  }

  startMfaEnrollment(): void {
    if (this.profileData().mfaEnabled) {
      // Re-enrollment while enabled requires current code
      this.mfaStep.set('re-enroll-auth');
      return;
    }
    this.executeEnroll();
  }

  submitReEnrollAuth(): void {
    if (!this.enrollCurrentCode.trim()) {
      this.mfaErrorMessage.set('Please enter your current 6-digit verification code.');
      return;
    }
    this.executeEnroll(this.enrollCurrentCode.trim());
  }

  private executeEnroll(currentCode?: string): void {
    this.isMfaLoading.set(true);
    this.mfaErrorMessage.set(null);

    this.authService.enrollMfa(currentCode).then((res) => {
      this.isMfaLoading.set(false);
      if (res.success && res.secret) {
        this.enrollSecret.set(res.secret);
        this.enrollQrCodeUrl.set(res.qrCodeDataUrl || '');
        this.mfaStep.set('enroll');
      } else {
        this.mfaErrorMessage.set(res.message || 'MFA enrollment failed. Ensure current passcode is valid.');
      }
    }).catch((err) => {
      this.isMfaLoading.set(false);
      this.mfaErrorMessage.set(err?.message || 'Failed to connect to authentication service.');
    });
  }

  submitVerifyEnrollment(): void {
    if (!this.verifyCode.trim() || this.verifyCode.trim().length < 6) {
      this.mfaErrorMessage.set('Please enter a valid 6-digit TOTP code.');
      return;
    }

    this.isMfaLoading.set(true);
    this.mfaErrorMessage.set(null);

    this.authService.verifyMfaEnrollment(this.verifyCode.trim()).then((res) => {
      this.isMfaLoading.set(false);
      if (res.success && res.recoveryCodes && res.recoveryCodes.length > 0) {
        this.recoveryCodes.set(res.recoveryCodes);
        this.mfaStep.set('recovery-codes');
      } else {
        this.mfaErrorMessage.set(res.message || 'Invalid verification code. Please check your authenticator clock.');
      }
    }).catch((err) => {
      this.isMfaLoading.set(false);
      this.mfaErrorMessage.set(err?.message || 'Verification network error.');
    });
  }

  copyRecoveryCodes(): void {
    if (typeof navigator !== 'undefined' && navigator.clipboard) {
      const text = this.recoveryCodes().join('\n');
      navigator.clipboard.writeText(text);
      this.showToast('Copied 8 recovery codes to clipboard!', 'info');
    }
  }

  downloadRecoveryCodesTxt(): void {
    if (typeof window === 'undefined') return;
    const content = `DocuNexa MFA Emergency Recovery Codes\nGenerated: ${new Date().toISOString()}\n\n` +
      this.recoveryCodes().map((code, idx) => `Code ${idx + 1}: ${code}`).join('\n') +
      `\n\nEach code can be used once if you lose access to your authenticator app.\nStore this in a secure password vault.\n`;

    const blob = new Blob([content], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `docunexa-mfa-recovery-codes-${Date.now()}.txt`;
    a.click();
    URL.revokeObjectURL(url);
    this.showToast('Downloaded recovery codes .txt file!', 'info');
  }

  confirmSavedRecoveryCodes(): void {
    if (!this.savedCodesConfirmed) return;
    this.profileData.update((prev) => ({ ...prev, mfaEnabled: true }));
    this.recoveryCodes.set([]); // Wipe from memory
    this.closeMfaModal();
    this.showToast('MFA setup complete! Two-Factor Authentication is now active on your account.', 'success');
  }

  startDisableMfa(): void {
    this.disableCode = '';
    this.mfaErrorMessage.set(null);
    this.mfaStep.set('disable');
  }

  submitDisableMfa(): void {
    if (!this.disableCode.trim()) {
      this.mfaErrorMessage.set('Please enter your 6-digit TOTP code or recovery code.');
      return;
    }

    this.isMfaLoading.set(true);
    this.mfaErrorMessage.set(null);

    this.authService.disableMfa(this.disableCode.trim()).then((res) => {
      this.isMfaLoading.set(false);
      if (res.success) {
        this.profileData.update((prev) => ({ ...prev, mfaEnabled: false }));
        this.closeMfaModal();
        this.showToast('Two-Factor Authentication (MFA) has been disabled.', 'info');
      } else {
        this.mfaErrorMessage.set(res.message || 'Failed to disable MFA. Incorrect code provided.');
      }
    }).catch((err) => {
      this.isMfaLoading.set(false);
      this.mfaErrorMessage.set(err?.message || 'Error communicating with authentication service.');
    });
  }

  // Manage Sessions Modal
  openSessionsModal(): void {
    this.isSessionsModalOpen.set(true);
    this.loadSessions();
  }

  closeSessionsModal(): void {
    this.isSessionsModalOpen.set(false);
  }

  loadSessions(): void {
    this.isLoadingSessions.set(true);
    this.authService.getSessions().then((res) => {
      this.isLoadingSessions.set(false);
      if (res.success && res.sessions) {
        this.activeSessions.set(res.sessions);
        this.profileData.update((prev) => ({
          ...prev,
          activeSessionsCount: res.sessions!.length,
        }));
      }
    }).catch(() => {
      this.isLoadingSessions.set(false);
    });
  }

  revokeSession(sessionId: string): void {
    this.authService.revokeSession(sessionId).then((res) => {
      if (res.success) {
        this.showToast(res.message || 'Session terminated successfully.', 'success');
        this.loadSessions();
      } else {
        this.showToast(res.message || 'Failed to terminate session.', 'warning');
      }
    }).catch((err) => {
      this.showToast(err.message || 'Network error terminating session.', 'warning');
    });
  }

  revokeOtherSessions(): void {
    this.authService.revokeSession('other').then((res) => {
      if (res.success) {
        this.showToast(res.message || 'All other active sessions have been terminated.', 'success');
        this.loadSessions();
      } else {
        this.showToast(res.message || 'Failed to terminate other sessions.', 'warning');
      }
    }).catch((err) => {
      this.showToast(err.message || 'Network error terminating sessions.', 'warning');
    });
  }

  // Notification Preference toggling
  toggleEmailAlerts(): void {
    this.profileData.update((prev) => ({
      ...prev,
      emailAlerts: !prev.emailAlerts,
    }));
    this.showToast(`Email notifications ${this.profileData().emailAlerts ? 'enabled' : 'disabled'}.`, 'info');
  }

  toggleInAppNotifications(): void {
    this.profileData.update((prev) => ({
      ...prev,
      inAppNotifications: !prev.inAppNotifications,
    }));
    this.showToast(`In-app notifications ${this.profileData().inAppNotifications ? 'enabled' : 'disabled'}.`, 'info');
  }

  // Toast Helper
  showToast(message: string, type: 'success' | 'info' | 'warning' = 'success'): void {
    this.toastMessage.set(message);
    this.toastType.set(type);
    setTimeout(() => {
      if (this.toastMessage() === message) {
        this.toastMessage.set(null);
      }
    }, 4500);
  }
}
