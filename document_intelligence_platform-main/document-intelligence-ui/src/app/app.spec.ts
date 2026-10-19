import '@angular/compiler';
import { describe, it, expect } from 'vitest';
import { App } from './app';

describe('App Component', () => {
  it('should instantiate the App component', () => {
    const app = new App();
    expect(app).toBeDefined();
    expect(app).toBeInstanceOf(App);
  });
});
