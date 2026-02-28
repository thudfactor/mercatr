import { LitElement, html, css, nothing } from 'lit';
import { customElement, state, query } from 'lit/decorators.js';
import { unsafeHTML } from 'lit/directives/unsafe-html.js';
import { marked } from 'marked';
import DOMPurify from 'dompurify';
import { resultStyles } from './shared-result-styles.js';

interface Session {
  id: string;
  mode: string;
  inputs: Record<string, string>;
  tracks: { artist: string; track: string }[] | null;
  commentary: string;
  createdAt: string;
  displayName: string;
}

const STORAGE_KEY = 'mercatr:sessions';
const SESSION_LIMIT = 50;

function storageAvailable(): boolean {
  try {
    const key = '__mercatr_test__';
    localStorage.setItem(key, '1');
    localStorage.getItem(key);
    localStorage.removeItem(key);
    return true;
  } catch { return false; }
}

@customElement('history-drawer')
export class HistoryDrawer extends LitElement {
  @state() private _open = false;
  @state() private _sessions: Session[] = [];
  @state() private _detail: Session | null = null;
  @state() private _available = false;

  @query('aside') private _aside!: HTMLElement;

  private _savedScroll = 0;

  static styles = [
    resultStyles,
    css`
      :host { display: contents; }

      .backdrop {
        position: fixed;
        inset: 0;
        background: var(--color-overlay);
        z-index: 99;
      }

      aside {
        position: fixed;
        top: 0;
        right: 0;
        height: 100%;
        width: 360px;
        background: var(--color-surface-deep);
        border-left: 1px solid var(--color-border);
        z-index: 100;
        display: flex;
        flex-direction: column;
        transform: translateX(100%);
        transition: transform 0.25s ease;
        visibility: hidden;
      }

      aside.open {
        transform: translateX(0);
        visibility: visible;
      }

      .drawer-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        padding: 1rem 1.25rem;
        border-bottom: 1px solid var(--color-border);
        flex-shrink: 0;
      }

      .drawer-header h2 {
        font-size: 0.95rem;
        font-weight: 600;
        color: var(--color-foreground);
      }

      .drawer-close {
        background: none;
        border: none;
        color: var(--color-foreground);
        cursor: pointer;
        font-size: 1.4rem;
        line-height: 1;
        padding: 0.1rem 0.35rem;
        border-radius: 3px;
        transition: color 0.15s;
      }

      .drawer-close:hover { color: var(--color-text-muted); }

      .drawer-body {
        flex: 1;
        overflow-y: auto;
        display: flex;
        flex-direction: column;
      }

      .list-view {
        display: flex;
        flex-direction: column;
        flex: 1;
      }

      .session-list {
        list-style: none;
        padding: 0;
        flex: 1;
      }

      .session-list li {
        border-bottom: 1px solid var(--color-surface-mid);
      }

      .session-list li button {
        background: none;
        border: none;
        color: var(--color-text-muted);
        cursor: pointer;
        font-size: 0.875rem;
        padding: 0.75rem 1.25rem;
        text-align: left;
        width: 100%;
        transition: background 0.1s;
      }

      .session-list li button:hover { background: var(--color-surface-mid); color: var(--color-foreground); }

      .empty {
        color: var(--color-foreground);
        font-size: 0.875rem;
        padding: 2rem 1.25rem;
        text-align: center;
        line-height: 1.6;
      }

      .settings {
        border-top: 1px solid var(--color-border);
        padding: 1rem 1.25rem;
        flex-shrink: 0;
      }

      .settings p {
        color: var(--color-foreground);
        font-size: 0.8rem;
        margin-bottom: 0.6rem;
        min-height: 1em;
      }

      .clear-btn {
        background: none;
        border: 1px solid var(--color-danger-border);
        border-radius: 4px;
        color: var(--color-danger-text);
        cursor: pointer;
        font-size: 0.8rem;
        padding: 0.4rem 0.75rem;
        transition: background 0.15s;
      }

      .clear-btn:hover { background: var(--color-danger-bg-hover); }

      /* Detail view */
      .detail-view {
        display: flex;
        flex-direction: column;
        flex: 1;
      }

      .detail-header {
        padding: 1rem 1.25rem;
        border-bottom: 1px solid var(--color-border);
        flex-shrink: 0;
      }

      .detail-back {
        background: none;
        border: none;
        color: var(--color-foreground);
        cursor: pointer;
        font-size: 0.8rem;
        padding: 0;
        margin-bottom: 0.6rem;
        display: block;
        transition: color 0.15s;
      }

      .detail-back:hover { color: var(--color-text-muted); }

      .detail-header h3 {
        color: var(--color-foreground);
        font-size: 0.95rem;
        font-weight: 600;
        margin-bottom: 0.25rem;
      }

      .detail-meta {
        color: var(--color-foreground);
        font-size: 0.8rem;
      }

      .detail-content {
        padding: 0 1.25rem;
        flex: 1;
        overflow-y: auto;
      }

      .detail-content .results {
        margin-top: 1rem;
        font-size: 0.85rem;
      }

      .detail-actions {
        padding: 0.75rem 1.25rem 1.25rem;
        flex-shrink: 0;
        border-top: 1px solid var(--color-border);
      }

      .download-btn {
        background: var(--color-success-bg);
        border: 1px solid var(--color-success-border);
        border-radius: 4px;
        color: var(--color-success-text);
        cursor: pointer;
        font-size: 0.85rem;
        padding: 0.5rem 0.9rem;
        transition: background 0.15s;
      }

      .download-btn:hover:not(:disabled) { background: var(--color-success-bg-hover); }
      .download-btn:disabled { opacity: 0.5; cursor: not-allowed; }
    `,
  ];

