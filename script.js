const RANKS = ['A','K','Q','J','10','9','8','7','6','5','4','3','2'];
const SUITS = ['♠','♥','♦','♣'];

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

// Each entry is { rank, suit } or null
let holeCards = [null, null];
let communityCards = [null, null, null, null, null];

// { type: 'hole'|'community', index: number } while picker is open
let pickerTarget = null;

// ── Poker Logic ───────────────────────────────────────────────────────────────

function rankValue(rank) {
  return ['2','3','4','5','6','7','8','9','10','J','Q','K','A'].indexOf(rank);
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

  const uniqueSuits = new Set(suits);
  const flush = uniqueSuits.size === 1;

  const sorted = [...ranks].sort((a, b) => a - b);
  const seq = sorted.every((r, i) => i === 0 || r === sorted[i - 1] + 1);
  const wheel = sorted.join(',') === '0,1,2,3,12';
  const straight = seq || wheel;
  const hi = Math.max(...ranks);

  if (flush && seq && hi === 12) return 0; // Royal Flush
  if (flush && straight)         return 1; // Straight Flush
  if (counts[0] === 4)           return 2; // Four of a Kind
  if (counts[0] === 3 && counts[1] === 2) return 3; // Full House
  if (flush)                     return 4; // Flush
  if (straight)                  return 5; // Straight
  if (counts[0] === 3)           return 6; // Three of a Kind
  if (counts[0] === 2 && counts[1] === 2) return 7; // Two Pair
  if (counts[0] === 2)           return 8; // Pair
  return 9;                                // High Card
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
  el.style.boxShadow = 'none'; // Overriding default CSS shadow if images already have drop shadow, or leave it. We'll leave it for now, CSS handles it.
  
  el.innerHTML = `
    <div class="card-remove-overlay">✕</div>
  `;
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

  // Hand rankings bar
  const bar = document.getElementById('rankings-bar');
  bar.innerHTML = '';
  HAND_RANKINGS.forEach(({ name, rank }) => {
    const pill = document.createElement('div');
    pill.className = 'hand-pill';
    if (rank === bestRank) pill.classList.add('best');
    else if (bestRank >= 0 && rank > bestRank) pill.classList.add('worse');
    pill.textContent = name;
    bar.appendChild(pill);
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
