# Capability Tiers — What CI Can Verify, and What It Cannot

Research: 2026-09-11. The pipeline's safety model rests on one assumption — **a gate command that fails when the code is wrong.** That assumption holds completely for a backend service, partially for a mobile app, and barely at all for a kiosk device. This document states where the line falls, so the platform can be honest about what it did not check instead of implying coverage it does not have.

The tier model is not invented here. It converges with four independent lineages: Google's test sizes (2010, classified by *resources required*, with "must fit on one machine" as the boundary), Android's local-vs-instrumented split, Flutter's unit/widget/integration trade-off table, and the MIL/SIL/PIL/HIL hierarchy that model-based embedded engineering has used for thirty years — the only one of the four that explicitly names "needs hardware" as a tier.

## The tiers

| Tier | What runs | Gate role | Blocks merge? |
|---|---|---|---|
| **T0 Static** | compile, typecheck, lint, format, dependency audit | Always | **Yes** |
| **T1 Host** | unit/component/widget tests, Robolectric, screenshot tests — one machine, no device | Always | **Yes** |
| **T2 Virtual** | emulator, simulator, xvfb, QEMU | Post-merge + nightly | **No — see below** |
| **T3 Managed** | Firebase Test Lab, Device Farm, emulator.wtf | Nightly / pre-release | No |
| **T4 Lab hardware** | provisioned devices, HIL rigs, peripherals, OEM ROMs | Manual trigger | No |
| **T5 Human** | enrollment, store review, accessibility, release signing | Checklist in the PR | Human gate |

### Why T2 does not block merge

A 2026 study of 4,518 CI-using Android repositories ([arXiv 2604.03438](https://arxiv.org/html/2604.03438v1)) measured what actually happens:

- Only **10.6%** run instrumentation tests in CI at all.
- Best-in-class community emulator setup: **65.3% success**, median 12.4 min.
- Third-party device labs: **32.2% success**, with **32.3% failing before the job started**.
- Best measured combination (community runner + Gradle Managed Devices): 88.2%.

A gate that fails a third of the time on correct code is not a gate — it teaches agents and humans alike to ignore it, and it will exhaust the pipeline's two-fix-attempt budget on infrastructure noise. Gate PRs on T0 + T1; run T2 after merge and nightly.

### Classify failures before counting fix attempts

The escalation rule in [CLAUDE.md](../CLAUDE.md) caps agents at two fix attempts. That cap must not be consumed by infrastructure:

- **Test failure** → counts; the agent fixes the code.
- **Infra failure** (emulator boot timeout, runner OOM, `gcloud` exit code 20) → does not count; retry once, then escalate as *infrastructure*, not as a code defect.

Firebase Test Lab makes this free: exit `10` = test cases failed, exit `20` = test infrastructure error.

## Android kiosk / COSU — the honest answer

This is the case worth spelling out, because it is the one most likely to be over-promised.

**Automatable on a CI emulator.** Device-owner provisioning is genuinely scriptable, and Google designed the path for exactly this: `adb shell dpm set-device-owner <pkg>/<receiver>`, which [AOSP documents](https://source.android.com/docs/devices/admin/testing-setup) while noting it "does not scale well, and was designed for testing in Android Emulator." From inside a test, `UiAutomation.executeShellCommand()` reaches the same mechanism — which is how Google's own CTS tests every `DevicePolicyManager` API, via the Bedstead framework's provision-assert-revert pattern.

So these are real gates: `setLockTaskPackages` / `isLockTaskPermitted`, entering lock task and asserting `getLockTaskModeState()`, the `onLockTaskModeEntering/Exiting` callbacks, non-allowlisted apps refusing to launch, `addPersistentPreferredActivity` home-intent resolution, user restrictions and global settings read back, and back/home/recents suppression.

**Two constraints that will silently break this if a generator gets them wrong:**
1. Use an **`aosp` or `google_apis` system image — never `google_apis_playstore`.** Play Store images are production builds where `adb root` is refused and a Google account is present, which violates the "no user accounts" precondition for `set-device-owner`.
2. The AVD must be **fresh or wiped**, because a device owner can only be set on an unprovisioned device. This conflicts directly with AVD snapshot caching: cache the image, not the provisioned state.

One trap worth naming: if `startLockTask()` is called without DPC allowlisting, it silently degrades to ordinary **screen pinning**, which the user can exit. A test asserting only "we are in some pinned state" passes on a non-provisioned emulator and proves nothing.

**Not automatable, at any tier below T4/T5 — put these on a human checklist:**

- Real enrollment: QR code, NFC bump, zero-touch, AFW#. All require a factory-reset device in out-of-box setup.
- Factory Reset Protection, and the "survives a wipe attempt" property that is the entire point of an unattended kiosk.
- Persistence across reboot, OTA, crash-loop and low-memory kill. Emulators do not reproduce real LMK pressure or OEM boot ordering.
- Physical button paths — power long-press, volume combos, hardware home keys, recovery entry.
- **OEM behaviour.** Samsung Knox, Zebra MX, Honeywell, generic AOSP builds all differ on keyguard, status bar and default-launcher handling. The emulator is pure AOSP; the kiosk will not ship on pure AOSP.
- Peripherals: scanners, payment terminals, printers, NFC readers, USB-OTG.
- Device farms do **not** close this gap. Neither Firebase Test Lab nor AWS Device Farm documents a pre-test `adb shell` hook, and both hand over a device whose account state you do not control — which is precisely what blocks `set-device-owner`.

**Summary:** the *policy-API surface* of a kiosk app is automatable. The *dedicated-device property* — that it stays locked, unattended, on this hardware, for months — is not. The pipeline's job is to verify the first and declare the second.

## Raising what T1 can cover

Two techniques pull work down from T2 to T1, which is where the leverage is:

- **Screenshot testing on the JVM** — Compose Preview Screenshot Testing (`./gradlew validateDebugScreenshotTest`), Paparazzi, or Roborazzi. Kiosk UI is typically one locked screen that never scrolls, which is exactly what these catch, at the price of a Linux runner minute rather than a device.
- **Robolectric** for framework-dependent logic, riding on the ordinary `./gradlew test` gate.

Most kiosk bugs live in policy-*decision* logic. Put `DevicePolicyManager` behind an interface, fake it, and test the decisions at T1.

## How the pipeline uses this

1. **Specs declare their unverifiable surface.** [specs/spec-template.md](../specs/spec-template.md) carries a table of checks a human must perform, on what hardware, with the pass condition. Agents cannot close these; the reviewer rejects a spec that needs them and omits them.
2. **Tasks carry a tier.** A task whose done-criteria are T4-only cannot be completed by an agent — it routes to a human sign-off gate. A developer agent discovering its task needs T4 verification must escalate rather than fake an emulator test.
3. **Generated CI puts T2 behind `workflow_dispatch`/`schedule` by default.** A team flips it to `pull_request` once they have seen the flake rate on their own repo.
