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
