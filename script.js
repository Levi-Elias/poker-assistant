const RANKS = ['A','K','Q','J','10','9','8','7','6','5','4','3','2'];
const SUITS = ['♠','♥','♦','♣'];
const RANK_ORDER = ['2','3','4','5','6','7','8','9','10','J','Q','K','A'];

const HAND_RANKINGS = [
  { name: 'Royal Flush',     rank: 0 },
  { name: 'Straight Flush',  rank: 1 },
  { name: 'Four of a Kind',  rank: 2 },
  { name: 'Full House',      rank: 3 },
  { name: 'Flush',           rank: 4 },
  { name: 'Straight',        rank: 5 },
  { name: 'Three of a Kind', rank: 6 },
  { name: 'Two Pair',        rank: 7 },
  { name: 'Pair',            rank: 8 },
  { name: 'High Card',       rank: 9 },
];

// ── State ─────────────────────────────────────────────────────────────────────

let holeCards = [null, null];
let communityCards = [null, null, null, null, null];
let pickerTarget = null;

// ── Poker Logic ───────────────────────────────────────────────────────────────

function rankValue(rank) {
  return RANK_ORDER.indexOf(rank);
}

function isRed(suit) {
  return suit === '♥' || suit === '♦';
}

function getCombinations(arr, k) {
  if (k === 0) return [[]];
  if (k > arr.length) return [];
  const [first, ...rest] = arr;
  return [
    ...getCombinations(rest, k - 1).map(c => [first, ...c]),
    ...getCombinations(rest, k),
  ];
}

function evaluateFive(cards) {
  const ranks = cards.map(c => rankValue(c.rank));
  const suits = cards.map(c => c.suit);
  const rc = {};
  ranks.forEach(r => { rc[r] = (rc[r] || 0) + 1; });
  const counts = Object.values(rc).sort((a, b) => b - a);
  const flush = new Set(suits).size === 1;
  const sorted = [...ranks].sort((a, b) => a - b);
  const seq = sorted.every((r, i) => i === 0 || r === sorted[i - 1] + 1);
  const wheel = sorted.join(',') === '0,1,2,3,12';
  const straight = seq || wheel;
  const hi = Math.max(...ranks);
  if (flush && seq && hi === 12) return 0;
  if (flush && straight)         return 1;
  if (counts[0] === 4)           return 2;
  if (counts[0] === 3 && counts[1] === 2) return 3;
  if (flush)                     return 4;
  if (straight)                  return 5;
  if (counts[0] === 3)           return 6;
  if (counts[0] === 2 && counts[1] === 2) return 7;
  if (counts[0] === 2)           return 8;
  return 9;
}

function getBestRank(cards) {
  if (!cards.length) return -1;
  if (cards.length < 5) {
    const ranks = cards.map(c => rankValue(c.rank));
    const rc = {};
    ranks.forEach(r => { rc[r] = (rc[r] || 0) + 1; });
    const counts = Object.values(rc).sort((a, b) => b - a);
    if (counts[0] === 4) return 2;
    if (counts[0] === 3 && (counts[1] || 0) >= 2) return 3;
    if (counts[0] === 3) return 6;
    if (counts[0] === 2 && (counts[1] || 0) === 2) return 7;
    if (counts[0] === 2) return 8;
    return 9;
  }
  const combos = getCombinations(cards, 5);
  return Math.min(...combos.map(evaluateFive));
}

// ── Hand Example Builder ──────────────────────────────────────────────────────
// Returns array of 5 { rank, suit, owned } objects for display.
// owned=true  → card is in the player's current hand
// owned=false → card is a greyed-out placeholder needed for this hand
// Returns null if hand is impossible given current cards.

function cardKey(c) { return c.rank + c.suit; }

