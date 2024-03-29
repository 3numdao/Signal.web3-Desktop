// Copyright 2020 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import * as React from 'react';

import type { LocalizerType } from '../types/Util';
import { Modal } from './Modal';
import { Button, ButtonVariant } from './Button';

export type PropsType = {
  description?: string;
  title?: string;

  onClose: () => void;
  i18n: LocalizerType;
};

function focusRef(el: HTMLElement | null) {
  if (el) {
    el.focus();
  }
}

export function ErrorModal(props: PropsType): JSX.Element {
  const { description, i18n, onClose, title } = props;

  const footer = (
    <Button onClick={onClose} ref={focusRef} variant={ButtonVariant.Secondary}>
      {i18n('Confirmation--confirm')}
    </Button>
  );

  return (
    <Modal
      modalName="ErrorModal"
      i18n={i18n}
      onClose={onClose}
      title={title || i18n('ErrorModal--title')}
      modalFooter={footer}
    >
      <div className="module-error-modal__description">
        {description || i18n('ErrorModal--description')}
      </div>
    </Modal>
  );
}
