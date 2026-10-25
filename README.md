# Déclic

Android app to practise the French tenses that decide written exams: passé composé versus imparfait, and indicatif versus subjonctif. Built for daily practice and the TEF Canada written section.

Status: first release in preparation.

## How it works

Each sentence goes through up to three steps: choose the tense or mood, then the auxiliary (passé composé) or the stem (subjonctif), then type the verb form. Wrong choices explain why, typed answers are graded exact, near (with what to check) or far, and a Help button reveals the answer. A daily session of 10 sentences mixes new items with spaced reviews, and a stats screen shows what, why and when you fail. Everything runs offline and the data stays on the phone.

## Install

Download the latest APK from Releases on the phone and open it (allow installs from the browser once). Updates install over the previous version and keep your data.

## Develop

    npm install
    npm run dev
    npm test

## Release

The release workflow signs the APK with a key stored in two GitHub secrets. Generate it once in Git Bash (no Java needed). The alias must stay `declic`, which `android/app/build.gradle` expects:

    mkdir -p ~/declic-keys && cd ~/declic-keys
    MSYS_NO_PATHCONV=1 openssl req -x509 -newkey rsa:4096 -sha256 -days 10000 -nodes -keyout declic.key -out declic.crt -subj "/CN=Jose Jimenez/O=Declic"
    openssl pkcs12 -export -inkey declic.key -in declic.crt -name declic -out declic.p12
    rm declic.key
    base64 -w0 declic.p12 > declic.p12.b64
    gh secret set DECLIC_KEYSTORE_B64 --repo JoseJimenez-M/declic < declic.p12.b64
    gh secret set DECLIC_KEYSTORE_PASSWORD --repo JoseJimenez-M/declic
    rm declic.p12.b64

The `pkcs12 -export` step asks for a password; enter the same one when `gh secret set` prompts for `DECLIC_KEYSTORE_PASSWORD`. Use Git Bash's `base64`: `certutil -encode` adds header lines that break the workflow's `base64 -d`.

Back up `declic.p12`, `declic.crt` and the password offline (a password manager) and keep them forever. Without them no update can be installed over the app, and because Android backups are disabled, an uninstall loses the data unless it was exported first.

To release, push to main and wait for a green `ci` run, then tag:

    git tag vX.Y.Z && git push origin vX.Y.Z

`X.Y.Z` are digits only, and Y and Z are at most 99. The `release` workflow builds the signed APK, fails if it requests the INTERNET permission, and attaches `declic-vX.Y.Z.apk` to the GitHub Release.

## License

Source-available under PolyForm Noncommercial 1.0.0. Commercial use requires a license: contact jimenez331375@gmail.com.

Required Notice: Copyright 2026 Jose Jimenez (https://github.com/JoseJimenez-M)
