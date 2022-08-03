# Setup

* vscode will start container capable of builds
    * following normal instructions in ../CONTRIBUTING.md
* asdf plugin add nodejs
* asdf install nodejs 16.13.2
* asdf global nodejs 16.13.2
* copy config/production.json settings into development.json
* yarn start

REMEMBER: You can use the NODE_APP_INSTANCE env var to point to different local config files!
* the runtime uses the profile name as a way to look up the associated config
    * e.g. "alice" loads "local-alice.json" and uses ~/.config/Signal.alice as the runtime config directory

## Registering Standalone

* following CONTRIBUTING.md section
* to avoid opening real signal app when solving captcha, open devtools and copy the "signalcaptcha://signal-recaptcha-v2.6..." URL and pass it along to the dev version
    * node_modules/.bin/electron . "signalcaptcha://signal-recaptcha-v2.6..."

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