import { LitElement, html, css, nothing } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';

export interface Voice {
  id: string;
  label: string;
  description?: string;
}

export interface PlaylistSubmitDetail {
  mode: 'explore' | 'bridge' | 'theme';
  body: Record<string, string>;
  title: string;
  sessionInputs: Record<string, string>;
  sessionMode: string;
}

@customElement('playlist-form')
export class PlaylistForm extends LitElement {
  @property({ type: Array }) voices: Voice[] = [];
  @state() private _activeTab: 'explore' | 'bridge' | 'theme' = 'explore';
  @state() private _loading = false;
  @state() private _fromSong = '';
  @state() private _toSong = '';

  private get _songRequired(): boolean {
    return this._fromSong.trim().length > 0 || this._toSong.trim().length > 0;
  }

  static styles = css`
    :host { display: block; }

    nav {
      display: flex;
      gap: 0.25rem;
      margin-bottom: 1.5rem;
    }

    .tab {
      background: none;
      border: 1px solid var(--color-border);
      color: var(--color-foreground);
      padding: 0.5rem 1rem;
      border-radius: 4px;
      cursor: pointer;
      font-size: 0.875rem;
      transition: all 0.15s;
    }

    .tab:hover { color: var(--color-text-muted); border-color: var(--color-border-muted); }

    .tab[aria-selected="true"] {
      background: var(--color-surface-mid);
      color: var(--color-foreground);
      border-color: var(--color-border-active);
    }

    .panel { display: none; }
    .panel.active { display: block; }

    form { display: flex; flex-direction: column; gap: 1rem; }

    .field { display: flex; flex-direction: column; gap: 0.35rem; }

    label {
      font-size: 0.8rem;
      font-weight: 500;
      color: var(--color-text-subdued);
      letter-spacing: 0.03em;
      text-transform: uppercase;
    }

    .optional { color: var(--color-text-ghost); text-transform: none; letter-spacing: normal; font-weight: normal; }

    input[type="text"] {
      background: var(--color-surface);
      border: 1px solid var(--color-border-subtle);
      border-radius: 4px;
      color: var(--color-foreground);
      font-size: 0.95rem;
      padding: 0.6rem 0.75rem;
      width: 100%;
      transition: border-color 0.15s;
    }

    input[type="text"]:focus {
      outline: none;
      border-color: var(--color-border-active);
    }

    select {
      background: var(--color-surface);
      border: 1px solid var(--color-border-subtle);
      border-radius: 4px;
      color: var(--color-foreground);
      font-size: 0.95rem;
      padding: 0.6rem 0.75rem;
      width: 100%;
      transition: border-color 0.15s;
      appearance: none;
      cursor: pointer;
    }

    select:focus {
      outline: none;
      border-color: var(--color-border-active);
    }

    select option {
      background: var(--color-surface);
      color: var(--color-foreground);
    }

    .form-actions {
      display: flex;
      gap: 0.5rem;
      margin-top: 0.25rem;
    }

    button[type="submit"], button[type="reset"] {
      border-radius: 4px;
      cursor: pointer;
      font-size: 0.9rem;
      padding: 0.65rem 1.25rem;
      transition: background 0.15s;
    }

    button[type="submit"] {
      background: var(--color-border);
      border: 1px solid var(--color-border-muted);
      color: var(--color-foreground);
    }

    button[type="reset"] {
      background: none;
      border: 1px solid var(--color-border);
      color: var(--color-foreground);
    }

    button[type="submit"]:hover:not(:disabled) { background: var(--color-border-subtle); }
    button[type="reset"]:hover { color: var(--color-text-subdued); border-color: var(--color-border-muted); }
    button[type="submit"]:disabled { opacity: 0.5; cursor: not-allowed; }

    .field-hint {
      font-size: 0.8rem;
      color: var(--color-text-subdued);
      margin: 0;
    }
  `;

  set loading(val: boolean) {
    this._loading = val;
  }

  private _switchTab(tab: 'explore' | 'bridge' | 'theme') {
    this._activeTab = tab;
    this.dispatchEvent(new CustomEvent('tab-change', { bubbles: true, composed: true }));
  }

