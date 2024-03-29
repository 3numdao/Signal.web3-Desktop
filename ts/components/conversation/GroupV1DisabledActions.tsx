// Copyright 2020 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import * as React from 'react';
import { Intl } from '../Intl';
import type { LocalizerType } from '../../types/Util';

export type PropsType = {
  conversationId: string;
  i18n: LocalizerType;
  showGV2MigrationDialog: (id: string) => unknown;
};

export function GroupV1DisabledActions({
  conversationId,
  i18n,
  showGV2MigrationDialog,
}: PropsType): JSX.Element {
  return (
    <div className="module-group-v1-disabled-actions">
      <p className="module-group-v1-disabled-actions__message">
        <Intl
          i18n={i18n}
          id="GroupV1--Migration--disabled"
          components={{
            learnMore: (
              <a
                href="https://support.signal.org/hc/articles/360007319331"
                target="_blank"
                rel="noreferrer"
                className="module-group-v1-disabled-actions__message__learn-more"
              >
                {i18n('MessageRequests--learn-more')}
              </a>
            ),
          }}
        />
      </p>
      <div className="module-group-v1-disabled-actions__buttons">
        <button
          type="button"
          onClick={() => showGV2MigrationDialog(conversationId)}
          tabIndex={0}
          className="module-group-v1-disabled-actions__buttons__button"
        >
          {i18n('MessageRequests--continue')}
        </button>
      </div>
    </div>
  );
}
