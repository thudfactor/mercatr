import { css } from 'lit';

export const resultStyles = css`
  .results {
    background: var(--color-surface-deep);
    border: 1px solid var(--color-border);
    border-radius: 6px;
    padding: 1.25rem 1.5rem;
    line-height: 1.65;
    font-size: 0.92rem;
  }

  .results h1, .results h2, .results h3 {
    color: var(--color-text-bright);
    margin: 1rem 0 0.4rem;
    font-size: 1rem;
  }

  .results h1:first-child, .results h2:first-child { margin-top: 0; }

  .results p { color: var(--color-text-secondary); margin: 0.4rem 0; }

  .results ul, .results ol {
    padding-left: 1.25rem;
    color: var(--color-text-secondary);
  }

  .results li { margin: 0.2rem 0; }

  .results strong { color: var(--color-text-bright); }

  .results em { color: var(--color-text-faint); }

  .results hr {
    border: none;
    border-top: 1px solid var(--color-border);
    margin: 1rem 0;
  }

  .track-list {
    list-style: none;
    padding: 0;
    margin-top: 1.25rem;
    border-top: 1px solid var(--color-border);
    padding-top: 1rem;
  }

  .track-list li {
    display: flex;
    align-items: baseline;
    gap: 0.5rem;
    padding: 0.3rem 0;
    font-size: 0.85rem;
    color: var(--color-foreground);
    border-bottom: 1px solid var(--color-surface-mid);
  }

  .track-list li:last-child { border-bottom: none; }

  .track-num {
    color: var(--color-text-ghost);
    font-size: 0.75rem;
    min-width: 1.5rem;
    flex-shrink: 0;
  }

  .track-title a {
    color: var(--color-text-secondary);
    text-decoration: none;
  }

  .track-title a:hover { color: var(--color-foreground); text-decoration: underline; }

  .track-artist { color: var(--color-text-ghost); }

  .track-meta { color: var(--color-text-ghost); font-size: 0.78rem; margin-left: auto; white-space: nowrap; }
`;
