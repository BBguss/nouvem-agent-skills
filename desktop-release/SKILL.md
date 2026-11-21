---
name: desktop-release
description: Use when building, signing, packaging or shipping a desktop app (Electron, Tauri, Flutter desktop, .NET/WPF, Qt, Swift/AppKit, Python with PyInstaller) - "release the app", "build installer", "code signing", "notarize", "auto update", "publish to Microsoft Store / Mac App Store / Snap", "rollback a bad update", "rilis aplikasi desktop", "bikin installer". Runs a versioned, signed, per-OS build, tests the installer and the update path on real machines, publishes through a staged update channel behind an approval gate, and keeps a rollback ready.
---

# Desktop release

Origin: the release discipline of a hosting panel's deploy flow (checklist, hard approval gate, verify after release, one-command rollback, changelog entry) applied to apps that ship as installers instead of to a server. Model-agnostic, any desktop stack.

## When to use / not
- Use for every release of an installable desktop app: first release, regular update, hotfix, or rollback.
- Do not use for web deploys (`release-deploy`), for a local dev build only (`local-dev-setup`), or for a mobile app store release (same ideas, different tooling).

## Project adaptation
| Placeholder | Meaning | Examples |
|---|---|---|
| `<TARGETS>` | OS and architectures | `win-x64`, `mac-universal`, `linux-x64 AppImage/deb` |
| `<BUILD_CMD>` | packaging command | `electron-builder`, `tauri build`, `flutter build windows`, `pyinstaller` |
| `<SIGNING>` | how builds are signed | Windows Authenticode via cloud HSM or signtool; Apple Developer ID + notarytool; GPG for Linux repos |
| `<UPDATE_FEED>` | where the app checks for updates | GitHub Releases, S3 + `latest.yml`, Sparkle appcast, store |
| `<CHANNELS>` | release channels | `beta` → `stable`; staged rollout % |
| `<VERSION_FILE>` | single source of the version | `package.json`, `tauri.conf.json`, `pubspec.yaml` |
| `<RELEASE_NOTES>` | user-facing notes | `CHANGELOG.md` section, GitHub release body |

## Steps
1. **Pre-release checklist.**
   - Clean tree on the release branch; tests and `real-ui-verify` passed for each `<TARGETS>` OS.
   - Bump the version once in `<VERSION_FILE>` (semver); no two builds share a version.
   - Data or settings format changed? Run `data-migration` first (local SQLite, config files, caches).
   - Write `<RELEASE_NOTES>` in user words: new, fixed, known issues.
2. **Build per target** with `<BUILD_CMD>` on the matching OS (CI matrix or real machines). Record the commit, version and artifact hashes (SHA-256).
3. **Sign.** Use `<SIGNING>` through the project's secret store or CI secrets (`credential-broker`); never paste certificates or passwords into chat or code. macOS: sign, notarize, staple. Windows: sign the installer and the binaries. Verify the signature on the produced file (`codesign --verify`, `spctl -a`, `signtool verify`, `Get-AuthenticodeSignature`).
4. **Test the installers** on a clean machine or VM per OS:
   - fresh install, first launch, uninstall;
   - **update from the previous public version** to this one, keeping user data and settings;
   - no OS warning such as "unknown publisher" or "app is damaged".
5. **Approval gate** (`hitl-approvals`, typed-confirm): show version, targets, hashes, channel and rollout %. Wait for the exact confirm word.
6. **Publish** to `<UPDATE_FEED>` on the first channel (e.g. `beta` or 10% staged). Store submissions go through review: note the submission id.
7. **Watch** crash reports, update-error logs and user reports for an agreed window (e.g. 24 h). Then widen the rollout or promote to `stable`.
8. **Rollback** when needed: pull the release from the feed or point `latest` back to the previous version, and ship a fixed higher version (clients rarely downgrade by themselves). Never delete a signed artifact that users already have; mark it withdrawn.

### Fits portfolio and SaaS teams too
| | Solo / portfolio app | Desktop client of a SaaS |
|---|---|---|
| Channels | one `stable` channel via GitHub Releases | `beta` + `stable`, staged rollout, forced update for breaking API changes |
| Signing | still sign: unsigned apps scare users and get blocked | sign plus keep the server API backward compatible with the oldest supported client |
| Rollback | re-point the release, publish a patch | also check server-side feature flags and minimum supported version |

## Doc trail
Follows `living-docs` section 7.
- `plan.md` (owner skill `desktop-release`): checklist steps, per-OS build and test rows, the approval line, rollback plan.
- `checkpoint.md`: version, commit, targets, artifact hashes, channel and rollout %, store submission ids, approval received.
- `docs/error-runbook.md` part B: signing, notarization or update failures with their exact error text (`errSecInternalComponent`, `The binary is not signed with a valid Developer ID`), cause and fix. Part A: errors the app shows users during update.

## Fixed rules
- Never publish an unsigned or unverified build to a public channel.
- Never reuse a version number; never replace an artifact under the same version.
- Always test the update path from the last public version, not only a fresh install.
- Signing keys stay in the secret store; an agent never prints, exports or emails them.

## Report
Result first: version, targets built and signed, install and update test results per OS, channel and rollout, rollback command, items held for approval.
