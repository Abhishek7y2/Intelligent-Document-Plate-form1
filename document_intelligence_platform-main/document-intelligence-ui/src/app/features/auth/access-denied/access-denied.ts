import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, ActivatedRoute, RouterModule } from '@angular/router';
import { AuthService } from '../../../core/services/auth.service';

@Component({
  selector: 'app-access-denied',
  standalone: true,
  imports: [CommonModule, RouterModule],
  templateUrl: './access-denied.html',
  styleUrls: ['./access-denied.scss'],
})
export class AccessDenied {
  private router = inject(Router);
  private route = inject(ActivatedRoute);
  private authService = inject(AuthService);

  attemptedUrl = this.route.snapshot.queryParams['attemptedUrl'] || '';
  isDeactivated = this.route.snapshot.queryParams['reason'] === 'deactivated';

  goToDashboard(): void {
    this.router.navigate(['/dashboard']);
  }

  switchAccount(): void {
    this.authService.logout();
  }
}
