// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import React from 'react';
import type {
  ContactModalStateType,
  ForwardMessagePropsType,
  UserNotFoundModalStateType,
  SafetyNumberChangedBlockingDataType,
} from '../state/ducks/globalModals';
import type { LocalizerType } from '../types/Util';
import { missingCaseError } from '../util/missingCaseError';

import { ButtonVariant } from './Button';
import { ConfirmationDialog } from './ConfirmationDialog';
import { SignalConnectionsModal } from './SignalConnectionsModal';
import { WhatsNewModal } from './WhatsNewModal';

type PropsType = {
  i18n: LocalizerType;
  // ContactModal
  contactModalState?: ContactModalStateType;
  renderContactModal: () => JSX.Element;
  // ForwardMessageModal
  forwardMessageProps?: ForwardMessagePropsType;
  renderForwardMessageModal: () => JSX.Element;
  // ProfileEditor
  isProfileEditorVisible: boolean;
  renderProfileEditor: () => JSX.Element;
  // SafetyNumberModal
  safetyNumberModalContactId?: string;
  renderSafetyNumber: () => JSX.Element;
  // SignalConnectionsModal
  isSignalConnectionsVisible: boolean;
  toggleSignalConnectionsModal: () => unknown;
  // StoriesSettings
  isStoriesSettingsVisible: boolean;
  renderStoriesSettings: () => JSX.Element;
  // SendAnywayDialog
  hasSafetyNumberChangeModal: boolean;
  safetyNumberChangedBlockingData?: SafetyNumberChangedBlockingDataType;
  renderSendAnywayDialog: () => JSX.Element;
  // UserNotFoundModal
  hideUserNotFoundModal: () => unknown;
  userNotFoundModalState?: UserNotFoundModalStateType;
  // WhatsNewModal
  isWhatsNewVisible: boolean;
  hideWhatsNewModal: () => unknown;
};

export const GlobalModalContainer = ({
  i18n,
  // ContactModal
  contactModalState,
  renderContactModal,
  // ForwardMessageModal
  forwardMessageProps,
  renderForwardMessageModal,
  // ProfileEditor
  isProfileEditorVisible,
  renderProfileEditor,
  // SafetyNumberModal
  safetyNumberModalContactId,
  renderSafetyNumber,
  // SignalConnectionsModal
  isSignalConnectionsVisible,
  toggleSignalConnectionsModal,
  // StoriesSettings
  isStoriesSettingsVisible,
  renderStoriesSettings,
  // SendAnywayDialog
  hasSafetyNumberChangeModal,
  safetyNumberChangedBlockingData,
  renderSendAnywayDialog,
  // UserNotFoundModal
  hideUserNotFoundModal,
  userNotFoundModalState,
  // WhatsNewModal
  hideWhatsNewModal,
  isWhatsNewVisible,
}: PropsType): JSX.Element | null => {
  // We want the send anyway dialog to supersede most modals since this is an
  // immediate action the user needs to take.
  if (hasSafetyNumberChangeModal || safetyNumberChangedBlockingData) {
    return renderSendAnywayDialog();
  }

  if (safetyNumberModalContactId) {
    return renderSafetyNumber();
  }

  if (userNotFoundModalState) {
    let content: string;
    if (userNotFoundModalState.type === 'phoneNumber') {
      content = i18n('startConversation--phone-number-not-found', {
        phoneNumber: userNotFoundModalState.phoneNumber,
      });
    } else if (userNotFoundModalState.type === 'phoneNumberRecord') {
      const key = userNotFoundModalState.etherAddress
        ? 'not-found'
        : 'unregistered';
      content = i18n(`startConversation--phone-number-record-${key}`, {
        etherName: userNotFoundModalState.etherName,
        etherAddress: userNotFoundModalState.etherAddress,
      });
    } else if (userNotFoundModalState.type === 'username') {
      content = i18n('startConversation--username-not-found', {
        atUsername: i18n('at-username', {
          username: userNotFoundModalState.username,
        }),
      });
    } else {
      throw missingCaseError(userNotFoundModalState);
    }

    return (
      <ConfirmationDialog
        cancelText={i18n('ok')}
        cancelButtonVariant={ButtonVariant.Secondary}
        i18n={i18n}
        onClose={hideUserNotFoundModal}
      >
        {content}
      </ConfirmationDialog>
    );
  }

  if (contactModalState) {
    return renderContactModal();
  }

  if (isProfileEditorVisible) {
    return renderProfileEditor();
  }

  if (isWhatsNewVisible) {
    return <WhatsNewModal hideWhatsNewModal={hideWhatsNewModal} i18n={i18n} />;
  }

  if (forwardMessageProps) {
    return renderForwardMessageModal();
  }

  if (isSignalConnectionsVisible) {
    return (
      <SignalConnectionsModal
        i18n={i18n}
        onClose={toggleSignalConnectionsModal}
      />
    );
  }

  if (isStoriesSettingsVisible) {
    return renderStoriesSettings();
  }

  return null;
};