function buildExampleHand(handRank, currentCards) {
  const owned = new Set(currentCards.map(cardKey));

  // Helper: mark each card as owned or not
  function mark(cards) {
    return cards.map(c => ({ ...c, owned: owned.has(cardKey(c)) }));
  }

  // Helper: pick a suit not conflicting with takenSuits if possible
  function pickSuit(preferredSuits, takenSuits) {
    for (const s of preferredSuits) {
      if (!takenSuits.has(s)) return s;
    }
    return preferredSuits[0];
  }

  // Helper: get current rank counts
  function rankCounts() {
    const rc = {};
    currentCards.forEach(c => { rc[c.rank] = (rc[c.rank] || 0) + 1; });
    return rc;
  }

  // Helper: get current suit counts
  function suitCounts() {
    const sc = {};
    currentCards.forEach(c => { sc[c.suit] = (sc[c.suit] || 0) + 1; });
    return sc;
  }

  switch (handRank) {

    // ── 0: Royal Flush ──────────────────────────────────────────────────────
    case 0: {
      const royalRanks = ['10','J','Q','K','A'];
      // Find a suit where the player owns at least one royal card
      const suitScores = {};
      SUITS.forEach(s => {
        suitScores[s] = royalRanks.filter(r => owned.has(r + s)).length;
      });
      const bestSuit = SUITS.reduce((a, b) => suitScores[a] >= suitScores[b] ? a : b);
      const hand = royalRanks.map(r => ({ rank: r, suit: bestSuit }));
      return mark(hand);
    }

    // ── 1: Straight Flush ───────────────────────────────────────────────────
    case 1: {
      // Find best consecutive run of 5 that overlaps most with current cards in same suit
      let bestHand = null, bestScore = -1;
      for (let start = 0; start <= 8; start++) { // 0=2 to 8=10 (5-high to ace-high, excluding royal)
        const runRanks = RANK_ORDER.slice(start, start + 5);
        SUITS.forEach(suit => {
          const score = runRanks.filter(r => owned.has(r + suit)).length;
          if (score > bestScore) {
            bestScore = score;
            bestHand = runRanks.map(r => ({ rank: r, suit }));
          }
        });
      }
      if (!bestHand) return null;
      return mark(bestHand);
    }

    // ── 2: Four of a Kind ───────────────────────────────────────────────────
    case 2: {
      const rc = rankCounts();
      // Pick rank with most cards already
      let bestRank = null, bestCount = 0;
      RANK_ORDER.forEach(r => {
        if ((rc[r] || 0) > bestCount) { bestCount = rc[r] || 0; bestRank = r; }
      });
      if (!bestRank) bestRank = 'A';
      const hand = SUITS.map(s => ({ rank: bestRank, suit: s }));
      // Pick a kicker: first rank not bestRank we own, else fallback
      const kicker = currentCards.find(c => c.rank !== bestRank) || { rank: bestRank === 'K' ? 'Q' : 'K', suit: '♠' };
      hand.push({ rank: kicker.rank, suit: kicker.suit });
      return mark(hand.slice(0, 5));
    }

    // ── 3: Full House ────────────────────────────────────────────────────────
    case 3: {
      const rc = rankCounts();
      const sorted = Object.entries(rc).sort((a, b) => b[1] - a[1]);
      let tripleRank = sorted[0] ? sorted[0][0] : 'A';
      let pairRank = sorted[1] ? sorted[1][0] : (tripleRank === 'K' ? 'Q' : 'K');
      if (tripleRank === pairRank) pairRank = tripleRank === 'K' ? 'Q' : 'K';

      const usedSuits = new Set(currentCards.filter(c => c.rank === tripleRank).map(c => c.suit));
      const tripleSuits = [...usedSuits];
      while (tripleSuits.length < 3) {
        const next = SUITS.find(s => !tripleSuits.includes(s));
        if (next) tripleSuits.push(next); else break;
      }

      const pairUsed = new Set(currentCards.filter(c => c.rank === pairRank).map(c => c.suit));
      const pairSuits = [...pairUsed];
      while (pairSuits.length < 2) {
        const next = SUITS.find(s => !pairSuits.includes(s));
        if (next) pairSuits.push(next); else break;
      }

      const hand = [
        ...tripleSuits.slice(0, 3).map(s => ({ rank: tripleRank, suit: s })),
        ...pairSuits.slice(0, 2).map(s => ({ rank: pairRank, suit: s })),
      ];
      return mark(hand);
    }

    // ── 4: Flush ─────────────────────────────────────────────────────────────
    case 4: {
      const sc = suitCounts();
      const bestSuit = SUITS.reduce((a, b) => (sc[a] || 0) >= (sc[b] || 0) ? a : b);
      const ownedInSuit = currentCards.filter(c => c.suit === bestSuit);
      // Fill with highest-value cards of that suit not already owned
      const allInSuit = RANK_ORDER.slice().reverse().map(r => ({ rank: r, suit: bestSuit }));
      const hand = [];
      // First, add owned cards
      ownedInSuit.forEach(c => hand.push(c));
      // Then fill up to 5 with unowned cards
      for (const c of allInSuit) {
        if (hand.length >= 5) break;
        if (!owned.has(cardKey(c))) hand.push(c);
      }
      return mark(hand.slice(0, 5));
    }

    // ── 5: Straight ──────────────────────────────────────────────────────────
    case 5: {
      // Find 5-card consecutive run with most overlap with current cards (any suit)
      let bestHand = null, bestScore = -1;
      // Also check wheel (A-2-3-4-5)
      const runs = [];
      for (let start = 0; start <= 8; start++) {
        runs.push(RANK_ORDER.slice(start, start + 5));
      }
      // Wheel: A,2,3,4,5
      runs.push(['A','2','3','4','5']);

      runs.forEach(runRanks => {
        const score = runRanks.filter(r => currentCards.some(c => c.rank === r)).length;
        if (score > bestScore) {
          bestScore = score;
          // Assign suits: prefer owned card suits, else alternate
          const hand = runRanks.map(r => {
            const ownedCard = currentCards.find(c => c.rank === r);
            return ownedCard ? { ...ownedCard } : { rank: r, suit: '♠' };
          });
          bestHand = hand;
        }
      });
      return bestHand ? mark(bestHand) : null;
    }

    // ── 6: Three of a Kind ───────────────────────────────────────────────────
    case 6: {
      const rc = rankCounts();
      let tripleRank = Object.entries(rc).sort((a, b) => b[1] - a[1])[0]?.[0] || 'A';
      const usedSuits = new Set(currentCards.filter(c => c.rank === tripleRank).map(c => c.suit));
      const tripleSuits = [...usedSuits];
      while (tripleSuits.length < 3) {
        const next = SUITS.find(s => !tripleSuits.includes(s));
        if (next) tripleSuits.push(next); else break;
      }
      // Two kickers
      const kickers = currentCards.filter(c => c.rank !== tripleRank).slice(0, 2);
      while (kickers.length < 2) {
        const kr = RANK_ORDER.slice().reverse().find(r => r !== tripleRank && !kickers.some(k => k.rank === r));
        kickers.push({ rank: kr || 'K', suit: '♠' });
      }
      const hand = [
        ...tripleSuits.slice(0, 3).map(s => ({ rank: tripleRank, suit: s })),
        kickers[0], kickers[1],
      ];
      return mark(hand);
    }

    // ── 7: Two Pair ──────────────────────────────────────────────────────────
    case 7: {
      const rc = rankCounts();
      const sorted = Object.entries(rc).sort((a, b) => b[1] - a[1]);
      let pair1Rank = sorted[0]?.[0] || 'A';
      let pair2Rank = sorted[1]?.[0] || (pair1Rank === 'K' ? 'Q' : 'K');
      if (pair1Rank === pair2Rank) pair2Rank = pair1Rank === 'K' ? 'Q' : 'K';

      function pairCards(rank) {
        const ownedOfRank = currentCards.filter(c => c.rank === rank);
        const suits = ownedOfRank.map(c => c.suit);
        while (suits.length < 2) {
          const next = SUITS.find(s => !suits.includes(s));
          suits.push(next || '♠');
        }
        return suits.slice(0, 2).map(s => ({ rank, suit: s }));
      }

      const kicker = currentCards.find(c => c.rank !== pair1Rank && c.rank !== pair2Rank)
        || { rank: pair1Rank === 'A' ? 'K' : 'A', suit: '♠' };
      const hand = [...pairCards(pair1Rank), ...pairCards(pair2Rank), kicker];
      return mark(hand.slice(0, 5));
    }

    // ── 8: Pair ──────────────────────────────────────────────────────────────
    case 8: {
      const rc = rankCounts();
      let pairRank = Object.entries(rc).sort((a, b) => b[1] - a[1])[0]?.[0] || 'A';
      const ownedOfRank = currentCards.filter(c => c.rank === pairRank);
      const suits = ownedOfRank.map(c => c.suit);
      while (suits.length < 2) {
        const next = SUITS.find(s => !suits.includes(s));
        suits.push(next || '♠');
      }
      const pair = suits.slice(0, 2).map(s => ({ rank: pairRank, suit: s }));
      // 3 kickers
      const kickers = currentCards.filter(c => c.rank !== pairRank).slice(0, 3);
      const usedRanks = new Set([pairRank, ...kickers.map(c => c.rank)]);
      while (kickers.length < 3) {
        const kr = RANK_ORDER.slice().reverse().find(r => !usedRanks.has(r));
        usedRanks.add(kr);
        kickers.push({ rank: kr || '2', suit: '♠' });
      }
      const hand = [...pair, ...kickers.slice(0, 3)];
      return mark(hand.slice(0, 5));
    }

    // ── 9: High Card ─────────────────────────────────────────────────────────
    case 9: {
      // Show 5 highest cards from hand, fill with A,K,Q,J,10 if needed
      const best = [...currentCards].sort((a, b) => rankValue(b.rank) - rankValue(a.rank));
      const hand = [...best.slice(0, 5)];
      const fallbackRanks = ['A','K','Q','J','10'];
      const usedRanks = new Set(hand.map(c => c.rank));
      for (const r of fallbackRanks) {
        if (hand.length >= 5) break;
        if (!usedRanks.has(r)) {
          hand.push({ rank: r, suit: '♠' });
          usedRanks.add(r);
        }
      }
      return mark(hand.slice(0, 5));
    }

    default:
      return null;
  }
}

