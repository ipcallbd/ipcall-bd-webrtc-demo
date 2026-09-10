/**
 * IP Call BD — Simple WebRTC SIP Demo
 * Uses SIP.js over WSS to talk.ipcall.bd
 */

const $ = (id) => document.getElementById(id);

const ui = {
    statusDot: $('status-dot'),
    statusText: $('status-text'),
    loginPanel: $('login-panel'),
    dialerPanel: $('dialer-panel'),
    server: $('server'),
    username: $('username'),
    password: $('password'),
    connectBtn: $('connect-btn'),
    disconnectBtn: $('disconnect-btn'),
    number: $('number'),
    callInfo: $('call-info'),
    callParty: $('call-party'),
    callTimer: $('call-timer'),
    keypad: $('keypad'),
    actionsIdle: $('actions-idle'),
    actionsIncall: $('actions-incall'),
    actionsIncoming: $('actions-incoming'),
    callBtn: $('call-btn'),
    hangupBtn: $('hangup-btn'),
    muteBtn: $('mute-btn'),
    answerBtn: $('answer-btn'),
    rejectBtn: $('reject-btn'),
    backspaceBtn: $('backspace-btn'),
    logBody: $('log-body'),
    remoteAudio: $('remote-audio'),
};

let userAgent = null;
let registerer = null;
let session = null;
let registered = false;
let muted = false;
let timer = null;
let seconds = 0;

function refreshIcons() {
    if (window.lucide) lucide.createIcons();
}

function setMuteLabel(mutedState) {
    ui.muteBtn.innerHTML = mutedState
        ? '<i data-lucide="mic-off"></i><span>Unmute</span>'
        : '<i data-lucide="mic"></i><span>Mute</span>';
    refreshIcons();
}

function log(msg, type = '') {
    const line = document.createElement('div');
    line.className = `log-line ${type}`;
    line.textContent = `[${new Date().toLocaleTimeString()}] ${msg}`;
    ui.logBody.appendChild(line);
    ui.logBody.scrollTop = ui.logBody.scrollHeight;
    console.log(msg);
}

function setStatus(state, text) {
    ui.statusDot.className = 'status-dot ' + state;
    ui.statusText.textContent = text;
}