  private _onTabKeydown(e: KeyboardEvent) {
    const tabs: ('explore' | 'bridge' | 'theme')[] = ['explore', 'bridge', 'theme'];
    const idx = tabs.indexOf(this._activeTab);
    let next = idx;
    if (e.key === 'ArrowRight') next = (idx + 1) % tabs.length;
    else if (e.key === 'ArrowLeft') next = (idx - 1 + tabs.length) % tabs.length;
    else return;
    e.preventDefault();
    this._switchTab(tabs[next]);
    this.updateComplete.then(() => {
      this.shadowRoot?.querySelector<HTMLButtonElement>(`[data-tab="${tabs[next]}"]`)?.focus();
    });
  }

  private _voiceSelect() {
    return html`
      <div class="field">
        <label>Voice <span class="optional">(optional)</span></label>
        <select name="voice">
          <option value="">Voice (optional)</option>
          ${this.voices.map(v => html`
            <option value=${v.id} title=${v.description ?? ''}>${v.label}</option>
          `)}
        </select>
      </div>
    `;
  }

  private _formActions() {
    return html`
      <div class="form-actions">
        <button type="submit" ?disabled=${this._loading}>
          ${this._loading ? 'Generating\u2026' : 'Generate'}
        </button>
        <button type="reset">Reset</button>
      </div>
    `;
  }

  private _submitExplore(e: SubmitEvent) {
    e.preventDefault();
    const form = e.target as HTMLFormElement;
    const artist = (form.querySelector('[name="artist"]') as HTMLInputElement).value.trim();
    const track = (form.querySelector('[name="track"]') as HTMLInputElement).value.trim();
    const voice = (form.querySelector('[name="voice"]') as HTMLSelectElement).value || undefined;
    this.dispatchEvent(new CustomEvent<PlaylistSubmitDetail>('playlist-submit', {
      bubbles: true,
      composed: true,
      detail: {
        mode: 'explore',
        body: { artist, ...(track ? { track } : {}), ...(voice ? { voice } : {}) },
        title: artist,
        sessionInputs: { artist },
        sessionMode: 'artist',
      },
    }));
  }

  private _submitBridge(e: SubmitEvent) {
    e.preventDefault();
    const form = e.target as HTMLFormElement;
    const from = (form.querySelector('[name="from"]') as HTMLInputElement).value.trim();
    const to = (form.querySelector('[name="to"]') as HTMLInputElement).value.trim();
    const fromSong = (form.querySelector('[name="fromSong"]') as HTMLInputElement).value.trim();
    const toSong = (form.querySelector('[name="toSong"]') as HTMLInputElement).value.trim();
    const voice = (form.querySelector('[name="voice"]') as HTMLSelectElement).value || undefined;
    const title = (fromSong && toSong)
      ? `${from}: \u201c${fromSong}\u201d \u2192 ${to}: \u201c${toSong}\u201d`
      : `${from} \u2192 ${to}`;
    this.dispatchEvent(new CustomEvent<PlaylistSubmitDetail>('playlist-submit', {
      bubbles: true,
      composed: true,
      detail: {
        mode: 'bridge',
        body: { from, to, ...(fromSong ? { fromSong } : {}), ...(toSong ? { toSong } : {}), ...(voice ? { voice } : {}) },
        title,
        sessionInputs: { artistFrom: from, artistTo: to },
        sessionMode: 'transition',
      },
    }));
  }

  private _submitTheme(e: SubmitEvent) {
    e.preventDefault();
    const form = e.target as HTMLFormElement;
    const theme = (form.querySelector('[name="theme"]') as HTMLInputElement).value.trim();
    const seedArtist = (form.querySelector('[name="seedArtist"]') as HTMLInputElement).value.trim();
    const voice = (form.querySelector('[name="voice"]') as HTMLSelectElement).value || undefined;
    this.dispatchEvent(new CustomEvent<PlaylistSubmitDetail>('playlist-submit', {
      bubbles: true,
      composed: true,
      detail: {
        mode: 'theme',
        body: { theme, ...(seedArtist ? { seedArtist } : {}), ...(voice ? { voice } : {}) },
        title: theme,
        sessionInputs: { theme },
        sessionMode: 'theme',
      },
    }));
  }