// ── DOM Helpers ───────────────────────────────────────────────────────────────

function allSelectedCards() {
  return [...holeCards, ...communityCards].filter(Boolean);
}

function getCardImageFilename(card) {
  const suitMap = {
    '♥': 'Hearts',
    '♦': 'Diamonds',
    '♣': 'Clubs',
    '♠': 'Spades'
  };
  const suitName = suitMap[card.suit];
  return `cards/card${suitName}${card.rank}.png`;
}

function makeCardEl(card, onClick) {
  const el = document.createElement('div');
  el.className = 'card';
  el.style.width = '64px';
  el.style.height = '90px';
  el.style.backgroundImage = `url('${getCardImageFilename(card)}')`;
  el.style.backgroundSize = 'contain';
  el.style.backgroundPosition = 'center';
  el.style.backgroundRepeat = 'no-repeat';
  el.style.backgroundColor = 'transparent';
  el.innerHTML = `<div class="card-remove-overlay">✕</div>`;
  el.addEventListener('click', onClick);
  return el;
}

function makeHoleCardEl(card, onClick) {
  const el = makeCardEl(card, onClick);
  el.style.width = '88px';
  el.style.height = '124px';
  return el;
}

function makeSlotEl(w, h, isActive, onClick) {
  const el = document.createElement('div');
  el.className = 'slot' + (isActive ? ' active' : '');
  el.style.width = w + 'px';
  el.style.height = h + 'px';
  el.textContent = '+';
  el.addEventListener('click', onClick);
  return el;
}

