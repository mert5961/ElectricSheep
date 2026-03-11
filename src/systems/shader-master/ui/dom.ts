import type { ShaderUniformValue } from '../contracts/types.ts';

export type StyleMap = Partial<CSSStyleDeclaration>;

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
    background: 'rgba(255,255,255,0.08)',
    color: '#d8dde7',
    border: '1px solid rgba(255,255,255,0.12)',
    borderRadius: '10px',
    padding: '9px 13px',
    cursor: 'pointer',
    fontSize: '12px',
    transition: 'background 0.15s ease, border-color 0.15s ease, opacity 0.15s ease',
    ...styles,
  });
  button.type = 'button';
  button.textContent = label;
  button.addEventListener('mouseenter', () => {
    if (!button.disabled) {
      button.style.background = 'rgba(255,255,255,0.14)';
    }
  });
  button.addEventListener('mouseleave', () => {
    button.style.background = button.disabled ? 'rgba(255,255,255,0.04)' : 'rgba(255,255,255,0.08)';
  });
  button.addEventListener('click', onClick);
  return button;
}

export function setButtonEnabled(button: HTMLButtonElement, enabled: boolean): void {
  button.disabled = !enabled;
  button.style.opacity = enabled ? '1' : '0.45';
  button.style.cursor = enabled ? 'pointer' : 'not-allowed';
  button.style.background = enabled ? 'rgba(255,255,255,0.08)' : 'rgba(255,255,255,0.04)';
}

export function createCardShell(title: string, subtitle?: string): HTMLDivElement {
  const card = createElement('div', {
    minHeight: '100%',
    display: 'flex',
    flexDirection: 'column',
    gap: '16px',
    padding: '18px',
    background: 'linear-gradient(180deg, rgba(18,22,29,0.96) 0%, rgba(10,12,16,0.94) 100%)',
    border: '1px solid rgba(255,255,255,0.08)',
    borderRadius: '18px',
    boxShadow: '0 20px 50px rgba(0, 0, 0, 0.28)',
  });

  const header = createElement('div', {
    display: 'flex',
    flexDirection: 'column',
    gap: '4px',
  });
  header.append(
    createElement('h3', {
      fontSize: '13px',
      letterSpacing: '0.08em',
      textTransform: 'uppercase',
      color: '#6d7786',
    }, title),
  );

  if (subtitle) {
    header.append(
      createElement('p', {
        fontSize: '12px',
        color: '#8a95a6',
        lineHeight: '1.45',
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
    borderRadius: '999px',
    background: 'rgba(255,255,255,0.06)',
    border: '1px solid rgba(255,255,255,0.08)',
    color: '#9ea9b9',
    fontSize: '11px',
    ...styles,
  }, label);
}
