/**
 * Bootstraps one TradingView widget inside the sandboxed frame.
 *
 * Runs in an opaque origin (see embed.html), so it can reach TradingView and
 * nothing of the app's. Its only channel back to the parent is postMessage,
 * which carries two words and no data.
 */
(function () {
  'use strict';

  var BASE = 'https://s3.tradingview.com/external-embedding/embed-widget-';

  /**
   * Make this frame survivable for code that assumes storage exists.
   *
   * In a sandbox without allow-same-origin, reading `localStorage`,
   * `document.cookie` or `navigator.serviceWorker` does not return empty — it
   * throws a SecurityError. Third-party bundles routinely touch all three
   * while merely feature-detecting, so the isolation that protects the ledger
   * also rains uncaught exceptions into the widget, and there is no telling
   * which of them it fails to finish rendering through.
   *
   * These shims are per-frame and in memory: anything written to them is gone
   * on reload and was never reachable by the app in the first place, so
   * nothing is given away by providing them. What is bought is that the widget
   * gets `null` where it expected `null`, instead of an exception.
   *
   * An own property shadows the throwing accessor inherited from the
   * prototype, which is why defineProperty on the instance is enough.
   */
  function shim(target, name, value) {
    try {
      Object.defineProperty(target, name, { value: value, configurable: true, writable: true });
    } catch (_) {
      /* Nothing to do: the widget will have to cope, as it did before. */
    }
  }

  function memoryStorage() {
    var mem = Object.create(null);
    var api = {
      getItem: function (k) {
        return Object.prototype.hasOwnProperty.call(mem, k) ? mem[k] : null;
      },
      setItem: function (k, v) {
        mem[k] = String(v);
      },
      removeItem: function (k) {
        delete mem[k];
      },
      clear: function () {
        mem = Object.create(null);
      },
      key: function (i) {
        var keys = Object.keys(mem);
        return i < keys.length ? keys[i] : null;
      },
    };
    Object.defineProperty(api, 'length', {
      get: function () {
        return Object.keys(mem).length;
      },
    });
    return api;
  }

  function throws(read) {
    try {
      read();
      return false;
    } catch (_) {
      return true;
    }
  }

  // Only shimmed where the real thing actually throws, so that a frame which
  // for any reason does have storage keeps using it.
  if (throws(function () { return window.localStorage; })) shim(window, 'localStorage', memoryStorage());
  if (throws(function () { return window.sessionStorage; })) shim(window, 'sessionStorage', memoryStorage());
  if (throws(function () { return document.cookie; })) {
    var jar = '';
    try {
      Object.defineProperty(document, 'cookie', {
        configurable: true,
        get: function () {
          return jar;
        },
        set: function (v) {
          jar = String(v);
        },
      });
    } catch (_) {
      /* as above */
    }
  }
  if (throws(function () { return navigator.serviceWorker; })) shim(navigator, 'serviceWorker', undefined);

  /**
   * Which widgets this frame is willing to load.
   *
   * The name arrives in the URL, and the URL is trivially editable by anyone
   * who can open a frame. Without this, `?w=` would be a way to have this page
   * fetch and execute any path under that host. Cheap to check, so checked.
   */
  var ALLOWED = [
    'advanced-chart',
    'technical-analysis',
    'symbol-info',
    'timeline',
    'market-overview',
    'hotlists',
  ];

  function tell(state) {
    // The parent checks the source frame; the payload is deliberately trivial.
    try {
      parent.postMessage({ moneylab: 'embed', state: state }, '*');
    } catch (_) {
      /* the parent went away — nothing to do about it from in here */
    }
  }

  var params = new URLSearchParams(location.search);
  var widget = params.get('w') || '';
  var height = Number(params.get('h')) || 400;

  if (ALLOWED.indexOf(widget) === -1) {
    tell('error');
    return;
  }

  var config;
  try {
    config = JSON.parse(params.get('c') || '{}');
  } catch (_) {
    tell('error');
    return;
  }

  var inner = document.querySelector('.tradingview-widget-container__widget');
  if (inner) inner.style.height = height + 'px';

  var script = document.createElement('script');
  script.src = BASE + widget + '.js';
  script.async = true;
  script.type = 'text/javascript';
  // The widget reads its options from its own element's text content. This is
  // configuration, not code: the script tag has a src, so a browser never
  // executes what is written inside it.
  script.text = JSON.stringify(config);
  script.onload = function () {
    tell('ready');
  };
  script.onerror = function () {
    tell('error');
  };

  document.querySelector('.tradingview-widget-container').appendChild(script);
})();