// Build a mini-card element for the hand display strip
function makeMiniCardEl(card) {
  const el = document.createElement('div');
  el.className = 'mini-card' + (card.owned ? ' owned' : ' missing');
  el.style.backgroundImage = `url('${getCardImageFilename(card)}')`;
  return el;
}

// ── Render ────────────────────────────────────────────────────────────────────

function render() {
  const allCards = allSelectedCards();
  const bestRank = getBestRank(allCards);

  // Clear-all button visibility
  const clearBtn = document.getElementById('clear-btn');
  allCards.length > 0 ? clearBtn.classList.remove('hidden') : clearBtn.classList.add('hidden');

  // Remove hint
  const hint = document.getElementById('remove-hint');
  allCards.length > 0 ? hint.classList.remove('hidden') : hint.classList.add('hidden');

  // ── Hand rankings bar (visual cards) ───────────────────────────────────────
  const bar = document.getElementById('rankings-bar');
  bar.innerHTML = '';

  HAND_RANKINGS.forEach(({ name, rank }) => {
    const isBest = rank === bestRank;
    const isWorse = bestRank >= 0 && rank > bestRank;

    const exampleCards = buildExampleHand(rank, allCards);

    // Determine if impossible: all cards unowned when player has cards
    const allMissing = exampleCards && allCards.length > 0 && exampleCards.every(c => !c.owned);
    const impossible = !exampleCards || allMissing;

    const display = document.createElement('div');
    display.className = 'hand-display';
    if (isBest) display.classList.add('best');
    if (isWorse) display.classList.add('worse');
    if (impossible) display.classList.add('impossible');

    // Label
    const label = document.createElement('div');
    label.className = 'hand-display-label';
    label.textContent = name;
    display.appendChild(label);

    // Mini cards row
    const cardsRow = document.createElement('div');
    cardsRow.className = 'hand-display-cards';

    if (impossible) {
      // Show 5 grey placeholder cards
      const defaultHand = buildDefaultHand(rank);
      defaultHand.forEach(() => {
        const placeholder = document.createElement('div');
        placeholder.className = 'mini-card missing impossible-card';
        cardsRow.appendChild(placeholder);
      });
    } else {
      exampleCards.forEach(c => {
        cardsRow.appendChild(makeMiniCardEl(c));
      });
    }

    display.appendChild(cardsRow);
    bar.appendChild(display);
  });

  // Best hand callout
  const callout = document.getElementById('best-hand-callout');
  if (bestRank >= 0) {
    callout.textContent = '★ ' + HAND_RANKINGS[bestRank].name;
    callout.classList.add('active');
  } else {
    callout.textContent = 'Add cards to detect your hand';
    callout.classList.remove('active');
  }

  // Community cards
  const communityRow = document.getElementById('community-row');
  communityRow.innerHTML = '';
  communityCards.forEach((card, i) => {
    if (card) {
      communityRow.appendChild(makeCardEl(card, () => {
        communityCards[i] = null;
        render();
      }));
    } else {
      const active = pickerTarget && pickerTarget.type === 'community' && pickerTarget.index === i;
      communityRow.appendChild(makeSlotEl(64, 90, active, () => {
        pickerTarget = { type: 'community', index: i };
        render();
        openPicker();
      }));
    }
  });

  // Hole cards
  const holeRow = document.getElementById('hole-row');
  holeRow.innerHTML = '';
  holeCards.forEach((card, i) => {
    if (card) {
      holeRow.appendChild(makeHoleCardEl(card, () => {
        holeCards[i] = null;
        render();
      }));
    } else {
      const active = pickerTarget && pickerTarget.type === 'hole' && pickerTarget.index === i;
      holeRow.appendChild(makeSlotEl(88, 124, active, () => {
        pickerTarget = { type: 'hole', index: i };
        render();
        openPicker();
      }));
    }
  });
}

