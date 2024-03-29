// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { useState, useCallback } from 'react';
import type { SpringValues } from '@react-spring/web';
import { useChain, useSpring, useSpringRef } from '@react-spring/web';

export type ModalConfigType = {
  opacity: number;
  transform?: string;
};

enum ModalState {
  Open = 'Open',
  Closing = 'Closing',
  Closed = 'Closed',
}

export function useAnimated(
  onClose: () => unknown,
  {
    getFrom,
    getTo,
  }: {
    getFrom: (isOpen: boolean) => ModalConfigType;
    getTo: (isOpen: boolean) => ModalConfigType;
  }
): {
  close: () => unknown;
  isClosed: boolean;
  modalStyles: SpringValues<ModalConfigType>;
  overlayStyles: SpringValues<ModalConfigType>;
} {
  const [state, setState] = useState(ModalState.Open);
  const isOpen = state === ModalState.Open;
  const isClosed = state === ModalState.Closed;

  const modalRef = useSpringRef();

  const modalStyles = useSpring({
    from: getFrom(isOpen),
    to: getTo(isOpen),
    onRest: () => {
      if (state === ModalState.Closing) {
        setState(ModalState.Closed);
        onClose();
      }
    },
    config: {
      clamp: true,
      friction: 20,
      mass: 0.5,
      tension: 350,
    },
    ref: modalRef,
  });

  const overlayRef = useSpringRef();

  const overlayStyles = useSpring({
    from: { opacity: 0 },
    to: { opacity: isOpen ? 1 : 0 },
    config: {
      clamp: true,
      friction: 22,
      tension: 360,
    },
    ref: overlayRef,
  });

  useChain(isOpen ? [overlayRef, modalRef] : [modalRef, overlayRef]);
  const close = useCallback(() => {
    setState(currentState => {
      if (currentState === ModalState.Open) {
        return ModalState.Closing;
      }
      return currentState;
    });
  }, []);

  return {
    close,
    isClosed,
    overlayStyles,
    modalStyles,
  };
}
