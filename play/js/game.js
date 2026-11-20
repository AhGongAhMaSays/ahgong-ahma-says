/* ============================================================
   AhGong & AhMa Says — Dialect Match
   A turn-based memory-matching game: pick how many are playing,
   everyone enters a name, then take turns flipping cards to pair
   each Hokkien phrase with its meaning. Finding a pair keeps your
   turn; missing passes it to the next player.
   ============================================================ */

(function () {
  var IMG_DIR   = '../03%20Matching%20Card%20Game/Assets/';
  var CARD_DIR  = '../03%20Matching%20Card%20Game/Assets/Cards%20-%20Desktop%20View/';
  var CARD_BACK = CARD_DIR + 'Back.jpg';

  // same card art on mobile as desktop — mobile just shows fewer pairs
  // (PAIRS_PER_GAME_MOBILE, below), not different images
  function cardSrc(num) {
    return CARD_DIR + num + '.jpg';
  }
  function cardBackSrc() {
    return CARD_BACK;
  }

  // 10 phrase pairs — each is [Hokkien-face card number, meaning-face card number]
  var PAIRS = [[5, 6], [7, 8], [9, 10], [11, 12], [13, 14], [15, 16], [17, 18], [19, 20], [21, 22], [23, 24]];
  var PAIRS_PER_GAME = 5;        // desktop: 5 pairs = 10 cards
  var PAIRS_PER_GAME_MOBILE = 4; // mobile (≤860px): 4 pairs = 8 cards — fitBoard's own adaptive column search picks whatever shape best fits this many cards

  // FLIP_BACK is matched to the CSS card-flip transition (.5s)
  var FLIP_BACK = 500;      // the flip-back animation, before the board is rebuilt
  var MATCH_COLLECT = 472.5;  // the "fly into the score box" animation, before the board is rebuilt — matched to .card.is-collecting's transition in game.css (450ms, then 5% slower)

  var app = document.getElementById('app');

  // every per-player asset the board/name screens swap to on demand (keyed
  // by player index, 1-6) — without warming these, the first time a given
  // player's colour comes up (a new name field, a new turn) its image has
  // to be freshly downloaded and decoded right at that moment, which is
  // what read as the name field lagging when a new player's turn to type
  // came up. Kicking off every fetch now, before the player picks a count,
  // gives them the rest of the setup flow to finish loading in the background.
  (function preloadPlayerAssets() {
    var dir = '../03%20Matching%20Card%20Game/Assets/';
    for (var i = 1; i <= 6; i++) {
      (new Image()).src = dir + 'field-' + i + 'playername%20400x100px.png';
      (new Image()).src = dir + 'img-' + i + 'playername202x82px.png';
      (new Image()).src = dir + 'img-' + i + 'playerturn455x125px.png';
    }
  })();

  // the footer is hidden while a board is showing (see body.in-game in game.css)
  function setInGame(on) {
    document.body.classList.toggle('in-game', on);
  }

  var state = {
    count: 0,
    names: [],
    nameStep: 0,
    turn: 0,
    scores: [],
    won: [],         // won[playerIndex] = [[a,b], [a,b], ...] pair numbers
    pairs: [],       // this game's pairs, drawn from PAIRS
    deck: [],        // [{num, pairId}]
    matchedPairIds: {},   // pairId -> true, survives board re-renders
    flipped: [],     // currently face-up, unresolved card elements
    pendingMiss: null,    // [a, b] — a shown mismatch, waiting for the player to dismiss it
    pendingMatch: null,   // [a, b] — a shown match, waiting for the player to clear it off the board
    matchedCount: 0,
    lock: false,
    isMobile: false   // set once per game, in startGame() — only affects how many pairs are dealt
  };

  function esc(s) {
    return String(s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  /* ============================================================
     Desktop-only: a Play Again button in the persistent header,
     to the left of EXIT — only exists while the results screen is
     showing. The header (unlike #app) is never torn down by a
     render, so this is injected/removed directly rather than being
     part of any renderX()'s own HTML string. CSS hides it on mobile,
     where the original button inside the results screen stays put
     (see .replay-icon-btn in game.css).
     ============================================================ */
  var chromeTopRight = document.querySelector('.chrome-top-right');

  function removeHeaderReplayBtn() {
    var btn = chromeTopRight.querySelector('.replay-icon-btn');
    if (btn) btn.remove();
  }

  function addHeaderReplayBtn() {
    var btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'icon-btn replay-icon-btn press';
    btn.setAttribute('aria-label', 'Play again');
    btn.innerHTML = '<img src="../00%20Shared%20Assets/btn-playagain%20505x105px.png" alt="" />';
    btn.addEventListener('click', renderCount);
    chromeTopRight.insertBefore(btn, chromeTopRight.firstChild);
  }

  /* ============================================================
     SCREEN 1 — how many are playing?
     ============================================================ */

  function renderCount() {
    removeHeaderReplayBtn();   // only ever leaving the results screen by way of here
    setInGame(false);
    var html = '<div class="screen">' +
      '<div class="popup">' +
        '<h2 class="h2">How many people are playing?</h2>' +
        '<div class="count-grid">' +
          [1, 2, 3, 4, 5, 6].map(function (n) {
            return '<button type="button" class="count-btn press" data-count="' + n + '">' +
              '<img src="../03%20Matching%20Card%20Game/Assets/btn-' + n + 'player%20120x117px.png" alt="' + n + '" />' +
            '</button>';
          }).join('') +
        '</div>' +
      '</div>' +
    '</div>';
    app.innerHTML = html;

    app.querySelectorAll('.count-btn').forEach(function (btn) {
      btn.addEventListener('click', function () {
        state.count = Number(btn.getAttribute('data-count'));
        state.names = [];
        state.nameStep = 0;
        renderName();
      });
    });
  }

  /* ============================================================
     SCREEN 2 — one name-entry card per player
     ============================================================ */

  function renderName() {
    removeHeaderReplayBtn();   // defensive — it should already be gone by here, this just guarantees it
    setInGame(false);
    var i = state.nameStep;
    var last = i + 1 >= state.count;
    var html = '<div class="screen">' +
      '<div class="popup popup--name">' +
        '<h2 class="h2">Player ' + (i + 1) + '</h2>' +
        '<div class="name-field" style="background-image:url(\'../03%20Matching%20Card%20Game/Assets/field-' + (i + 1) + 'playername%20400x100px.png\')">' +
          '<input type="text" maxlength="24" autocomplete="off" autocapitalize="words" enterkeyhint="' + (last ? 'go' : 'next') + '" placeholder="Enter your name here" />' +
        '</div>' +
        '<button type="button" class="next-btn press" aria-label="' + (last ? 'Start playing' : 'Next') + '">' +
          '<img src="../00%20Shared%20Assets/btn-next%2080x78px.png" alt="" />' +
        '</button>' +
      '</div>' +
    '</div>';
    app.innerHTML = html;

    var input = app.querySelector('.name-field input');
    input.focus();

    function advance() {
      var name = input.value.trim() || ('Player ' + (i + 1));
      state.names[i] = name;
      state.nameStep = i + 1;
      if (state.nameStep < state.count) {
        renderName();
      } else {
        startGame();
      }
    }

    input.addEventListener('keydown', function (e) { if (e.key === 'Enter') advance(); });
    app.querySelector('.next-btn').addEventListener('click', advance);
  }

  /* ============================================================
     SCREEN 3 — the board
     ============================================================ */

  function shuffle(arr) {
    for (var i = arr.length - 1; i > 0; i--) {
      var j = Math.floor(Math.random() * (i + 1));
      var t = arr[i]; arr[i] = arr[j]; arr[j] = t;
    }
    return arr;
  }

  function startGame() {
    state.turn = 0;
    state.scores = state.names.map(function () { return 0; });
    state.won = state.names.map(function () { return []; });
    state.matchedCount = 0;
    state.matchedPairIds = {};
    state.flipped = [];
    state.pendingMiss = null;
    state.pendingMatch = null;
    state.lock = false;

    state.isMobile = window.matchMedia('(max-width: 860px)').matches;
    var pairsPerGame = state.isMobile ? PAIRS_PER_GAME_MOBILE : PAIRS_PER_GAME;
    state.pairs = shuffle(PAIRS.slice()).slice(0, pairsPerGame);

    var cards = [];
    state.pairs.forEach(function (pair, pairId) {
      cards.push({ num: pair[0], pairId: pairId });
      cards.push({ num: pair[1], pairId: pairId });
    });
    state.deck = shuffle(cards);

    renderBoard();
  }

  function scoreBarHtml() {
    return '<div class="score-bar">' +
      state.names.map(function (name, i) {
        return '<div class="score-box' + (i === state.turn ? ' is-turn' : '') + '" style="background-image:url(\'' + IMG_DIR + 'img-' + (i + 1) + 'playername202x82px.png\')">' +
          '<span class="name">' + esc(name) + '</span><span class="count">' + state.scores[i] + '</span>' +
        '</div>';
      }).join('') +
    '</div>';
  }

  function renderBoard() {
    removeHeaderReplayBtn();   // defensive — it should already be gone by here, this just guarantees it
    setInGame(true);
    var html = '<div class="screen screen--board">' +
      scoreBarHtml() +
      '<div class="board-grid">' +
        state.deck.map(function (card, idx) {
          var matched = !!state.matchedPairIds[card.pairId];
          return '<div class="card' + (matched ? ' is-matched' : '') + '" data-idx="' + idx + '"' +
            ' role="button" tabindex="0" aria-label="Card ' + (idx + 1) + (matched ? ', matched' : ', face down') + '">' +
            '<div class="card-inner">' +
              '<div class="card-face card-back"><img src="' + cardBackSrc() + '" alt="" /></div>' +
              '<div class="card-face card-front"><img src="' + cardSrc(card.num) + '" alt="" /></div>' +
            '</div>' +
          '</div>';
        }).join('') +
      '</div>' +
      '<p class="turn-banner" style="background-image:url(\'' + IMG_DIR + 'img-' + (state.turn + 1) + 'playerturn455x125px.png\')">It&rsquo;s ' + esc(state.names[state.turn]) + '&rsquo;s turn!</p>' +
    '</div>';
    app.innerHTML = html;
    fitBoard();

    app.querySelectorAll('.card').forEach(function (el) {
      el.addEventListener('click', function () { onCardClick(Number(el.getAttribute('data-idx')), el); });
      el.addEventListener('keydown', function (e) {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onCardClick(Number(el.getAttribute('data-idx')), el);
        }
      });
    });
  }

  /* Size the cards to the space actually left on screen. Tries every
     column count from 2 to 5 and keeps the one that gives the biggest
     cards: a tall phone, a phone turned sideways, a tablet and a desktop
     window all land on different shapes, which a fixed 2 × 5 or 5 × 2
     can't do. Card art is 945:1181 everywhere (same images on mobile
     as desktop). */
  var CARD_RATIO = 1181 / 945;
  var FIT_SAFETY = 0.97;   // a little breathing room so nothing touches the edges

  function fitBoard() {
    var screen = app.querySelector('.screen--board');
    if (!screen) return;
    var grid = screen.querySelector('.board-grid');
    // desktop keeps its designed 5 × 2 layout from game.css
    if (window.matchMedia('(min-width: 861px)').matches) {
      grid.style.removeProperty('--cols');
      grid.style.removeProperty('--card-w');
      return;
    }
    var cardRatio = CARD_RATIO;
    var bar = screen.querySelector('.score-bar');
    var banner = screen.querySelector('.turn-banner');
    var gap = parseFloat(getComputedStyle(grid).columnGap) || 12;
    var screenStyle = getComputedStyle(screen);
    var availW, availH;

    if (screenStyle.flexDirection === 'row') {
      // names in a column on the left, cards on the right
      availW = screen.clientWidth - bar.offsetWidth - (parseFloat(screenStyle.columnGap) || 0);
      availH = screen.clientHeight;
    } else {
      // names on top, turn banner underneath
      var bannerH = banner && banner.offsetParent ? banner.offsetHeight : 0;
      availW = screen.clientWidth;
      availH = screen.clientHeight - bar.offsetHeight - bannerH - 2 * gap;
    }

    var total = state.deck.length;
    var best = { cols: 2, w: 0 };
    for (var cols = 2; cols <= 5; cols++) {
      var rows = Math.ceil(total / cols);
      var w = Math.min(
        (availW - (cols - 1) * gap) / cols,
        (availH - (rows - 1) * gap) / rows / cardRatio
      );
      if (w > best.w) best = { cols: cols, w: w };
    }

    var cardW = Math.max(40, Math.floor(best.w * FIT_SAFETY));
    grid.style.setProperty('--cols', best.cols);
    grid.style.setProperty('--card-w', cardW + 'px');
  }

  // re-fit on rotation, window resize, and once the web fonts have loaded
  // (the name boxes can change height when the font swaps in)
  var fitQueued = false;
  function queueFit() {
    if (fitQueued) return;
    fitQueued = true;
    requestAnimationFrame(function () { fitQueued = false; fitBoard(); });
  }
  window.addEventListener('resize', queueFit);
  window.addEventListener('orientationchange', queueFit);
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(queueFit);

  function onCardClick(idx, el) {
    // a mismatch is showing — dismissing it is handled by the app-level
    // "click anywhere" listener below, not by this card-specific handler
    if (state.pendingMiss) return;

    // a match is showing — dismissing it is handled by the app-level
    // "click anywhere" listener below, not by this card-specific handler
    if (state.pendingMatch) return;

    if (state.lock) return;
    if (el.classList.contains('is-flipped') || el.classList.contains('is-matched')) return;

    el.classList.add('is-flipped');
    state.flipped.push({ idx: idx, el: el, card: state.deck[idx] });

    if (state.flipped.length < 2) return;

    var a = state.flipped[0], b = state.flipped[1];
    state.flipped = [];

    if (a.card.pairId === b.card.pairId) {
      // leave the match face up until the player dismisses it. Same
      // "ignore the click that just revealed this" guard as the mismatch
      // branch below, for the same reason — this click is still bubbling
      // up to the app-level listener.
      state.pendingMatch = [a, b];
      state.skipMatchDismiss = true;
    } else {
      // leave the mismatch face up until the player dismisses it. The click
      // that set this (the second card, just above) is still bubbling up to
      // the app-level "click anywhere" listener below — skipMissDismiss
      // tells it to ignore this one bubble, so the mismatch doesn't flip
      // back down again in the same click that revealed it.
      state.pendingMiss = [a, b];
      state.skipMissDismiss = true;
    }
  }

  // animates a card flying into the given score box (translate + shrink to
  // its centre, fading out) by setting the exact pixel delta as custom
  // properties and letting .card.is-collecting's CSS transition do the rest
  function flyIntoScoreBox(cardEl, scoreBoxEl) {
    var cardRect = cardEl.getBoundingClientRect();
    var boxRect = scoreBoxEl.getBoundingClientRect();
    var dx = (boxRect.left + boxRect.width / 2) - (cardRect.left + cardRect.width / 2);
    var dy = (boxRect.top + boxRect.height / 2) - (cardRect.top + cardRect.height / 2);
    cardEl.style.setProperty('--collect-x', dx + 'px');
    cardEl.style.setProperty('--collect-y', dy + 'px');
    cardEl.style.setProperty('--collect-scale', Math.min(boxRect.width / cardRect.width, 0.2));
    cardEl.classList.add('is-collecting');
  }

  function dismissMatch() {
    var pair = state.pendingMatch;
    state.pendingMatch = null;
    state.lock = true;   // block clicks during the collect animation — same reasoning as dismissMiss's lock below

    // the score box belongs to whoever's turn it still is — a match doesn't
    // pass the turn, so this is always the player who just made it
    var scoreBox = app.querySelector('.score-box.is-turn');
    flyIntoScoreBox(pair[0].el, scoreBox);
    flyIntoScoreBox(pair[1].el, scoreBox);

    // rebuild the board once the collect animation has played (rebuilding
    // straight away would swap the DOM and skip the animation)
    setTimeout(function () {
      state.matchedPairIds[pair[0].card.pairId] = true;
      state.scores[state.turn]++;
      state.won[state.turn].push(state.pairs[pair[0].card.pairId]);
      state.matchedCount++;
      state.lock = false;
      if (state.matchedCount === state.pairs.length) {
        renderResults();
      } else {
        renderBoard(); // same player goes again
      }
    }, MATCH_COLLECT);
  }

  function dismissMiss() {
    var pair = state.pendingMiss;
    state.pendingMiss = null;
    state.lock = true;   // block clicks during the flip-back animation — a click here would
                          // flip a card against its old DOM element, which renderBoard()
                          // below then detaches, leaving a stale entry in state.flipped
                          // that could later be paired with a real click and wrongly matched
    pair[0].el.classList.remove('is-flipped');
    pair[1].el.classList.remove('is-flipped');

    // rebuild the board once the flip-back animation has played
    // (rebuilding straight away would swap the DOM and skip the animation)
    setTimeout(function () {
      state.turn = (state.turn + 1) % state.count;
      state.lock = false;
      renderBoard();
    }, FLIP_BACK);
  }

  // a resolved pair (match or mismatch) stays face up until dismissed —
  // clicking anywhere on the board (not just the two cards themselves)
  // dismisses it, since requiring the exact card felt unnecessarily
  // precise. Bound to #app itself (never replaced by renderBoard's
  // innerHTML swap, unlike its children), so this only needs setting up once.
  app.addEventListener('click', function () {
    if (state.pendingMiss) {
      if (state.skipMissDismiss) { state.skipMissDismiss = false; return; }   // this is the same click that revealed the mismatch, bubbling up — not a real dismiss click
      dismissMiss();
      return;
    }
    if (state.pendingMatch) {
      if (state.skipMatchDismiss) { state.skipMatchDismiss = false; return; }
      dismissMatch();
    }
  });

  /* ============================================================
     SCREEN 4 — results
     ============================================================ */

  // the brand's own multicolour palette (sampled from the matching game's
  // player-button/field assets, see 03 Matching Card Game/Assets)
  var CONFETTI_COLORS = ['#F7CAC9', '#B2CB89', '#FAC74F', '#BBDFE4', '#F8A692', '#D8CCE4'];
  var CONFETTI_COUNT = 60;
  var CONFETTI_DURATION = 5000;   // the rain stops after this long

  function confettiHtml() {
    var pieces = [];
    for (var i = 0; i < CONFETTI_COUNT; i++) {
      var color = CONFETTI_COLORS[i % CONFETTI_COLORS.length];
      var left = (Math.random() * 100).toFixed(2);
      var w = (4 + Math.random() * 7).toFixed(1);    // rectangles of varying width...
      var h = (9 + Math.random() * 11).toFixed(1);   // ...and height, independently
      var duration = (3.2 + Math.random() * 2.4).toFixed(2);
      var delay = (-Math.random() * 6).toFixed(2);   // negative: already mid-fall when the screen appears
      var drift = (Math.random() * 60 - 30).toFixed(0) + 'px';   // sideways sway
      var spin = (360 + Math.random() * 360).toFixed(0) + 'deg';
      var style = 'left:' + left + '%;' +
        'width:' + w + 'px;height:' + h + 'px;' +
        'background:' + color + ';' +
        'animation-duration:' + duration + 's;animation-delay:' + delay + 's;' +
        '--drift:' + drift + ';--spin:' + spin + ';';
      pieces.push('<span class="confetti-piece" style="' + style + '"></span>');
    }
    return '<div class="confetti" aria-hidden="true">' + pieces.join('') + '</div>';
  }

  // the rain stops after CONFETTI_DURATION — pausing in place (not vanishing
  // mid-fall) reads as "the rain has stopped", not a glitch
  function stopConfettiAfter(container) {
    setTimeout(function () {
      if (container.isConnected) container.classList.add('is-stopped');
    }, CONFETTI_DURATION);
  }

  function renderResults() {
    setInGame(true);   // no footer on the results screen, as in Matching Game 4.0
    addHeaderReplayBtn();   // desktop only — see its own definition above
    var html = confettiHtml() +
      '<div class="screen screen--results">' +
      '<div class="results-head">' +
        '<h1 class="results-title">Good game!</h1>' +
        '<button type="button" class="replay-btn press" aria-label="Play again">' +
          '<img src="../00%20Shared%20Assets/btn-playagain%20505x105px.png" alt="" />' +
        '</button>' +
      '</div>' +
      scoreBarHtml() +
      '<div class="results-grid" style="--players:' + state.count + '">' +
        state.won.map(function (pairs, i) {
          // each column carries its own name box too — only shown on a
          // phone, where the columns stack into one list (see game.css)
          return '<div class="results-col">' +
            '<div class="score-box results-name" style="background-image:url(\'' + IMG_DIR + 'img-' + (i + 1) + 'playername202x82px.png\')">' +
              '<span class="name">' + esc(state.names[i]) + '</span><span class="count">' + state.scores[i] + '</span>' +
            '</div>' +
            pairs.map(function (pair) {
              return '<div class="results-pair" data-a="' + pair[0] + '" data-b="' + pair[1] + '">' +
                '<img src="' + cardSrc(pair[0]) + '" alt="" />' +
                '<img src="' + cardSrc(pair[1]) + '" alt="" />' +
              '</div>';
            }).join('') +
          '</div>';
        }).join('') +
      '</div>' +
    '</div>';
    app.innerHTML = html;

    stopConfettiAfter(app.querySelector('.confetti'));
    app.querySelector('.replay-btn').addEventListener('click', renderCount);
  }

  renderCount();
})();