function wsUrl() {
    const host = ui.server.value.trim().replace(/^https?:\/\//, '').replace(/\/$/, '');
    return `wss://${host}/ws`;
}

function domain() {
    return ui.server.value.trim().replace(/^https?:\/\//, '').replace(/\/$/, '');
}

function showDialer() {
    ui.loginPanel.classList.add('hidden');
    ui.dialerPanel.classList.remove('hidden');
}

function showLogin() {
    ui.loginPanel.classList.remove('hidden');
    ui.dialerPanel.classList.add('hidden');
}

async function connect() {
    const user = ui.username.value.trim();
    const pass = ui.password.value.trim();
    const host = domain();

    if (!user || !pass || !host) {
        log('Please fill in server, extension, and password.', 'warn');
        return;
    }

    ui.connectBtn.disabled = true;
    setStatus('connecting', 'Connecting…');
    log(`Connecting to ${wsUrl()} as ${user}@${host}`);

    try {
        const uri = SIP.UserAgent.makeURI(`sip:${user}@${host}`);
        if (!uri) throw new Error('Invalid SIP URI');

        userAgent = new SIP.UserAgent({
            uri,
            transportOptions: { server: wsUrl() },
            authorizationUsername: user,
            authorizationPassword: pass,
            displayName: user,
            delegate: { onInvite: onIncomingCall },
            sessionDescriptionHandlerFactoryOptions: {
                peerConnectionConfiguration: {
                    iceServers: [{ urls: 'stun:stun.l.google.com:19302' }],
                },
            },
        });

        userAgent.transport.onDisconnect = (err) => {
            if (err) {
                log(`Disconnected: ${err.message}`, 'error');
                cleanup();
            }
        };

        await userAgent.start();
        registerer = new SIP.Registerer(userAgent, { expires: 120 });

        registerer.stateChange.addListener((state) => {
            if (state === SIP.RegistererState.Registered) {
                registered = true;
                setStatus('online', `Ext ${user}`);
                showDialer();
                log('Registered successfully', 'ok');
                ui.connectBtn.disabled = false;
            } else if (state === SIP.RegistererState.Unregistered || state === SIP.RegistererState.Terminated) {
                cleanup();
            }
        });

        await registerer.register();
    } catch (err) {
        log(`Connection failed: ${err.message}`, 'error');
        setStatus('error', 'Failed');
        ui.connectBtn.disabled = false;
        cleanup();
    }
}

function disconnect() {
    log('Disconnecting…');
    if (session) hangup();
    if (registerer) registerer.unregister().catch(() => {});
    if (userAgent) userAgent.stop().catch(() => {});
    cleanup();
}

function cleanup() {
    registered = false;
    registerer = null;
    userAgent = null;
    resetCallUi();
    setStatus('', 'Offline');
    showLogin();
    ui.connectBtn.disabled = false;
}

function makeCall() {
    const target = ui.number.value.trim();
    if (!target) {
        log('Enter a number to call', 'warn');
        return;
    }
    if (!registered || !userAgent) return;

    const targetUri = SIP.UserAgent.makeURI(`sip:${target}@${domain()}`);
    if (!targetUri) {
        log('Invalid number', 'error');
        return;
    }

    const inviter = new SIP.Inviter(userAgent, targetUri, {
        sessionDescriptionHandlerOptions: { constraints: { audio: true, video: false } },
    });

    session = inviter;
    bindSession(inviter, target);
    inviter.invite().catch((err) => {
        log(`Call failed: ${err.message}`, 'error');
        resetCallUi();
    });
    showInCall(target, 'Calling…');
    log(`Calling ${target}…`);
}

function onIncomingCall(invitation) {
    const from = invitation.remoteIdentity.uri.user || 'Unknown';
    session = invitation;
    bindSession(invitation, from);
    showIncoming(from);
    log(`Incoming call from ${from}`, 'warn');
}

function answerCall() {
    if (!session || !(session instanceof SIP.Invitation)) return;
    session.accept({
        sessionDescriptionHandlerOptions: { constraints: { audio: true, video: false } },
    }).catch((err) => {
        log(`Answer failed: ${err.message}`, 'error');
        resetCallUi();
    });
}

function rejectCall() {
    if (session instanceof SIP.Invitation) session.reject().catch(() => {});
    resetCallUi();
}

function hangup() {
    if (!session) return;
    try {
        if (session.state === SIP.SessionState.Established) {
            session.bye();
        } else if (session instanceof SIP.Inviter) {
            session.cancel();
        } else if (session instanceof SIP.Invitation) {
            session.reject();
        }
    } catch (err) {
        log(`Hangup error: ${err.message}`, 'error');
    }
    stopTimer();
    resetCallUi();
}

function toggleMute() {
    if (!session || session.state !== SIP.SessionState.Established) return;
    const pc = session.sessionDescriptionHandler?.peerConnection;
    if (!pc) return;

    muted = !muted;
    pc.getSenders().forEach((s) => {
        if (s.track?.kind === 'audio') s.track.enabled = !muted;
    });
    setMuteLabel(muted);
    log(muted ? 'Muted' : 'Unmuted');
}

function bindSession(s, party) {
    s.stateChange.addListener((state) => {
        if (state === SIP.SessionState.Established) {
            attachAudio(s);
            showInCall(party, null);
            startTimer();
            log(`Connected to ${party}`, 'ok');
        } else if (state === SIP.SessionState.Terminated) {
            log(`Call ended with ${party}`);
            stopTimer();
            resetCallUi();
        }
    });
}

function attachAudio(s) {
    const pc = s.sessionDescriptionHandler?.peerConnection;
    if (!pc) return;

    const play = (track) => {
        ui.remoteAudio.srcObject = new MediaStream([track]);
        ui.remoteAudio.play().catch(() => {});
    };

    pc.getReceivers().forEach((r) => {
        if (r.track?.kind === 'audio') play(r.track);
    });
    pc.ontrack = (e) => {
        if (e.track.kind === 'audio') play(e.track);
    };
}

function pressKey(key) {
    if (session?.state === SIP.SessionState.Established) {
        sendDtmf(key);
    } else {
        ui.number.value += key;
    }
}

function sendDtmf(tone) {
    const pc = session?.sessionDescriptionHandler?.peerConnection;
    const sender = pc?.getSenders().find((s) => s.track?.kind === 'audio');
    if (sender?.dtmf) sender.dtmf.insertDTMF(tone, 100, 70);
}

function showInCall(party, label) {
    ui.callInfo.classList.remove('hidden');
    ui.callParty.textContent = party;
    ui.callTimer.textContent = label || '00:00';
    ui.actionsIdle.classList.add('hidden');
    ui.actionsIncoming.classList.add('hidden');
    ui.actionsIncall.classList.remove('hidden');
    ui.keypad.classList.add('hidden');
}

function showIncoming(party) {
    ui.callInfo.classList.remove('hidden');
    ui.callParty.textContent = `Incoming: ${party}`;
    ui.callTimer.textContent = 'Ringing…';
    ui.actionsIdle.classList.add('hidden');
    ui.actionsIncall.classList.add('hidden');
    ui.actionsIncoming.classList.remove('hidden');
}

function resetCallUi() {
    session = null;
    muted = false;
    setMuteLabel(false);
    ui.number.value = '';
    ui.callInfo.classList.add('hidden');
    ui.actionsIdle.classList.remove('hidden');
    ui.actionsIncall.classList.add('hidden');
    ui.actionsIncoming.classList.add('hidden');
    ui.keypad.classList.remove('hidden');
    ui.remoteAudio.srcObject = null;
}

function startTimer() {
    seconds = 0;
    updateTimer();
    timer = setInterval(() => {
        seconds++;
        updateTimer();
    }, 1000);
}

function stopTimer() {
    clearInterval(timer);
    timer = null;
    seconds = 0;
}

function updateTimer() {
    const m = String(Math.floor(seconds / 60)).padStart(2, '0');
    const s = String(seconds % 60).padStart(2, '0');
    ui.callTimer.textContent = `${m}:${s}`;
}

// Events
ui.connectBtn.addEventListener('click', connect);
ui.disconnectBtn.addEventListener('click', disconnect);
ui.callBtn.addEventListener('click', makeCall);
ui.hangupBtn.addEventListener('click', hangup);
ui.muteBtn.addEventListener('click', toggleMute);
ui.answerBtn.addEventListener('click', answerCall);
ui.rejectBtn.addEventListener('click', rejectCall);
ui.backspaceBtn.addEventListener('click', () => {
    ui.number.value = ui.number.value.slice(0, -1);
});
ui.keypad.addEventListener('click', (e) => {
    const key = e.target.closest('[data-key]')?.dataset.key;
    if (key) pressKey(key);
});
$('log-toggle').addEventListener('click', () => {
    ui.logBody.classList.toggle('open');
});

document.addEventListener('keydown', (e) => {
    if (document.activeElement.tagName === 'INPUT' && document.activeElement !== ui.number) return;
    if (/^[0-9*#]$/.test(e.key)) pressKey(e.key);
    if (e.key === 'Enter' && registered && !session) makeCall();
    if (e.key === 'Escape' && session) hangup();
    if (e.key === 'Backspace' && !session) ui.number.value = ui.number.value.slice(0, -1);
});

log('IP Call BD WebRTC demo ready');
ui.logBody.classList.add('open');
refreshIcons();
