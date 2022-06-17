#!/bin/bash

DRY_RUN=false
SKIP_BINARIES=false

args=()
while [[ $# -gt 0 ]]; do
    arg=$1
    shift

    case "${arg}" in
    --dry*) DRY_RUN=true ;;
    --skip*) SKIP_BINARIES=true ;;
    --fake*)
        FAKE_VERSION=$1
        shift
        ;;
    --arch)
        ARCH=$1
        shift
        ;;
    *)
        args+=("${arg}")
        ;;
    esac
done

set -- "${args[@]}"

if [[ $# -ne 1 ]]; then
    cat <<EOF >&2
usage: $(basename "$0") [--dry-run] [--skip-binaries] [--fake-version <version>] [--arch <arch>] <s3_bucket>
EOF
    exit 1
fi

S3_BUCKET=$1
shift

set -e

GIT_TOPLEVEL=$(git rev-parse --show-toplevel)
RELEASE_DIR="${GIT_TOPLEVEL}/release"

# FIXME: make this work for windows, too!

version=$(awk -F\" '$2 == "version" { print $4 }' "${GIT_TOPLEVEL}/package.json")
if [[ -z "${version}" ]]; then
    echo "can not find version key in ${GIT_TOPLEVEL}/package.json" >&2
    exit 2
fi

if [[ "${version}" =~ 'beta' ]]; then
    release='beta'
else
    release='latest'
fi

files=''
primary=''
for dmg in "${RELEASE_DIR}"/*"${version}".{dmg,zip}; do
    if [[ -n "${ARCH}" ]] && ! [[ "${dmg}" =~ "${ARCH}" ]]; then
        continue
    fi

    base=$(basename "${dmg}")
    sha512=$(openssl dgst -binary -sha512 "${dmg}" | openssl base64 -A)
    size=$(stat -f %z "${dmg}")

    if [[ -n "${FAKE_VERSION}" ]]; then
        base=${base/${version}/${FAKE_VERSION}}
    fi

    files+="
  - url: ${base}
    sha512: ${sha512}
    size: ${size}"

    if [[ "${base}" =~ -x64-.*.zip ]]; then
        primary="path: ${base}
sha512: ${sha512}"
    fi
done

if [[ -z "${files}" ]]; then
    echo "no files found for ${version}" >&2
    exit 3
fi

if [[ -z "${primary}" ]]; then
    echo 'no primary path found' >&2
    exit 4
fi

release_file_base="${release}-mac.yml"
release_file="${RELEASE_DIR}/${release_file_base}"

cat <<EOF >"${release_file}"
version: ${FAKE_VERSION:-${version}}
files:${files}
${primary}
releaseDate: '$(date -u +%Y-%m-%dT%H:%M:%S%z)'
EOF

if $DRY_RUN; then
    aws='echo aws'
else
    aws='aws'
fi

function upload() {
    local bn=$(basename "$1")

    if [[ -n "${FAKE_VERSION}" ]]; then
        bn=${bn/${version}/${FAKE_VERSION}}
    fi

    $aws --endpoint-url https://de4b9bc87b7091e05993555f58443f2f.r2.cloudflarestorage.com \
        s3 cp "$1" "s3://${S3_BUCKET}/desktop/${bn}"
}

if ! $SKIP_BINARIES; then
    for dmg in "${RELEASE_DIR}"/*"${version}"*; do
        if [[ -z "${ARCH}" ]] || [[ "${dmg}" =~ "${ARCH}" ]]; then
            upload "${dmg}"
        fi
    done
fi

upload "${release_file}"
