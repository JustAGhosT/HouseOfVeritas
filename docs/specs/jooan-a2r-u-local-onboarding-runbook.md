# JOOAN A2R-U Local Onboarding Runbook

**Applies to:** One JOOAN A2R-U camera and the front-yard camera pilot  
**Baton task:** `6a546afb-6397-44bb-af3e-2278cc48cb6d`  
**Goal:** Obtain a local Cam720 picture, then enable a private local RTSP stream for Deck to probe  
**Not in this runbook:** mounting, cloud recording, SD-card recording, audio, person detection, HOV, or remote access

## 1. Safety and privacy rules

- Do the first setup indoors with the camera facing a blank wall.
- Use only the supplied 5V/2A power adapter or a confirmed equivalent.
- Leave the microSD card out for now.
- Do not subscribe to cloud storage or enable recording, microphone, intercom, auto-tracking,
  device sharing, or alarm notifications.
- Do not post the camera QR code, device ID, Wi-Fi password, local IP address, camera username,
  camera password, or RTSP URL in chat, Baton, docs, screenshots, or source control.
- Unplugging the power is the reliable privacy stop until Deck's software privacy switch exists.
- Do not open router ports, enable port forwarding, or expose the camera to the public internet.

## 2. What you need

- The JOOAN A2R-U camera and its power adapter.
- An Android phone or iPhone.
- The name and password of a **2.4 GHz** Wi-Fi network.
- Access to the home router's connected-device list later in the runbook.
- A new, unique camera password. Do not reuse the Wi-Fi, email, HOV, or Cam720 password.

If the router combines 2.4 GHz and 5 GHz under one name, try the normal network first. If setup
fails repeatedly, temporarily use a 2.4-GHz-only or IoT network for onboarding.

## 3. Install Cam720 safely

1. On the phone, open Google Play or the Apple App Store.
2. Search for **Cam720**. Prefer the store listing reached from the QR/link in the printed JOOAN
   guide. Do not install an APK from an unrelated download site.
3. Install and open the app.
4. Grant Local Network or nearby-device access when requested. Camera access is needed only if the
   app asks to scan a setup QR code. Leave microphone and photo-library access denied unless a
   specific setup screen requires them.
5. If Cam720 offers **stand-alone**, **local**, or **guest** mode, use it first. The JOOAN guide says
   local viewing can work without account registration. If this firmware requires an account,
   create one with a dedicated email address and a unique app password.

Do not use the camera/device password as the Cam720 account password.

## 4. Reset and power the camera

1. Place the camera on a stable table facing a wall. Do not mount it yet.
2. Plug in the 5V/2A adapter.
3. Wait for the camera to rotate or announce that it is ready.
4. Locate the reset button. On this camera family it is commonly beside the microSD slot, sometimes
   revealed by gently tilting the lens assembly upward. Do not force the mechanism.
5. With power on, hold reset for about 5 seconds. Release it after the beep or voice prompt.
6. Wait for the self-test and the ready/configuration prompt.

If it reports that it is bound to another account after a reset, stop. Do not try random passwords;
the seller or JOOAN must release the device from the previous account.

## 5. Put the camera on Wi-Fi

1. Connect the phone to the intended 2.4 GHz Wi-Fi network.
2. In Cam720, tap **+** and choose **WiFi connection**.
3. Confirm the checkbox saying that the camera made its configuration tone, then tap **Next**.
4. When instructed, open the phone's Wi-Fi settings and join the temporary camera network. Its name
   normally starts with `JA-` or `JAA-`.
5. Return to Cam720. If the phone warns that the temporary network has no internet, choose to stay
   connected.
6. Select the intended home/IoT Wi-Fi and enter its password in the app.
7. Wait without unplugging the camera until Cam720 says the camera is online.
8. Tap the camera tile. Confirm that a live picture appears.

**Checkpoint A:** Stop here if no live picture appears. Record only the visible error wording and
the step that failed; do not include network names, QR codes, IDs, IP addresses, or passwords.

## 6. Apply safe initial settings

Open the camera tile, then use the gear or **More function settings** menu.

1. Rename the camera to `front-yard`.
2. Open **Camera information** and privately note the firmware/version number.
3. Set the correct time zone and confirm the displayed time is approximately correct.
4. Set or change the local device/camera password to the unique password prepared earlier.
5. Keep these features off:
   - microphone and voice intercom;
   - screen recording, SD-card recording, and cloud recording;
   - device sharing;
   - auto-tracking, cruise, and alarm actions.
6. Do not update firmware yet. First record the installed version and prove local RTSP. A firmware
   update will be considered afterward and must be followed by the same local-stream test.

Cam720's live-view microphone button must remain off. A disabled phone speaker is not proof that the
camera stopped capturing audio; Deck will later use a video-only stream path.

## 7. Find the camera locally without publishing its address

1. On the Deck PC, sign in to the home router's administration page.
2. Open **Connected devices**, **DHCP clients**, or **Network map**.
3. Identify the newly connected device by disconnecting and reconnecting camera power if necessary.
   It may appear as JOOAN, the temporary `JA-` name, or an unknown device.
4. Privately note its local IP address. Do not paste it into chat or Baton.
5. If the router supports a DHCP reservation, reserve the current address for this camera. This is
   optional for the first probe but will make Deck reconnect reliably.
6. Confirm there is no port-forwarding rule for this device. Do not create one.

## 8. Enable the local RTSP service

