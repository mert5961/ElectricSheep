import type { ShaderUniformValue } from '../contracts/types.ts';

export type StyleMap = Partial<CSSStyleDeclaration>;

export const FIELD_BASE_STYLES: StyleMap = {
  width: '100%',
  minHeight: '40px',
  boxSizing: 'border-box',
  background: 'rgba(6, 14, 8, 0.88)',
  color: '#d5f7c4',
  border: '1px solid rgba(120, 170, 96, 0.28)',
  borderRadius: '2px',
  padding: '10px 12px',
  fontSize: '13px',
  lineHeight: '1.35',
  fontFamily: '"IBM Plex Mono", "SFMono-Regular", Consolas, "Liberation Mono", Menlo, monospace',
  outline: 'none',
};

export function createElement<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  styles: StyleMap = {},
  textContent?: string,
): HTMLElementTagNameMap[K] {
  const element = document.createElement(tag);
  Object.assign(element.style, styles);
  if (textContent !== undefined) {
    element.textContent = textContent;
  }
  return element;
}

export function createButton(
  label: string,
  onClick: () => void,
  styles: StyleMap = {},
): HTMLButtonElement {
  const button = createElement('button', {
    background: 'linear-gradient(180deg, rgba(15, 30, 14, 0.96) 0%, rgba(7, 18, 7, 0.98) 100%)',
    color: '#d5f7c4',
    border: '1px solid rgba(120, 170, 96, 0.28)',
    borderRadius: '2px',
    padding: '9px 13px',
    cursor: 'pointer',
    fontSize: '12px',
    fontFamily: '"IBM Plex Mono", "SFMono-Regular", Consolas, "Liberation Mono", Menlo, monospace',
    fontWeight: '600',
    letterSpacing: '0.06em',
    textTransform: 'uppercase',
    transition: 'background 0.15s ease, border-color 0.15s ease, opacity 0.15s ease',
    boxShadow: 'inset 0 0 0 1px rgba(189, 255, 172, 0.03), 0 0 12px rgba(116, 255, 108, 0.05)',
    ...styles,
  });
  button.type = 'button';
  button.textContent = label;
  button.addEventListener('mouseenter', () => {
    if (!button.disabled) {
      const activeAccent = button.dataset.active === 'true'
        ? (button.dataset.activeAccent || 'rgba(166, 223, 134, 0.5)')
        : null;
      button.style.background = activeAccent
        ? `${activeAccent}22`
        : 'linear-gradient(180deg, rgba(22, 42, 20, 0.98) 0%, rgba(9, 22, 9, 1) 100%)';
      button.style.borderColor = activeAccent || 'rgba(166, 223, 134, 0.5)';
      button.style.boxShadow = activeAccent
        ? `0 0 0 1px ${activeAccent}33 inset, 0 0 16px ${activeAccent}18`
        : 'inset 0 0 0 1px rgba(189, 255, 172, 0.08), 0 0 16px rgba(116, 255, 108, 0.12)';
    }
  });
  button.addEventListener('mouseleave', () => {
    const activeAccent = button.dataset.active === 'true' ? button.dataset.activeAccent : null;
    button.style.background = activeAccent
      ? `${activeAccent}18`
      : (button.disabled
        ? 'rgba(9, 17, 9, 0.76)'
        : 'linear-gradient(180deg, rgba(15, 30, 14, 0.96) 0%, rgba(7, 18, 7, 0.98) 100%)');
    button.style.borderColor = activeAccent || (button.disabled ? 'rgba(102, 136, 86, 0.18)' : 'rgba(120, 170, 96, 0.28)');
    button.style.boxShadow = activeAccent
      ? `0 0 0 1px ${activeAccent}33 inset, 0 0 16px ${activeAccent}18`
      : (button.disabled
        ? 'none'
        : 'inset 0 0 0 1px rgba(189, 255, 172, 0.03), 0 0 12px rgba(116, 255, 108, 0.05)');
  });
  button.addEventListener('click', onClick);
  return button;
}

export function setButtonEnabled(button: HTMLButtonElement, enabled: boolean): void {
  button.disabled = !enabled;
  button.style.opacity = enabled ? '1' : '0.45';
  button.style.cursor = enabled ? 'pointer' : 'not-allowed';
  button.style.background = enabled
    ? 'linear-gradient(180deg, rgba(15, 30, 14, 0.96) 0%, rgba(7, 18, 7, 0.98) 100%)'
    : 'rgba(9, 17, 9, 0.76)';
  button.style.borderColor = enabled ? 'rgba(120, 170, 96, 0.28)' : 'rgba(102, 136, 86, 0.18)';
}

export function createCardShell(title: string, subtitle?: string): HTMLDivElement {
  const card = createElement('div', {
    position: 'relative',
    minHeight: '100%',
    display: 'flex',
    flexDirection: 'column',
    gap: '16px',
    padding: '18px',
    background: 'transparent',
    border: '1px solid transparent',
    borderRadius: '0',
    boxShadow: 'none',
    overflow: 'hidden',
  });
  card.className = 'es-machine-panel es-workspace-card';

  const header = createElement('div', {
    display: 'flex',
    flexDirection: 'column',
    gap: '4px',
  });
  header.append(
    createElement('h3', {
      fontSize: '11px',
      fontWeight: '700',
      letterSpacing: '0.14em',
      textTransform: 'uppercase',
      color: '#7fa96f',
      fontFamily: '"IBM Plex Mono", "SFMono-Regular", Consolas, "Liberation Mono", Menlo, monospace',
    }, title),
  );

  if (subtitle) {
    header.append(
      createElement('p', {
        fontSize: '12px',
        color: '#9dc18b',
        lineHeight: '1.45',
        fontFamily: '"IBM Plex Mono", "SFMono-Regular", Consolas, "Liberation Mono", Menlo, monospace',
      }, subtitle),
    );
  }

  card.append(header);
  return card;
}

export function formatUniformValue(value: ShaderUniformValue | undefined): string {
  if (value === undefined) {
    return '—';
  }

  if (Array.isArray(value)) {
    return value.map((component) => component.toFixed(2)).join(', ');
  }

  if (typeof value === 'boolean') {
    return value ? 'True' : 'False';
  }

  return value.toFixed(2);
}

function toHexComponent(value: number): string {
  return Math.round(Math.max(0, Math.min(1, value)) * 255)
    .toString(16)
    .padStart(2, '0');
}

export function vectorToHex(value: number[]): string {
  return `#${toHexComponent(value[0] || 0)}${toHexComponent(value[1] || 0)}${toHexComponent(value[2] || 0)}`;
}

export function hexToVec3(hex: string): [number, number, number] {
  const normalizedHex = hex.replace('#', '');
  const expanded = normalizedHex.length === 3
    ? normalizedHex.split('').map((part) => `${part}${part}`).join('')
    : normalizedHex;

  const numeric = Number.parseInt(expanded, 16);
  return [
    ((numeric >> 16) & 255) / 255,
    ((numeric >> 8) & 255) / 255,
    (numeric & 255) / 255,
  ];
}

export function createTag(label: string, styles: StyleMap = {}): HTMLSpanElement {
  return createElement('span', {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '6px',
    minHeight: '22px',
    padding: '3px 8px',
    borderRadius: '2px',
    background: 'rgba(12, 24, 11, 0.88)',
    border: '1px solid rgba(120, 170, 96, 0.22)',
    color: '#b8de9d',
    fontSize: '11px',
    fontFamily: '"IBM Plex Mono", "SFMono-Regular", Consolas, "Liberation Mono", Menlo, monospace',
    ...styles,
  }, label);
}