// Returns 5 generic cards for use as "impossible" placeholders
function buildDefaultHand(handRank) {
  const defaults = {
    0: [{ rank:'A', suit:'♠' },{ rank:'K', suit:'♠' },{ rank:'Q', suit:'♠' },{ rank:'J', suit:'♠' },{ rank:'10', suit:'♠' }],
    1: [{ rank:'9', suit:'♠' },{ rank:'8', suit:'♠' },{ rank:'7', suit:'♠' },{ rank:'6', suit:'♠' },{ rank:'5', suit:'♠' }],
    2: [{ rank:'A', suit:'♠' },{ rank:'A', suit:'♥' },{ rank:'A', suit:'♦' },{ rank:'A', suit:'♣' },{ rank:'K', suit:'♠' }],
    3: [{ rank:'A', suit:'♠' },{ rank:'A', suit:'♥' },{ rank:'A', suit:'♦' },{ rank:'K', suit:'♠' },{ rank:'K', suit:'♥' }],
    4: [{ rank:'A', suit:'♠' },{ rank:'J', suit:'♠' },{ rank:'9', suit:'♠' },{ rank:'6', suit:'♠' },{ rank:'3', suit:'♠' }],
    5: [{ rank:'9', suit:'♠' },{ rank:'8', suit:'♥' },{ rank:'7', suit:'♦' },{ rank:'6', suit:'♣' },{ rank:'5', suit:'♠' }],
    6: [{ rank:'A', suit:'♠' },{ rank:'A', suit:'♥' },{ rank:'A', suit:'♦' },{ rank:'K', suit:'♠' },{ rank:'Q', suit:'♠' }],
    7: [{ rank:'A', suit:'♠' },{ rank:'A', suit:'♥' },{ rank:'K', suit:'♦' },{ rank:'K', suit:'♣' },{ rank:'Q', suit:'♠' }],
    8: [{ rank:'A', suit:'♠' },{ rank:'A', suit:'♥' },{ rank:'K', suit:'♠' },{ rank:'Q', suit:'♠' },{ rank:'J', suit:'♠' }],
    9: [{ rank:'A', suit:'♠' },{ rank:'K', suit:'♥' },{ rank:'Q', suit:'♦' },{ rank:'J', suit:'♣' },{ rank:'9', suit:'♠' }],
  };
  return defaults[handRank] || [];
}

