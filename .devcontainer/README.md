<!-- Copyright 2015-2020 Signal Messenger, LLC -->
<!-- SPDX-License-Identifier: AGPL-3.0-only -->

# Setup

* vscode will start container capable of builds
    * following normal instructions in ../CONTRIBUTING.md
* asdf plugin add nodejs
* asdf install nodejs 16.13.2
* asdf global nodejs 16.13.2
* copy config/production.json settings into development.json
* yarn start

##

REMEMBER: You can use the NODE_APP_INSTANCE env var to point to different local config files!
* the runtime uses the profile name as a way to look up the associated config
    * e.g. "alice" loads "local-alice.json" and uses ~/.config/Signal.alice as the runtime config directory

## Registering Standalone

* following CONTRIBUTING.md section
* to avoid opening real signal app when solving captcha, open devtools and copy the "signalcaptcha://signal-recaptcha-v2.6..." URL and pass it along to the dev version
    * node_modules/.bin/electron . "signalcaptcha://signal-recaptcha-v2.6..."

## tests

* run only matching:
  ```
  yarn test-node -g 'LeftPaneComposeHelper getBackAction returns the "show inbox" action'
  ```

## building macos

* install xcode (and command line tools)
* yarn build will not work over ssh!!
    * needs access to running display, etc. for something
    * just dev'ing w/ yarn generate && yarn build:webpack work fine, tho

## building windows

* install [nvm-windows](https://github.com/coreybutler/nvm-windows)
    * nvm install 16.13.2
    * do NOT install build tools per contributing docs! they install an old python
    * install python3
    * install visual studio
        * be sure to include C++ build support!
    * setting envvar for pointing to config: `$env:NODE_APP_INSTANCE = 'win10'`

## signing

* this will generate a keypair (public/private.key files in root): `node ts/updater/generateKeyPair.js`
    * **REMEMBER!!!!** the *public* key needs to be placed in the config/production.json
    * **ALSO!!!!** the signatures embed the version in them, so if you try generating a fake upgrade you must temporarily change the package.json version
    * or other configs, if running locally
* this will sign the built release: `yarn run sign-release`
    * only the exe and zips are signed (since dmgs have their own built-in signatures)
    * to force signing of dmgs (in the case where they aren't signed themselves, signal will expect a sig file):
        * `for f in release/*.dmg; do node ts/updater/generateSignature.js -u $f; done`

# info

https://www.phonecodegenius.com/specialcodes

883 - Global networks

The following codes are currently not in use:

Africa: 210, 211, 214, 215, 217, 219, 259, 280, 281, 282, 283, 284, 285, 286, 287, 288, 289, 292, 294, 295, 296

Europe: 383, 384, 388, 422, 423, 424, 425, 426, 427, 428, 429
Pacific: 671, 684, 693, 694, 695, 696, 697, 698, 699

East Asia and Miscellaneous: 801, 802, 803, 804, 805, 806, 807, 809, 830, 831, 832, 833, 834, 835, 836, 836, 838, 839, 851, 854, 857, 858, 859, 875, 876, 877, 878, 879, 884, 886, 887, 889, 890, 891, 892, 893, 894, 895, 896, 897, 898, 899

Middle East, South and West Asia: 969, 978, 990, 991, 997, 999

## key phrases found in desktop code

* Set Up as Standalone Device

# Approach

1. modify mobile apps to allow connection to crypto wallet
2. modify mobile apps to recognize ΞNUM during registration process
    * verify wallet address owns ΞNUM
    * change buttons to only show the "Register" (i.e. no need to "send sms/call" or enter "Verification Code") ![Alt](register-screen.png "register-screen")
3. modify service api (`/sms/code/${number}?captcha=${token}`) to support ΞNUMs by validating them directly, w/o need for the SMS
    * recognize ΞNUM country code
    * add new params to validate owner has private key associated w/ wallet owner of ΞNUM
4. everything beyond _should_ work normally…

---
# NOTES

## Looking for usage of contact directory service:

* can't find anything in libsignal
* stuff in webapi.ts, but appears "legacy" (v1)
    * oh, also has v2!
    * but production.json seems to require v1 still?

## Looking for find by phone number logic:

* code location notes for finding and resolving numbers:
    * ConversationList : manages the items shown in the left pane, including when search filters them
    * StartNewConversation : component for managing calls to show convo, lookup, show not found, show is fetching, etc.
        * i THINK this is what provides the line items shown in the ConversationList
        * invokes lookupConversationWithoutUuid from the boundOnClick callback associated w/ clicking/selecting a number
    * lookupConversationWithoutUuid : async logic to translate a phone number to a user (uuid)