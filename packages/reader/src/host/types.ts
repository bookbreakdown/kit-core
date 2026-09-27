import type { ComponentType } from 'react';
import type { HostCommand, HostMessage } from '../document';

/** A page host loads the reader document and bridges messages both ways. */
export interface PageHostHandle {
  send(cmd: HostCommand): void;
}

export interface PageHostProps {
  html: string;
  onMessage(message: HostMessage): void;
  hostRef?: (handle: PageHostHandle | null) => void;
  style?: object;
  /** Native only: custom selection menu items. */
  onSelection?(action: 'copy' | 'share' | 'define', text: string): void;
}

export type PageHostComponent = ComponentType<PageHostProps>;
