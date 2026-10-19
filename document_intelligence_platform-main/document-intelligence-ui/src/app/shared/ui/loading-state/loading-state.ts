import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';

export type LoadingLayout =
  | 'default'
  | 'spinner'
  | 'cards'
  | 'table'
  | 'split-pane'
  | 'detail'
  | 'dashboard';

@Component({
  selector: 'app-loading-state',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './loading-state.html',
  styleUrl: './loading-state.scss',
})
export class LoadingState {
  @Input() message = 'Loading data...';
  @Input() layout: LoadingLayout = 'default';
  @Input() rows = 4;
}