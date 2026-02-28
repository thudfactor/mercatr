import { LitElement, html, css } from 'lit';
import { customElement, property } from 'lit/decorators.js';
import { unsafeHTML } from 'lit/directives/unsafe-html.js';
import { marked } from 'marked';
import DOMPurify from 'dompurify';
import { resultStyles } from './shared-result-styles.js';

export interface Track {
  artist: string;
  track: string;
  album?: string;
  year?: string;
}

@customElement('playlist-results')
export class PlaylistResults extends LitElement {
  @property({ type: String }) narrative = '';
  @property({ type: Array }) tracks: Track[] = [];
  @property({ type: String }) correctionHtml = '';

  static styles = [
    resultStyles,
    css`
      :host {
        display: block;
        margin-top: 1.5rem;
      }

      :host([hidden]) { display: none; }

      .correction-notice {
        font-size: 0.82rem;
        color: var(--color-foreground);
        background: var(--color-surface);
        border: 1px solid var(--color-border);
        border-radius: 4px;
        padding: 0.6rem 0.75rem;
        margin-bottom: 1rem;
      }

      .actions {
        margin-top: 1rem;
        display: flex;
        gap: 0.75rem;
        align-items: center;
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

  private _renderTrackList() {
    if (!this.tracks.length) return '';
    return html`
      <ol class="track-list" aria-label="Recommended tracks">
        ${this.tracks.map((t, i) => {
          const parts = [t.album, t.year].filter(Boolean);
          return html`
            <li>
              <span class="track-num">${i + 1}.</span>
              <span class="track-title">
                <a href="https://www.last.fm/music/${encodeURIComponent(t.artist)}/_/${encodeURIComponent(t.track)}"
                   target="_blank" rel="noopener noreferrer">${t.track}</a>
              </span>
              <span class="track-artist">\u2014 ${t.artist}</span>
              ${parts.length > 0 ? html`<span class="track-meta">${parts.join(' \u00b7 ')}</span>` : ''}
            </li>
          `;
        })}
      </ol>
    `;
  }

  private _onDownload() {
    this.dispatchEvent(new CustomEvent('download-xspf', { bubbles: true, composed: true }));
  }

  render() {
    if (!this.narrative) return '';

    const sanitized = DOMPurify.sanitize(marked.parse(this.narrative) as string);

    return html`
      ${this.correctionHtml ? html`<p class="correction-notice">${unsafeHTML(this.correctionHtml)}</p>` : ''}
      <div class="results">
        ${unsafeHTML(sanitized)}
        ${this._renderTrackList()}
      </div>
      <div class="actions">
        <button class="download-btn" ?disabled=${!this.tracks.length} @click=${this._onDownload}>
          Download XSPF
        </button>
      </div>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'playlist-results': PlaylistResults;
  }
}
