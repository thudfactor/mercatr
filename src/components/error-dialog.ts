import { LitElement, html, css } from 'lit';
import { customElement, property, query } from 'lit/decorators.js';

@customElement('error-dialog')
export class ErrorDialog extends LitElement {
  @property({ type: String }) message = '';
  @query('dialog') private _dialog!: HTMLDialogElement;

  static styles = css`
    dialog {
      background: var(--color-surface);
      border: 1px solid var(--color-border-subtle);
      border-radius: 8px;
      color: var(--color-foreground);
      max-width: 440px;
      width: 90%;
      padding: 0;
    }

    dialog::backdrop {
      background: var(--color-overlay-dark);
    }

    .dialog-inner {
      padding: 1.5rem;
    }

    h2 {
      font-size: 1rem;
      margin-bottom: 0.75rem;
      color: var(--color-error-heading);
    }

    p {
      font-size: 0.9rem;
      color: var(--color-text-secondary);
      line-height: 1.5;
    }

    .dialog-actions {
      padding: 0.75rem 1.5rem;
      border-top: 1px solid var(--color-border);
    }

    button {
      background: var(--color-border);
      border: 1px solid var(--color-border-muted);
      border-radius: 4px;
      color: var(--color-text-muted);
      cursor: pointer;
      font-size: 0.85rem;
      padding: 0.45rem 0.9rem;
    }

    button:hover {
      background: var(--color-border-subtle);
    }
  `;

  show(message: string) {
    this.message = message;
    this._dialog.showModal();
  }

  private _close() {
    this._dialog.close();
  }

  render() {
    return html`
      <dialog aria-labelledby="error-title">
        <div class="dialog-inner">
          <h2 id="error-title">Error</h2>
          <p>${this.message}</p>
        </div>
        <div class="dialog-actions">
          <button type="button" @click=${this._close}>Dismiss</button>
        </div>
      </dialog>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'error-dialog': ErrorDialog;
  }
}
