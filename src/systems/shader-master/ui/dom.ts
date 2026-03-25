import type { ShaderUniformValue } from '../contracts/types.ts';
import '../../../ui/retro-ui.css';

export type StyleMap = Partial<CSSStyleDeclaration>;

export const FIELD_BASE_STYLES: StyleMap = {};

export const FIELD_CLASS = 'es-field';

export function createElement<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  stylesOrClass: StyleMap | string = {},
  textContent?: string,
): HTMLElementTagNameMap[K] {
  const element = document.createElement(tag);
  if (typeof stylesOrClass === 'string') {
    if (stylesOrClass) element.className = stylesOrClass;
  } else if (Object.keys(stylesOrClass).length > 0) {
    Object.assign(element.style, stylesOrClass);
  }
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
  const button = document.createElement('button');
  button.className = 'es-retro-button es-btn';
  button.type = 'button';
  button.textContent = label;
  if (Object.keys(styles).length > 0) {
    Object.assign(button.style, styles);
  }
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
        : '');
    button.style.borderColor = activeAccent || (button.disabled ? 'rgba(102, 136, 86, 0.18)' : '');
    button.style.boxShadow = activeAccent
      ? `0 0 0 1px ${activeAccent}33 inset, 0 0 16px ${activeAccent}18`
      : (button.disabled
        ? 'none'
        : '');
  });
  button.addEventListener('click', onClick);
  return button;
}

export function setButtonEnabled(button: HTMLButtonElement, enabled: boolean): void {
  button.disabled = !enabled;
  button.style.opacity = enabled ? '' : '0.45';
  button.style.cursor = enabled ? '' : 'not-allowed';
  if (!enabled) {
    button.style.background = 'rgba(9, 17, 9, 0.76)';
    button.style.borderColor = 'rgba(102, 136, 86, 0.18)';
  } else {
    button.style.background = '';
    button.style.borderColor = '';
  }
}

export function createCardShell(title: string, subtitle?: string): HTMLDivElement {
  const card = createElement('div');
  card.className = 'es-machine-panel es-workspace-card';
  card.style.position = 'relative';
  card.style.minHeight = '100%';
  card.style.display = 'flex';
  card.style.flexDirection = 'column';
  card.style.gap = '16px';
  card.style.padding = '18px';
  card.style.overflow = 'hidden';

  const header = createElement('div', {
    display: 'flex',
    flexDirection: 'column',
    gap: '4px',
  });
  const titleEl = createElement('h3', 'es-card-header__title', title);
  header.append(titleEl);

  if (subtitle) {
    header.append(
      createElement('p', 'es-card-header__subtitle', subtitle),
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
  const tag = document.createElement('span');
  tag.className = 'es-tag';
  tag.textContent = label;
  if (Object.keys(styles).length > 0) {
    Object.assign(tag.style, styles);
  }
  return tag;
}
