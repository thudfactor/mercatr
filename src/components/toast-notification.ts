import { LitElement, html, css } from 'lit';
import { customElement, property } from 'lit/decorators.js';

@customElement('toast-notification')
export class ToastNotification extends LitElement {
  @property({ type: String }) message = '';
  @property({ type: String }) variant: 'info' | 'error' = 'info';
  @property({ type: Boolean, reflect: true }) visible = false;

  private _timer: ReturnType<typeof setTimeout> | null = null;

  static styles = css`
    :host {
      position: fixed;
      bottom: 1.5rem;
      right: 1.5rem;
      z-index: 200;
      max-width: 320px;
      pointer-events: none;
    }

    div {
      background: var(--color-surface-mid);
      border: 1px solid var(--color-border-muted);
      border-radius: 6px;
      color: var(--color-foreground);
      font-size: 0.875rem;
      padding: 0.75rem 1rem;
      opacity: 0;
      transform: translateY(0.5rem);
      transition: opacity 0.2s, transform 0.2s;
    }

    :host([visible]) div {
      opacity: 1;
      transform: translateY(0);
    }

    div.error {
      border-color: var(--color-error-border);
      color: var(--color-error-text);
    }
  `;

  show(message: string, variant: 'info' | 'error' = 'info') {
    if (this._timer) clearTimeout(this._timer);
    this.message = message;
    this.variant = variant;
    this.visible = true;
    this._timer = setTimeout(() => { this.visible = false; }, 3000);
  }

  render() {
    return html`
      <div class=${this.variant} role="status" aria-live="polite">
        ${this.message}
      </div>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'toast-notification': ToastNotification;
  }
}
