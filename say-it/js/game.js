/* ============================================================
   AhGong & AhMa Says — Say It
   Two players: one reads a Hokkien phrase card aloud (the reader),
   the other listens and judges the pronunciation (the judge). A
   round is 5 cards, drawn at random with no repeats; the judge's
   tick scores a point for the reader. After 5 cards, play again,
   switch roles, or end the game.
   ============================================================ */

(function () {
  var ASSETS = '../04%20Say%20It%20Game/Assets/';
  var SHARED = '../00%20Shared%20Assets/';

  // every phrase card — the illustration, Hokkien text and pronunciation
  // are already baked into each image
  var PHRASES = [
    ASSETS + 'Hua%20Hee.png',
    ASSETS + 'Jiak%20Ba%20Buay.png',
    ASSETS + 'Jiak%20Ba%20Liao.png',
    ASSETS + 'Li%20Ho%20Bo.png',
    ASSETS + 'Lim%20Zui.png',
    ASSETS + 'Man%20Man%20Lai.png',
    ASSETS + 'Swee.png',
    ASSETS + 'Wo%20Ai%20Li.png'
  ];
  var CARDS_PER_ROUND = 5;

  function preloadDeck(deck) {
    for (var i = 0; i < deck.length; i++) (new Image()).src = deck[i];
  }

  // judging a card swaps .phrase-card's src straight to the next one
  // (updateCardUI, below) — without warming the cache first, each new
  // card the player hasn't seen yet has to be freshly downloaded and
  // decoded right at that moment, which is what read as the image
  // lagging after a right/wrong tap. The deck for the first round is
  // picked now (not left until startRound) so only those 5 of the 8
  // phrase cards get fetched, instead of all 8 — the player still has
  // the whole name-entry/how-to-play/ready flow as lead time for them
  // to finish downloading in the background.
  var nextDeck = shuffle(PHRASES.slice()).slice(0, CARDS_PER_ROUND);
  preloadDeck(nextDeck);

  var PLAYER_BG = [
    ASSETS + 'img-sayit-1playername%20200x60px.png',
    ASSETS + 'img-sayit-2playername%20200x60px.png.png'
  ];

  var app = document.getElementById('app');

  // the header and footer are both hidden while a round is showing (see body.in-game in game.css)
  function setInGame(on) {
    document.body.classList.toggle('in-game', on);
  }

  var state = {
    names: ['', ''],       // names[0] = always the reader's name right now, names[1] = the judge's
    scores: [0, 0],        // scores[0]/[1] track player-slot 0/1 regardless of current role
    readerSlot: 0,         // which name/score slot is currently reading
    deck: [],
    cardStep: 0
  };

  function esc(s) {
    return String(s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  function shuffle(arr) {
    for (var i = arr.length - 1; i > 0; i--) {
      var j = Math.floor(Math.random() * (i + 1));
      var t = arr[i]; arr[i] = arr[j]; arr[j] = t;
    }
    return arr;
  }

  /* ============================================================
     SCREEN 1 — name entry, one card per player
     ============================================================ */

  function renderName(step) {
    setInGame(false);
    var last = step === 1;
    var html = '<div class="screen">' +
      '<div class="popup">' +
        '<h2 class="h2">Who is playing today?</h2>' +
        '<div class="name-field" style="background-image:url(\'' + PLAYER_BG[step] + '\')">' +
          '<input type="text" maxlength="24" autocomplete="off" placeholder="Enter your name here" />' +
        '</div>' +
        '<button type="button" class="next-btn press" aria-label="' + (last ? 'Start' : 'Next') + '">' +
          '<img src="' + SHARED + 'btn-next%2080x78px.png" alt="" />' +
        '</button>' +
      '</div>' +
    '</div>';
    app.innerHTML = html;

    var input = app.querySelector('.name-field input');
    input.focus();

    function advance() {
      state.names[step] = input.value.trim() || ('Player ' + (step + 1));
      if (!last) {
        renderName(1);
      } else {
        renderHowToPlay(0);
      }
    }

    input.addEventListener('keydown', function (e) { if (e.key === 'Enter') advance(); });
    app.querySelector('.next-btn').addEventListener('click', advance);
  }

  /* ============================================================
     SCREEN 2 — how to play, three cards
     ============================================================ */

  var HOW_TO_PLAY_STEPS = 3;

  // uses the names just entered on the previous screen, not the literal
  // "Player 1"/"Player 2" from the reference
  function howToPlayText(step) {
    var judgeSlot = state.readerSlot === 0 ? 1 : 0;
    var reader = esc(state.names[state.readerSlot]);
    var judge = esc(state.names[judgeSlot]);
    if (step === 0) return reader + ', you will read out the Hokkien card shown on your side of the screen.';
    if (step === 1) return judge + ', you will listen and judge if the pronounciation was correct. Then, click on the tick or cross!';
    return 'After 5 cards, you can choose to play again or switch roles.';
  }

  function renderHowToPlay(step) {
    setInGame(false);
    var html = '<div class="screen">' +
      '<div class="popup">' +
        '<h2 class="h2">How to play</h2>' +
        '<p class="htp-text">' + howToPlayText(step) + '</p>' +
        '<button type="button" class="next-btn press" aria-label="Next">' +
          '<img src="' + SHARED + 'btn-next%2080x78px.png" alt="" />' +
        '</button>' +
      '</div>' +
    '</div>';
    app.innerHTML = html;

    app.querySelector('.next-btn').addEventListener('click', function () {
      if (step < HOW_TO_PLAY_STEPS - 1) renderHowToPlay(step + 1);
      else renderReady();
    });
  }

  /* ============================================================
     SCREEN 3 — are you ready?
     ============================================================ */

  function renderReady() {
    setInGame(false);
    var html = '<div class="screen">' +
      '<div class="popup">' +
        '<h2 class="h2">Are you ready?</h2>' +
        '<button type="button" class="letsgo-btn press" aria-label="Let’s go">' +
          '<img src="' + SHARED + 'btn-letsgo%20200x203px.png" alt="" />' +
        '</button>' +
      '</div>' +
    '</div>';
    app.innerHTML = html;

    app.querySelector('.letsgo-btn').addEventListener('click', startRound);
  }

  /* ============================================================
     SCREEN 4 — the round: 5 cards, reader reads, judge marks
     ============================================================ */

  function startRound() {
    // the first round's deck was already picked (and preloaded) at script
    // load, above; a replay/switch-sides round needs a fresh one, pulled
    // in as early as possible (same reasoning as above) rather than only
    // 5 of the 8 cards ever being fetched for the rest of the session
    state.deck = nextDeck;
    nextDeck = shuffle(PHRASES.slice()).slice(0, CARDS_PER_ROUND);
    preloadDeck(nextDeck);
    state.cardStep = 0;
    state.scores = [0, 0];   // fresh game every round — play again or switch sides, scores always restart at 0
    renderRoundScreen();
  }

  // each physical side is anchored to a player slot — slot 0 always on the
  // left, slot 1 always on the right — and shows that slot's card (reader)
  // or judge buttons depending on who's currently reading. So "switch
  // sides" swaps which CONTENT appears in each column, not which person
  // appears in each column.
  function roundSideHtml(slot) {
    var isReader = state.readerSlot === slot;
    var cls = isReader ? 'round-side--reader' : 'round-side--judge';
    var scoreSpan = isReader ? '<span class="count">' + state.scores[slot] + '</span>' : '';
    var content = isReader ?
      '<img class="phrase-card" src="' + state.deck[state.cardStep] + '" alt="" />' :
      '<div class="judge-buttons">' +
        '<button type="button" class="judge-btn judge-btn--correct press" aria-label="Correct">' +
          '<img src="' + ASSETS + 'btn-sayit-correct%20150x155px.png" alt="" />' +
        '</button>' +
        '<button type="button" class="judge-btn judge-btn--wrong press" aria-label="Wrong">' +
          '<img src="' + ASSETS + 'btn-sayit-wrong%20150x155px.png" alt="" />' +
        '</button>' +
      '</div>';

    return '<div class="round-side ' + cls + '">' +
      '<div class="player-box" style="background-image:url(\'' + PLAYER_BG[slot] + '\')">' +
        '<span class="name">' + esc(state.names[slot]) + '</span>' + scoreSpan +
      '</div>' +
      '<div class="round-content">' + content + '</div>' +
    '</div>';
  }

  // builds the round screen once per round (names, boxes, divider, judge
  // buttons never change mid-round) — advancing to the next card only
  // updates the card image and the score, via updateCardUI() below,
  // instead of tearing down and rebuilding the whole screen each time
  function renderRoundScreen() {
    setInGame(true);
    var html = '<div class="screen screen--round">' +
      '<div class="round">' +
        roundSideHtml(0) +
        '<img class="round-divider" src="' + ASSETS + 'img-sayit-dividerV%2040x700px.png" alt="" />' +
        roundSideHtml(1) +
      '</div>' +
    '</div>';
    app.innerHTML = html;

    app.querySelector('.judge-btn--correct').addEventListener('click', function () { judge(true); });
    app.querySelector('.judge-btn--wrong').addEventListener('click', function () { judge(false); });
  }

  // only the two things that change between cards: the card image and the
  // reader's score — everything else in the round screen stays untouched
  function updateCardUI() {
    app.querySelector('.phrase-card').src = state.deck[state.cardStep];
    app.querySelector('.round-side--reader .count').textContent = state.scores[state.readerSlot];
  }

  function judge(correct) {
    if (correct) state.scores[state.readerSlot]++;
    state.cardStep++;
    if (state.cardStep >= state.deck.length) {
      renderRoundEnd();
    } else {
      updateCardUI();
    }
  }

  /* ============================================================
     SCREEN 5 — round end: play again, switch sides, or end game
     ============================================================ */

  // the brand's own multicolour palette (sampled from the matching game's
  // player-button/field assets, see 03 Matching Card Game/Assets) — same
  // confetti as Dialect Match's results screen (play/js/game.js)
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

  function renderRoundEnd() {
    setInGame(true);   // no header or footer on the round-end screen either, as in Dialect Match
    var html = '<div class="screen screen--end">' +
      confettiHtml() +   // nested inside .screen--end, not a sibling — see the CSS comment on .confetti
      '<h2 class="h2">That was fun!</h2>' +
      '<div class="end-buttons">' +
        '<button type="button" class="wide-btn press" data-action="again" aria-label="Play again">' +
          '<img src="' + SHARED + 'btn-playagain%20505x105px.png" alt="" />' +
        '</button>' +
        '<button type="button" class="wide-btn press" data-action="switch" aria-label="Switch sides">' +
          '<img src="' + ASSETS + 'btn-switchsides%20505x105px.png" alt="" />' +
        '</button>' +
        '<button type="button" class="wide-btn press" data-action="end" aria-label="End game">' +
          '<img src="' + SHARED + 'btn-endgame%20505x105px.png" alt="" />' +
        '</button>' +
      '</div>' +
    '</div>';
    app.innerHTML = html;

    stopConfettiAfter(app.querySelector('.confetti'));
    app.querySelector('[data-action="again"]').addEventListener('click', startRound);
    app.querySelector('[data-action="switch"]').addEventListener('click', function () {
      state.readerSlot = state.readerSlot === 0 ? 1 : 0;
      startRound();
    });
    app.querySelector('[data-action="end"]').addEventListener('click', function () {
      window.location.href = '../games.html';
    });
  }

  renderName(0);
})();
