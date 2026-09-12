<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Poker Hand Assistant</title>
  <link rel="preconnect" href="https://fonts.googleapis.com" />
  <link href="https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;600;700&family=Outfit:wght@300;400;500;600&display=swap" rel="stylesheet" />
  <link rel="stylesheet" href="style.css" />
</head>
<body>

  <!-- Header -->
  <header class="header">
    <span class="header-title">Poker Hand Assistant</span>
    <button id="clear-btn" class="clear-btn hidden">Clear All</button>
  </header>

  <!-- Hand rankings bar -->
  <div class="rankings-bar">
    <div class="rankings-inner" id="rankings-bar">
      <!-- Populated by JS -->
    </div>
  </div>

  <!-- Main felt area -->
  <main class="felt">

    <!-- Best hand callout -->
    <div class="best-hand-callout" id="best-hand-callout">
      Add cards to detect your hand
    </div>

    <!-- Community cards -->
    <section class="card-section">
      <div class="section-label">Community Cards</div>
      <div class="card-row" id="community-row">
        <!-- 5 slots populated by JS -->
      </div>
      <div class="section-sublabel">Flop &middot; Turn &middot; River</div>
    </section>

    <!-- Divider -->
    <div class="divider">
      <div class="divider-line"></div>
      <span class="divider-label">YOUR HAND</span>
      <div class="divider-line"></div>
    </div>

    <!-- Hole cards -->
    <section class="card-section">
      <div class="card-row" id="hole-row">
        <!-- 2 slots populated by JS -->
      </div>
      <div class="section-label" style="margin-top: 10px;">Hole Cards</div>
    </section>

    <p class="remove-hint hidden" id="remove-hint">Click a card to remove it</p>
  </main>

  <!-- Card picker modal -->
  <div class="modal-backdrop hidden" id="modal-backdrop">
    <div class="modal" id="modal">
      <div class="modal-header">
        <span class="modal-title">Pick a Card</span>
        <button class="modal-close" id="modal-close">&times;</button>
      </div>
      <div class="modal-body" id="modal-body">
        <!-- Populated by JS -->
      </div>
    </div>
  </div>

  <script src="script.js"></script>
</body>
</html>