The exact menu varies by A2R-U firmware. Try the local web page first, then Cam720.

### Option A - local camera web page

1. On the Deck PC, open a browser and enter `http://` followed by the camera's private local IP.
   Keep that address out of screenshots and chat.
2. Sign in as `admin` using the local device password set in Cam720. Do not use the Cam720 account
   password. Do not continue with a blank/default camera password.
3. Look under **Network**, **Service**, **Advanced**, or **Protocol**.
4. Enable **RTSP** and require **Digest authentication**.
5. Chinese firmware may label these settings:
   - `RTSP使能` - RTSP enable;
   - `摘要认证` - digest authentication.
6. If an ONVIF switch or ONVIF user page exists, note that it exists but do not enable extra remote
   access, UPnP, P2P, or port forwarding.
7. Save and allow the camera to restart.

### Option B - Cam720 advanced settings

1. Open the camera tile, then the gear or **More function settings**.
2. Check **Camera information**, **Advanced settings**, **Local service**, **RTSP**, or **ONVIF**.
3. Enable RTSP with digest authentication if offered.
4. Privately note whether ONVIF is present and whether it uses a separate local username/password.

Do not construct or paste a credential-bearing RTSP URL. Deck's local probe will assemble and use it
inside the trusted backend. Public reports suggest this model commonly provides two H.264 profiles
under `/live/ch00_0` and `/live/ch00_1`, but the probe must confirm which profile this unit exposes.

**Checkpoint B:** Stop if neither the local web page nor Cam720 exposes RTSP/ONVIF. Do not install
replacement firmware or open the camera. Report only: `No RTSP/ONVIF setting found`.

## 9. What to report back

Reply with only this template:

```text
Cam720 live picture: yes/no
Firmware version: <version only>
Local web page: yes/no
RTSP setting: enabled/not found
Digest authentication: enabled/not found
ONVIF setting: present/not found
Camera/device password changed from default: yes/no
Audio, recording, sharing, and auto-tracking off: yes/no
Camera time approximately correct: yes/no
```

Do not include the camera IP, device ID, QR code, username, password, Wi-Fi name, Wi-Fi password, or
full RTSP URL.

## 10. Troubleshooting

### No power or self-test

- Reseat the supplied adapter at both ends and try a known-working outlet.
- Confirm the adapter output matches the camera label: 5V/2A.
- Stop if the adapter or camera becomes unusually hot, smells burnt, or shows cable damage.

### The `JA-` or `JAA-` Wi-Fi network never appears

- Keep the phone close to the camera.
- Repeat the powered reset and wait for the ready prompt.
- Temporarily disable mobile data or the phone's automatic switch-away-from-no-internet feature.

### Wi-Fi setup fails

- Confirm the phone is using 2.4 GHz Wi-Fi.
- Re-enter the Wi-Fi password locally.
- Avoid a guest network that prevents devices from reaching each other; Deck must be able to reach
  the camera locally.
- Move the camera beside the router for onboarding, then test the intended placement later.

### Cam720 says the device belongs to another account

- Perform one factory reset.
- If the message remains, stop and contact the seller/JOOAN with the device details privately.

### Cam720 works but the local web page does not

- Confirm the PC and camera are on networks allowed to communicate.
- Recheck the current address in the router's connected-device list.
- Do not scan the whole LAN or disable the firewall. Report `Cam720 works; local web page absent`.

### RTSP exists but ONVIF does not

- This is acceptable for Slice 0. Deck can proceed with a compiled RTSP adapter if the real stream
  probe confirms a stable H.264 profile. PTZ remains out of scope.

## 11. Completion boundary

This runbook is complete only when:

- Cam720 shows the real camera locally;
- a unique local camera password is set;
- audio, recording, sharing, tracking, and cloud subscription remain off;
- the firmware and clock state are known;
- RTSP is enabled with digest authentication, or an exact `not found` blocker is recorded; and
- no secret, full URI, device identifier, or local address has been copied into project systems.

After Checkpoint B, Codex owns the bounded Deck probe, redacted capability report, and adapter
decision. The operator should not test a credential-bearing URL in a shell command or screenshot.

Run the repository probe from PowerShell when Codex requests Checkpoint C:

```powershell
pwsh -NoProfile -File .\scripts\probe-camera-onvif.ps1 `
  -RtspProbeExecutable C:\tmp\deck-camera-edge\target\debug\camera_rtsp_probe.exe `
  -CredentialProvisionExecutable C:\tmp\deck-camera-edge\target\debug\camera_credential_provision.exe
```

Enter the camera address, local username, and password only at the masked prompts. The probe follows
only ONVIF service addresses returned for the same camera host and prints a redacted profile report;
it passes the selected RTSP locator and credentials to Deck over redirected standard input, proves a
real H.264 frame twice, and never prints the address, username, password, profile token, or RTSP URI.
When the optional provisioning executable is supplied, the same already-masked values are written
once to Windows Credential Manager under Deck's opaque `front-yard` reference. They are not written
to JSON config, shell arguments, environment variables, logs, or the webview.

## Sources

- [JOOAN A2R-U WiFi Camera User Guide](https://manuals.plus/jooan/a2r-u-wifi-camera-manual)
- [JOOAN A2R-U local RTSP setup report](https://community.home-assistant.io/t/recommended-ip-cams-for-home-and-outdoor-usage-with-ha/57781/27)
- [JOOAN A2R-U RTSP path catalogue](https://www.ispyconnect.com/camera/jooan)
