/* TTESPL ERP v43 - FINGERPRINT / FACE UNLOCK (26)
   Adds a "Use fingerprint" button to the existing PIN lock screen. Uses the phone's own biometric (WebAuthn platform authenticator).
   The fingerprint never leaves the phone and the PIN keeps working. Like the PIN, this is a convenience lock on this device. */
(function () {
  'use strict';
  var X = window.ttx; if (!X) return;
  var BK = 'TTESPL_ERP_BIO_ID', PK = 'TTESPL_ERP_LOCK_PIN', ID = 'ttBio';
  function ls(k) { try { return localStorage.getItem(k); } catch (e) { return null; } }
  function lset(k, v) { try { localStorage.setItem(k, v); } catch (e) {} }
  function b64(buf) { var s = ''; new Uint8Array(buf).forEach(function (b) { s += String.fromCharCode(b); }); return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, ''); }
  function unb64(s) { s = s.replace(/-/g, '+').replace(/_/g, '/'); while (s.length % 4) s += '='; var a = atob(s), u = new Uint8Array(a.length); for (var i = 0; i < a.length; i++) u[i] = a.charCodeAt(i); return u; }
  function rnd(n) { var a = new Uint8Array(n); crypto.getRandomValues(a); return a; }
  function supported() { return !!(window.PublicKeyCredential && navigator.credentials && window.isSecureContext); }
  function platformOk() { return supported() && PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable ? PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable().catch(function () { return false; }) : Promise.resolve(false); }
  function on() { return !!ls(BK) && !!ls(PK); }

  function enroll() {
    var who = (typeof currentUser !== 'undefined' && currentUser && currentUser.name) || 'TTESPL user';
    return navigator.credentials.create({ publicKey: {
      challenge: rnd(32), rp: { name: 'TTESPL ERP', id: location.hostname }, user: { id: rnd(16), name: who, displayName: who },
      pubKeyCredParams: [{ type: 'public-key', alg: -7 }, { type: 'public-key', alg: -257 }],
      authenticatorSelection: { authenticatorAttachment: 'platform', userVerification: 'required', residentKey: 'discouraged' }, timeout: 60000, attestation: 'none'
    } }).then(function (c) { lset(BK, b64(c.rawId)); return true; });
  }
  function verify() {
    var id = ls(BK); if (!id) return Promise.reject(new Error('not enrolled'));
    return navigator.credentials.get({ publicKey: { challenge: rnd(32), rpId: location.hostname, allowCredentials: [{ type: 'public-key', id: unb64(id), transports: ['internal'] }], userVerification: 'required', timeout: 60000 } });
  }
  function unlock() {
    return verify().then(function () { var d = document.getElementById('tt25Lock'); if (d) d.remove(); return true; });
  }
  window.ttBioUnlock = unlock;

  /* lock screen: add the button (and try once automatically) */
  function onLock(box) {
    if (!on() || box.querySelector('#ttBioBtn')) return;
    var host = box.querySelector('.tt25-lk') || box; var b = document.createElement('button');
    b.id = 'ttBioBtn'; b.type = 'button'; b.className = 'btn btn-outline btn-block'; b.style.marginTop = '10px'; b.textContent = '👆 Use fingerprint / face';
    b.onclick = function () { unlock().catch(function () { var e = document.getElementById('tt25LockErr'); if (e) e.textContent = 'Fingerprint not recognised - use PIN'; }); };
    host.appendChild(b); setTimeout(function () { unlock().catch(function () {}); }, 350);
  }
  new MutationObserver(function () { var d = document.getElementById('tt25Lock'); if (d) onLock(d); }).observe(document.documentElement, { childList: true, subtree: true });
  var d0 = document.getElementById('tt25Lock'); if (d0) onLock(d0);

  /* settings sheet */
  function draw() {
    platformOk().then(function (ok) {
      var pin = !!ls(PK), enrolled = !!ls(BK), h;
      if (!supported()) h = '<div class="ttx-note">This browser / connection does not support fingerprint unlock (needs HTTPS and a phone with a fingerprint or face lock).</div>';
      else if (!ok) h = '<div class="ttx-note">No fingerprint / face lock was found on this phone. Set one in phone Settings → Security, then come back.</div>';
      else h = '<div class="ttx-note">Status: <b>' + (on() ? '✅ ON' : (enrolled && !pin ? 'Saved, but the PIN is off' : 'OFF')) + '</b></div>' +
        (pin ? '' : '<div class="ttx-note" style="color:#d97706">Fingerprint works together with the app PIN. Set a PIN first.</div><div class="ttx-btns"><button class="ttx-b pri" data-a="pin">🔢 Set PIN</button></div>') +
        '<div class="ttx-btns" style="flex-wrap:wrap">' + (pin && !enrolled ? '<button class="ttx-b pri" data-a="on" style="flex:1 1 100%">👆 Turn ON fingerprint unlock</button>' : '') +
        (enrolled ? '<button class="ttx-b" data-a="test" style="flex:1 1 48%">🧪 Test</button><button class="ttx-b" data-a="off" style="flex:1 1 48%;color:#dc2626">Turn OFF</button>' : '') + '</div>' +
        '<div class="ttx-note" style="font-size:11.5px;opacity:.8">When the app is locked you will see a “Use fingerprint” button. The PIN always works too. Your fingerprint stays inside the phone; the app only learns “yes / no”.</div>';
      X.sheet(ID, '👆 Fingerprint unlock', h, { z: 3900 });
      X.bind(ID, { click: {
        pin: function () { X.close(ID); if (window.ttLockSetPin) ttLockSetPin(); setTimeout(draw, 600); },
        on: function () { enroll().then(function () { X.toast('Fingerprint unlock is ON'); draw(); }).catch(function (e) { X.toast('Could not turn on: ' + (e && e.name === 'NotAllowedError' ? 'cancelled' : (e && e.message || e)), 1); }); },
        test: function () { verify().then(function () { X.toast('Works ✓'); }).catch(function () { X.toast('Not recognised', 1); }); },
        off: function () { try { localStorage.removeItem(BK); } catch (e) {} X.toast('Fingerprint unlock is OFF'); draw(); }
      } });
    });
  }
  window.ttOpenBiometric = draw;
  function inject() {
    try {
      var list = document.querySelector('#profileDropdownCard .profile-menu-list');
      if (list && !list.querySelector('.tt43-bio')) {
        var d = document.createElement('div'); d.className = 'profile-menu-item tt43-bio'; d.setAttribute('onclick', 'triggerAppHaptic(); ttOpenBiometric(); closeProfileDrawer();');
        d.innerHTML = '<div class="profile-menu-item-left"><span>👆</span><span>Fingerprint Unlock</span></div><span style="font-size:10px;color:#38bdf8;">App lock</span>';
        list.appendChild(d);
      }
    } catch (e) {}
  }
  inject(); setTimeout(inject, 1500); setTimeout(inject, 5000); setInterval(inject, 6000);
})();
