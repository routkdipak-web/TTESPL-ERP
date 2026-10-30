/* TTESPL ERP v44.8 - STAFF ACCOUNTS (privacy)
   - Nobody can create a staff account by themselves any more: only the Admin adds staff (Staff Manager > Add staff). Username = mobile number.
   - "My Account": every employee changes his OWN password, PIN and date of birth (needs the current password).
   - Forgot password: mobile number + (security PIN  OR  date of birth typed as ddmmyyyy, no slash) + new password.
   Only hashes are stored (same PBKDF2 as passwords). Wrong tries lock the reset for 5 minutes on that phone. */
(function () {
  'use strict';
  function $(i) { return document.getElementById(i); }
  function H(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function emps() { return (typeof registeredEmployees !== 'undefined' && registeredEmployees) || []; }
  function secureOn() { try { return !!(window.ttV41 && ttV41.secureOn && ttV41.secureOn()); } catch (e) { return false; } }
  function validDob(s) {
    s = String(s || '').trim(); if (!/^\d{8}$/.test(s)) return false;
    var d = +s.slice(0, 2), m = +s.slice(2, 4), y = +s.slice(4), t = new Date(y, m - 1, d);
    return y >= 1900 && y <= new Date().getFullYear() && t.getFullYear() === y && t.getMonth() === m - 1 && t.getDate() === d;
  }
  window.ttValidDob = validDob;

  /* ---------- 1. no self sign-up (only the very first Admin of an empty system) ---------- */
  var st = document.createElement('style'); st.textContent = '[onclick*="showAuthMode(\'register\'"]{display:none!important}body.tt-nostaff [onclick*="showAuthMode(\'register\'"]{display:inline!important}'; document.head.appendChild(st);
  function sync() { try { document.body.classList.toggle('tt-nostaff', emps().length === 0 && !!window.ttCloudInitialLoadDone); } catch (e) {} }
  setInterval(sync, 1500); sync();
  (function () {
    var f = window.showAuthMode; if (typeof f === 'function') window.showAuthMode = function (mode) { if (mode === 'register' && emps().length > 0) { alert('New accounts are created by the Admin only. Please ask the Admin to add you (your mobile number will be your username).'); mode = 'login'; } return f.call(this, mode); };
    var r = window.processRegister; if (typeof r === 'function') window.processRegister = function () { if (emps().length > 0) { alert('New accounts are created by the Admin only.'); return; } return r.apply(this, arguments); };
  })();

  /* ---------- 2. Admin adds staff: optional date of birth ---------- */
  (function () {
    var o = window.ttOpenAddStaff; if (typeof o !== 'function') return;
    window.ttOpenAddStaff = function () {
      var r = o.apply(this, arguments);
      try { var pin = $('tt41SfPin'); if (pin && !$('tt41SfDob')) { var i = document.createElement('input'); i.className = 'tt41-in'; i.id = 'tt41SfDob'; i.setAttribute('inputmode', 'numeric'); i.maxLength = 8; i.placeholder = 'Date of birth ddmmyyyy (for forgot password, optional)'; i.autocomplete = 'off'; pin.insertAdjacentElement('afterend', i); } } catch (e) {}
      return r;
    };
    var g = window.ttAddStaffGo; if (typeof g !== 'function') return;
    window.ttAddStaffGo = async function () {
      var dob = ($('tt41SfDob') || {}).value || '', mob = (($('tt41SfMob') || {}).value || '').replace(/\D/g, '');
      dob = dob.replace(/\D/g, ''); if (dob && !validDob(dob)) return alert('Date of birth must be 8 digits like 05071995 (ddmmyyyy, no slash).');
      var n0 = emps().length, r = await g.apply(this, arguments);
      try { if (dob && emps().length > n0) { var u = emps().filter(function (e) { return e.mobile === mob; })[0]; if (u) { u.dobHash = await ttHashSecret(dob); setStored('STAFF', registeredEmployees); } } } catch (e) { console.warn(e); }
      return r;
    };
  })();

  /* ---------- 3. My Account ---------- */
  function me() { try { return emps().filter(function (e) { return currentUser && String(e.id) === String(currentUser.id); })[0] || null; } catch (e) { return null; } }
  window.ttOpenMyAccount = function () {
    var u = me(); if (!u) return alert('Please login first.');
    var html = '<div class="tt41-sub"><b>' + H(u.name) + '</b> · ' + H(u.role) + '<br>Username: <b>' + H(u.mobile) + '</b> (your mobile number)</div>' +
      '<div class="tt41-sub" style="margin-top:8px">Date of birth: <b>' + (u.dobHash ? 'saved ✓' : 'not saved – add it so you can reset a forgotten password') + '</b></div>' +
      '<input type="password" class="tt41-in" id="maCur" placeholder="Your CURRENT password (required)" autocomplete="current-password">' +
      '<div style="font-weight:800;margin:12px 0 4px">New password <small style="font-weight:400">(leave blank to keep)</small></div><input type="password" class="tt41-in" id="maNew" placeholder="New password (min 6)" autocomplete="new-password"><input type="password" class="tt41-in" id="maNew2" placeholder="Type the new password again" autocomplete="new-password">' +
      '<div style="font-weight:800;margin:12px 0 4px">New security PIN <small style="font-weight:400">(leave blank to keep)</small></div><input type="password" class="tt41-in" id="maPin" inputmode="numeric" maxlength="6" placeholder="4 or 6 digits" autocomplete="new-password">' +
      '<div style="font-weight:800;margin:12px 0 4px">Date of birth <small style="font-weight:400">(ddmmyyyy, no slash)</small></div><input class="tt41-in" id="maDob" inputmode="numeric" maxlength="8" placeholder="e.g. 05071995" autocomplete="off">' +
      '<button class="btn btn-primary" style="width:100%;margin-top:12px" onclick="ttMyAccSave()">💾 Save changes</button>';
    ttV41.modal('ttMyAcc', '🔑 My Account', html);
  };
  window.ttMyAccSave = async function () {
    var u = me(); if (!u) return;
    var cur = ($('maCur') || {}).value || '', np = ($('maNew') || {}).value || '', np2 = ($('maNew2') || {}).value || '', pin = (($('maPin') || {}).value || '').trim(), dob = (($('maDob') || {}).value || '').replace(/\D/g, '');
    var lk = ttLoginGuardMsg('acc:' + u.mobile); if (lk) return alert(lk);
    if (!cur) return alert('Please type your current password.');
    if (!np && !pin && !dob) return alert('Nothing to change. Fill the new password, PIN or date of birth.');
    if (np && np.length < 6) return alert('New password must be at least 6 characters.');
    if (np && np !== np2) return alert('The two new passwords do not match.');
    if (pin && !/^(\d{4}|\d{6})$/.test(pin)) return alert('PIN must be 4 or 6 digits.');
    if (dob && !validDob(dob)) return alert('Date of birth must be 8 digits like 05071995 (ddmmyyyy, no slash).');
    if (!(await ttCheckSecret(u, 'pass', cur))) { ttLoginGuardFail('acc:' + u.mobile); return alert(ttLoginGuardMsg('acc:' + u.mobile) || 'Your current password is wrong.'); }
    ttLoginGuardClear('acc:' + u.mobile);
    var done = [];
    if (np) { u.passHash = await ttHashSecret(np); delete u.pass; done.push('password'); }
    if (pin) { u.pinHash = await ttHashSecret(pin); delete u.pin; done.push('PIN'); }
    if (dob) { u.dobHash = await ttHashSecret(dob); done.push('date of birth'); }
    setStored('STAFF', registeredEmployees);
    try { ttActAdd && ttActAdd('Staff', 'self-changed ' + done.join(', '), u.name, ''); } catch (e) {}
    var m = $('ttMyAcc'); if (m) m.remove();
    alert('Saved: ' + done.join(', ') + '.');
  };
  function inject() {
    try {
      var list = document.querySelector('#profileDropdownCard .profile-menu-list');
      if (list && !list.querySelector('.tt44-acc')) {
        var d = document.createElement('div'); d.className = 'profile-menu-item tt44-acc'; d.setAttribute('onclick', 'triggerAppHaptic(); ttOpenMyAccount(); closeProfileDrawer();');
        d.innerHTML = '<div class="profile-menu-item-left"><span>🔑</span><span>My Account (password / PIN)</span></div>'; list.insertBefore(d, list.firstChild);
      }
    } catch (e) {}
  }
  inject(); setTimeout(inject, 1500); setTimeout(inject, 5000); setInterval(inject, 6000);

  /* ---------- 4. Forgot password: PIN or date of birth ---------- */
  (function () {
    var prev = window.processPasswordReset; if (typeof prev !== 'function') return;
    window.processPasswordReset = async function () {
      var dob = (($('recDob') || {}).value || '').replace(/\D/g, '');
      if (secureOn() || !dob) return prev.apply(this, arguments);
      var mobile = ($('recPhone').value || '').trim(), newPass = ($('recNewPass').value || '').trim(), key = 'reset:' + mobile;
      var lk = ttLoginGuardMsg(key); if (lk) return alert(lk);
      if (!validDob(dob)) return alert('Date of birth must be 8 digits like 05071995 (ddmmyyyy, no slash).');
      if (newPass.length < 6) return alert('Password must be at least 6 characters!');
      var user = emps().filter(function (u) { return u.mobile === mobile; })[0];
      if (user && !user.dobHash) return alert('No date of birth is saved for this account. Use your security PIN, or ask the Admin.');
      if (user && await ttVerifyHash(dob, user.dobHash)) {
        ttLoginGuardClear(key); user.passHash = await ttHashSecret(newPass); delete user.pass; setStored('STAFF', registeredEmployees);
        alert('Password updated successfully! Please login now.'); try { showAuthMode('login'); } catch (e) {}
      } else { ttLoginGuardFail(key); alert(ttLoginGuardMsg(key) || 'Mobile number or date of birth did not match.'); }
    };
  })();
})();