// ── Picker Modal ──────────────────────────────────────────────────────────────

function openPicker() {
  const takenSet = new Set(allSelectedCards().map(c => c.rank + c.suit));
  const body = document.getElementById('modal-body');
  body.innerHTML = '';

  SUITS.forEach(suit => {
    const row = document.createElement('div');
    row.className = 'suit-row';

    const suitEl = document.createElement('span');
    suitEl.className = 'suit-symbol ' + (isRed(suit) ? 'red' : 'black');
    suitEl.textContent = suit;
    row.appendChild(suitEl);

    const grid = document.createElement('div');
    grid.className = 'rank-grid';

    RANKS.forEach(rank => {
      const key = rank + suit;
      const btn = document.createElement('button');
      btn.className = 'rank-btn ' + (takenSet.has(key) ? 'taken' : (isRed(suit) ? 'red' : 'black'));
      btn.textContent = rank;
      btn.disabled = takenSet.has(key);
      btn.addEventListener('click', () => {
        if (!pickerTarget) return;
        const card = { rank, suit };
        if (pickerTarget.type === 'hole') {
          holeCards[pickerTarget.index] = card;
        } else {
          communityCards[pickerTarget.index] = card;
        }
        pickerTarget = null;
        closePicker();
        render();
      });
      grid.appendChild(btn);
    });

    row.appendChild(grid);
    body.appendChild(row);
  });

  document.getElementById('modal-backdrop').classList.remove('hidden');
}

function closePicker() {
  document.getElementById('modal-backdrop').classList.add('hidden');
  pickerTarget = null;
  render();
}

// ── Event Listeners ───────────────────────────────────────────────────────────

document.getElementById('clear-btn').addEventListener('click', () => {
  holeCards = [null, null];
  communityCards = [null, null, null, null, null];
  pickerTarget = null;
  closePicker();
  render();
});

document.getElementById('modal-close').addEventListener('click', closePicker);

document.getElementById('modal-backdrop').addEventListener('click', function (e) {
  if (e.target === this) closePicker();
});

// ── Init ──────────────────────────────────────────────────────────────────────

render();