  connectedCallback() {
    super.connectedCallback();
    this._available = storageAvailable();
    if (this._available) this._loadSessions();
    document.addEventListener('keydown', this._onDocKeydown);
  }

  disconnectedCallback() {
    super.disconnectedCallback();
    document.removeEventListener('keydown', this._onDocKeydown);
  }

  get sessionCount() {
    return this._sessions.length;
  }

  get storageAvailable() {
    return this._available;
  }

  open() {
    if (!this._available) return;
    this._loadSessions();
    this._detail = null;
    this._open = true;
    this.updateComplete.then(() => {
      this.shadowRoot?.querySelector<HTMLButtonElement>('.drawer-close')?.focus();
    });
  }

  close() {
    this._open = false;
    this.dispatchEvent(new CustomEvent('drawer-closed', { bubbles: true, composed: true }));
  }

  addSession(session: Session) {
    if (!this._available) return false;
    try {
      const existing = this._readStorage();
      const updated = [session, ...existing].slice(0, SESSION_LIMIT);
      localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
      this._sessions = updated;
      return true;
    } catch (e) {
      if (e instanceof DOMException && e.name === 'QuotaExceededError') return false;
      return false;
    }
  }

  private _loadSessions() {
    this._sessions = this._readStorage();
  }

  private _readStorage(): Session[] {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      return raw ? JSON.parse(raw) : [];
    } catch { return []; }
  }

  private _estimateSize() {
    const raw = localStorage.getItem(STORAGE_KEY) ?? '';
    return Math.round(new Blob([raw]).size / 1024);
  }

  private _clearHistory() {
    if (!confirm('Clear all session history? This cannot be undone.')) return;
    localStorage.removeItem(STORAGE_KEY);
    this._sessions = [];
    this.dispatchEvent(new CustomEvent('history-cleared', { bubbles: true, composed: true }));
  }

  private _showDetail(session: Session) {
    const body = this.shadowRoot?.querySelector('.drawer-body') as HTMLElement | null;
    this._savedScroll = body?.scrollTop ?? 0;
    this._detail = session;
    this.updateComplete.then(() => {
      this.shadowRoot?.querySelector<HTMLButtonElement>('.detail-back')?.focus();
      if (body) body.scrollTop = 0;
    });
  }

  private _backToList() {
    this._detail = null;
    this.updateComplete.then(() => {
      const body = this.shadowRoot?.querySelector('.drawer-body') as HTMLElement | null;
      if (body) body.scrollTop = this._savedScroll;
    });
  }

  private _downloadDetail() {
    if (!this._detail?.tracks) return;
    this.dispatchEvent(new CustomEvent('download-xspf', {
      bubbles: true,
      composed: true,
      detail: { tracks: this._detail.tracks, title: this._detail.displayName },
    }));
  }

  private _formatMeta(session: Session) {
    if (session.mode === 'artist') return `Artist exploration \u00b7 ${session.inputs.artist}`;
    if (session.mode === 'theme') return `Theme \u00b7 ${session.inputs.theme}`;
    return `Transition \u00b7 ${session.inputs.artistFrom} \u2192 ${session.inputs.artistTo}`;
  }

  private _onDocKeydown = (e: KeyboardEvent) => {
    if (e.key === 'Escape' && this._open) this.close();
  };

  private _onDrawerKeydown(e: KeyboardEvent) {
    if (e.key !== 'Tab') return;
    const aside = this._aside;
    if (!aside) return;
    const focusable = [...aside.querySelectorAll<HTMLElement>(
      'button:not([disabled]), a[href], input:not([disabled]), [tabindex]:not([tabindex="-1"])'
    )].filter(el => !el.closest('[hidden]'));
    if (focusable.length === 0) return;
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    if (e.shiftKey) {
      if (this.shadowRoot?.activeElement === first) { e.preventDefault(); last.focus(); }
    } else {
      if (this.shadowRoot?.activeElement === last) { e.preventDefault(); first.focus(); }
    }
  }

  private _renderList() {
    if (this._sessions.length === 0) {
      return html`
        <div class="list-view">
          <p class="empty">No sessions saved yet. Complete a query to save your first session.</p>
        </div>
      `;
    }

    const kb = this._estimateSize();
    return html`
      <div class="list-view">
        <ol class="session-list">
          ${this._sessions.map(s => html`
            <li>
              <button type="button" @click=${() => this._showDetail(s)}>${s.displayName}</button>
            </li>
          `)}
        </ol>
        <div class="settings">
          <p>${this._sessions.length} session${this._sessions.length === 1 ? '' : 's'} \u00b7 ~${kb}KB used</p>
          <button type="button" class="clear-btn" @click=${this._clearHistory}>Clear History</button>
        </div>
      </div>
    `;
  }

  private _renderDetail() {
    const s = this._detail!;
    const sanitized = DOMPurify.sanitize(marked.parse(s.commentary) as string);
    return html`
      <div class="detail-view">
        <div class="detail-header">
          <button type="button" class="detail-back" @click=${this._backToList}>\u2190 Back</button>
          <h3>${s.displayName}</h3>
          <p class="detail-meta">${this._formatMeta(s)}</p>
        </div>
        <div class="detail-content">
          <div class="results">${unsafeHTML(sanitized)}</div>
        </div>
        <div class="detail-actions">
          <button type="button" class="download-btn" ?disabled=${!s.tracks} @click=${this._downloadDetail}>Download XSPF</button>
        </div>
      </div>
    `;
  }

  render() {
    if (!this._open) return nothing;

    return html`
      <div class="backdrop" @click=${this.close}></div>
      <aside
        class="open"
        aria-label="Session history"
        @keydown=${this._onDrawerKeydown}
      >
        <div class="drawer-header">
          <h2>History</h2>
          <button type="button" class="drawer-close" aria-label="Close history" @click=${this.close}>\u00d7</button>
        </div>
        <div class="drawer-body">
          ${this._detail ? this._renderDetail() : this._renderList()}
        </div>
      </aside>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'history-drawer': HistoryDrawer;
  }
}
