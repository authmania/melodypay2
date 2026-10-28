// MelodyPay — remote configuration shared with the admin panel.
// Reads the Firestore document account/melodypay2 from the same Firebase
// project the other projects use. Public read-only; the admin writes it.
(function () {
  var PROJECT = 'glamour-28049';
  var API_KEY = 'AIzaSyDrnmtx0LkfMKytzTKQZwXCg1JKZXiJmtU';
  var DOC_PATH = 'account/melodypay2';
  var URL = 'https://firestore.googleapis.com/v1/projects/' + PROJECT +
    '/databases/(default)/documents/' + DOC_PATH + '?key=' + API_KEY;
  var CACHE_KEY = 'melodypay:remoteConfig:' + DOC_PATH;

  function decode(v) {
    if (!v || typeof v !== 'object') return undefined;
    if ('stringValue' in v) return v.stringValue;
    if ('booleanValue' in v) return v.booleanValue;
    if ('integerValue' in v) return Number(v.integerValue);
    if ('doubleValue' in v) return Number(v.doubleValue);
    if ('timestampValue' in v) return v.timestampValue;
    if ('nullValue' in v) return null;
    if ('arrayValue' in v) return (v.arrayValue.values || []).map(decode);
    if ('mapValue' in v) {
      var o = {}, f = v.mapValue.fields || {};
      Object.keys(f).forEach(function (k) { o[k] = decode(f[k]); });
      return o;
    }
    return undefined;
  }

  window.MelodyConfig = {};

  window.MelodyConfigReady = fetch(URL, { cache: 'no-store' })
    .then(function (r) { return r.ok ? r.json() : null; })
    .then(function (j) {
      var out = {};
      if (j && j.fields) {
        Object.keys(j.fields).forEach(function (k) { out[k] = decode(j.fields[k]); });
      }
      Object.assign(window.MelodyConfig, out);
      try { localStorage.setItem(CACHE_KEY, JSON.stringify(out)); } catch (e) { /* ignore */ }
      return out;
    })
    .catch(function () {
      // Offline or blocked: fall back to the last config we saw.
      try {
        Object.assign(window.MelodyConfig, JSON.parse(localStorage.getItem(CACHE_KEY) || '{}'));
      } catch (e) { /* ignore */ }
      return window.MelodyConfig;
    });
})();
