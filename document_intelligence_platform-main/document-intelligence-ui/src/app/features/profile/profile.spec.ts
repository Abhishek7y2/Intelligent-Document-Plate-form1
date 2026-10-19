import '@angular/compiler';
import { describe, it, expect, beforeEach } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { Profile } from './profile';
import { AuthService } from '../../core/services/auth';

describe('Profile Component (DocNexa Enterprise Profile Page)', () => {
  let component: Profile;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [Profile],
      providers: [AuthService],
    }).compileComponents();

    const fixture = TestBed.createComponent(Profile);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create the profile component', () => {
    expect(component).toBeDefined();
    expect(component).toBeInstanceOf(Profile);
  });

  it('should initialize with Olivia Anderson profile default data', () => {
    const data = component.profileData();
    expect(data.firstName).toBe('Olivia');
    expect(data.lastName).toBe('Anderson');
    expect(data.employeeId).toBe('ACM-EMP-00241');
    expect(data.role).toBe('Org Admin');
    expect(data.accessScope).toBe('Acme Enterprise');
    expect(data.mfaEnabled).toBe(true);
    expect(data.coverImageUrl).toBe('/profile-cover.jpg');
    expect(data.avatarImageUrl).toBe('/profile-avatar.jpg');
  });

  it('should open and close change password modal', () => {
    expect(component.isChangePasswordModalOpen()).toBe(false);
    component.openChangePasswordModal();
    expect(component.isChangePasswordModalOpen()).toBe(true);
    component.closeChangePasswordModal();
    expect(component.isChangePasswordModalOpen()).toBe(false);
  });

  it('should open and close edit profile modal', () => {
    expect(component.isEditProfileModalOpen()).toBe(false);
    component.openEditProfileModal();
    expect(component.isEditProfileModalOpen()).toBe(true);
    component.closeEditProfileModal();
    expect(component.isEditProfileModalOpen()).toBe(false);
  });

  it('should clear optional date of birth field', () => {
    component.clearDob();
    expect(component.profileData().dateOfBirth).toBe('');
  });

  it('should open and close MFA modal', () => {
    expect(component.isMfaModalOpen()).toBe(false);
    component.openMfaModal();
    expect(component.isMfaModalOpen()).toBe(true);
    component.closeMfaModal();
    expect(component.isMfaModalOpen()).toBe(false);
  });

  it('should toggle notification preferences correctly', () => {
    const initialEmail = component.profileData().emailAlerts;
    component.toggleEmailAlerts();
    expect(component.profileData().emailAlerts).toBe(!initialEmail);

    const initialInApp = component.profileData().inAppNotifications;
    component.toggleInAppNotifications();
    expect(component.profileData().inAppNotifications).toBe(!initialInApp);
  });
});
