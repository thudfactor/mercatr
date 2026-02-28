import { LitElement, html, css } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import { WAITING_SONGS } from '../lib/waiting-songs.js';

@customElement('waiting-song')
export class WaitingSong extends LitElement {
  @property({ type: Boolean }) active = false;
  @state() private _text = '';
  @state() private _visible = false;

  private _interval: ReturnType<typeof setInterval> | null = null;

  static styles = css`
    :host {
      display: block;
      text-align: center;
      min-height: 1.4em;
      margin-top: 1rem;
    }

    p {
      color: var(--color-foreground);
      font-style: italic;
      font-size: 0.9rem;
      opacity: 0;
      transition: opacity 0.6s ease;
    }

    p.visible {
      opacity: 1;
    }
  `;

  updated(changed: Map<string, unknown>) {
    if (changed.has('active')) {
      this.active ? this._start() : this._stop();
    }
  }

  disconnectedCallback() {
    super.disconnectedCallback();
    this._stop();
  }

  private _pick() {
    const pool = WAITING_SONGS.filter(s => `\u201c${s.title}\u201d \u2014 ${s.artist}` !== this._text);
    const song = pool[Math.floor(Math.random() * pool.length)];
    this._visible = false;
    setTimeout(() => {
      this._text = `\u201c${song.title}\u201d \u2014 ${song.artist}`;
      this._visible = true;
    }, 300);
  }

  private _start() {
    this._pick();
    this._interval = setInterval(() => this._pick(), 5000);
  }

  private _stop() {
    if (this._interval) {
      clearInterval(this._interval);
      this._interval = null;
    }
    this._visible = false;
    setTimeout(() => { this._text = ''; }, 600);
  }

  render() {
    return html`<p class=${this._visible ? 'visible' : ''} aria-live="polite">${this._text}</p>`;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'waiting-song': WaitingSong;
  }
}
