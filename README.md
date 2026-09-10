# IP Call BD — WebRTC Demo

A minimal browser-based SIP phone that connects to **talk.ipcall.bd** over WebRTC (WSS).

## Demo credentials

| Field      | Value            |
|------------|------------------|
| Server     | `talk.ipcall.bd` |
| Extension  | `55500`          |
| Password   | `Demo1234`       |

## Run locally

WebRTC needs a secure context. Use any static server:

```bash
# Python
python3 -m http.server 8080

# or Node
npx serve .
```

Open **https://localhost:8080** (or use a tunnel like ngrok for microphone access over HTTP).

> **Tip:** Chrome allows `localhost` over HTTP for mic access. For other hosts, use HTTPS.

## How to use

1. Open the page — credentials are pre-filled.
2. Click **Connect** to register with the PBX.
3. Dial a number on the keypad and press the green call button.
4. Use **Mute** / **Hang up** during a call.
5. Incoming calls show **Answer** / **Reject**.

## Files

| File               | Purpose                    |
|--------------------|----------------------------|
| `index.html`       | UI                         |
| `app.js`           | SIP.js WebRTC logic        |
| `style.css`        | Styles                     |
| `sip-0.21.2.min.js`| SIP.js library (bundled)   |

## Requirements

- Modern browser (Chrome, Edge, Firefox, Safari)
- Microphone permission
- Network access to `wss://talk.ipcall.bd/ws`

## Support

For any kind of issue, contact:

- **Email:** [support@ipcall.bd](mailto:support@ipcall.bd)
- **Call:** [09639991234](tel:+8809639991234)
- **WhatsApp:** [01891116631](https://wa.me/8801891116631?text=Hi%2C%20I%20need%20help%20with%20the%20IP%20Call%20BD%20WebRTC%20Demo.)