  private _onReset() {
    this._fromSong = '';
    this._toSong = '';
    this.dispatchEvent(new CustomEvent('form-reset', { bubbles: true, composed: true }));
  }

  render() {
    return html`
      <nav role="tablist" aria-label="Query mode" @keydown=${this._onTabKeydown}>
        ${(['explore', 'bridge', 'theme'] as const).map(tab => html`
          <button
            class="tab"
            role="tab"
            data-tab=${tab}
            aria-selected=${this._activeTab === tab ? 'true' : 'false'}
            tabindex=${this._activeTab === tab ? '0' : '-1'}
            @click=${() => this._switchTab(tab)}
          >${tab.charAt(0).toUpperCase() + tab.slice(1)}</button>
        `)}
      </nav>

      <section class="panel ${this._activeTab === 'explore' ? 'active' : ''}" role="tabpanel">
        <form @submit=${this._submitExplore} @reset=${this._onReset}>
          <div class="field">
            <label for="explore-artist">Artist</label>
            <input type="text" id="explore-artist" name="artist" placeholder="e.g. Elliott Smith" maxlength="200" required>
          </div>
          <div class="field">
            <label for="explore-track">Track <span class="optional">(optional)</span></label>
            <input type="text" id="explore-track" name="track" placeholder="e.g. Between the Bars" maxlength="200">
          </div>
          ${this._voiceSelect()}
          ${this._formActions()}
        </form>
      </section>

      <section class="panel ${this._activeTab === 'bridge' ? 'active' : ''}" role="tabpanel">
        <form @submit=${this._submitBridge} @reset=${this._onReset}>
          <div class="field">
            <label for="bridge-from">From artist</label>
            <input type="text" id="bridge-from" name="from" placeholder="e.g. Nick Drake" maxlength="200" required>
          </div>
          <div class="field">
            <label for="bridge-from-song">From song ${this._songRequired ? '' : html`<span class="optional">(optional)</span>`}</label>
            <input
              type="text"
              id="bridge-from-song"
              name="fromSong"
              placeholder="e.g. Pink Moon"
              maxlength="200"
              ?required=${this._songRequired}
              aria-required=${this._songRequired ? 'true' : 'false'}
              aria-describedby=${this._songRequired ? 'bridge-song-hint' : nothing}
              .value=${this._fromSong}
              @input=${(e: InputEvent) => { this._fromSong = (e.target as HTMLInputElement).value; }}
            >
          </div>
          <div class="field">
            <label for="bridge-to">To artist</label>
            <input type="text" id="bridge-to" name="to" placeholder="e.g. Frank Ocean" maxlength="200" required>
          </div>
          <div class="field">
            <label for="bridge-to-song">To song ${this._songRequired ? '' : html`<span class="optional">(optional)</span>`}</label>
            <input
              type="text"
              id="bridge-to-song"
              name="toSong"
              placeholder="e.g. Nights"
              maxlength="200"
              ?required=${this._songRequired}
              aria-required=${this._songRequired ? 'true' : 'false'}
              aria-describedby=${this._songRequired ? 'bridge-song-hint' : nothing}
              .value=${this._toSong}
              @input=${(e: InputEvent) => { this._toSong = (e.target as HTMLInputElement).value; }}
            >
          </div>
          ${this._songRequired ? html`<p id="bridge-song-hint" class="field-hint">Both song fields are required when either is filled.</p>` : nothing}
          ${this._voiceSelect()}
          ${this._formActions()}
        </form>
      </section>

      <section class="panel ${this._activeTab === 'theme' ? 'active' : ''}" role="tabpanel">
        <form @submit=${this._submitTheme} @reset=${this._onReset}>
          <div class="field">
            <label for="theme-input">Theme</label>
            <input type="text" id="theme-input" name="theme" placeholder="e.g. loneliness in crowded places" maxlength="200" required>
          </div>
          <div class="field">
            <label for="theme-seed">Seed artist <span class="optional">(optional)</span></label>
            <input type="text" id="theme-seed" name="seedArtist" placeholder="e.g. Bon Iver" maxlength="200">
          </div>
          ${this._voiceSelect()}
          ${this._formActions()}
        </form>
      </section>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'playlist-form': PlaylistForm;
  }
}
