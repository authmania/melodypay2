// MelodyPay dashboard — static demo app. All data lives in localStorage.
(function () {
  /* =========================================================
     Storage + helpers
     ========================================================= */
  const user = Auth.current();
  if (!user) return; // the guard in dashboard.html is already redirecting
  const STATE_KEY = 'melodypay:state:' + user.email; // each account has its own wallet

  const store = {
    get(key) { try { return JSON.parse(localStorage.getItem(key)); } catch { return null; } },
    set(key, val) { try { localStorage.setItem(key, JSON.stringify(val)); } catch { /* storage unavailable */ } },
    remove(key) { try { localStorage.removeItem(key); } catch { /* storage unavailable */ } }
  };

  const $ = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];
  const naira = (n) => (n < 0 ? '-' : '') + '₦' + Math.abs(Math.round(n)).toLocaleString('en-NG');
  const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const dayKey = (d = new Date()) => d.toISOString().slice(0, 10);
  const HOUR = 3600e3;

  function relTime(ts) {
    const s = Math.floor((Date.now() - ts) / 1000);
    if (s < 60) return 'just now';
    const m = Math.floor(s / 60);
    if (m < 60) return `${m} min${m > 1 ? 's' : ''} ago`;
    const h = Math.floor(m / 60);
    if (h < 24) return `${h} hour${h > 1 ? 's' : ''} ago`;
    const d = Math.floor(h / 24);
    return `${d} day${d > 1 ? 's' : ''} ago`;
  }

  /* =========================================================
     Catalogue
     ========================================================= */
  const LISTEN_SECONDS = 15;
  const SONG_REWARD = 2000;
  const TASK_REWARD = 2000;
  const REFERRAL_BONUS = 1000;

  const SONGS = [
    { id: 'calm',     title: 'Calm Vibes',    genre: 'Lo-fi Beats',  artist: 'DJ Lumi',       art: 'art-sunset',  glyph: 'headphones', reward: SONG_REWARD, root: 57, bpm: 78 },
    { id: 'energy',   title: 'Good Energy',   genre: 'Afro Beats',   artist: 'Kola Waves',    art: 'art-palms',   glyph: 'music',      reward: SONG_REWARD, root: 62, bpm: 104 },
    { id: 'better',   title: 'Better Days',   genre: 'Pop Mix',      artist: 'Ada Nova',      art: 'art-neon',    glyph: 'bolt',       reward: SONG_REWARD, root: 60, bpm: 112 },
    { id: 'freedom',  title: 'Freedom',       genre: 'Chill Vibes',  artist: 'Seyi Blue',     art: 'art-ocean',   glyph: 'heart',      reward: SONG_REWARD, root: 55, bpm: 84 },
    { id: 'lagos',    title: 'Lagos Nights',  genre: 'Amapiano',     artist: 'Log Drum Kid',  art: 'art-night',   glyph: 'star',       reward: SONG_REWARD, root: 58, bpm: 112 },
    { id: 'sweet',    title: 'Sweet Melody',  genre: 'R&B Soul',     artist: 'Temi Rose',     art: 'art-rose',    glyph: 'heart',      reward: SONG_REWARD, root: 63, bpm: 90 },
    { id: 'golden',   title: 'Golden Hour',   genre: 'Highlife',     artist: 'Oga Guitar',    art: 'art-gold',    glyph: 'music',      reward: SONG_REWARD, root: 64, bpm: 100 },
    { id: 'breeze',   title: 'Island Breeze', genre: 'Reggae Mix',   artist: 'Palm & Sand',   art: 'art-emerald', glyph: 'headphones', reward: SONG_REWARD, root: 59, bpm: 88 }
  ];

  const TASKS = [
    { id: 'tap',     title: 'Tap & Earn Task', desc: 'Tap the button 50 times',     reward: TASK_REWARD, icon: 'tap',      limit: 5, cta: 'Start' },
    { id: 'checkin', title: 'Daily Check-in',  desc: 'Login daily and get rewarded', reward: TASK_REWARD, icon: 'calendar', limit: 1, cta: 'Check In' },
    { id: 'video',   title: 'Watch & Earn',    desc: 'Watch a 10-second clip',       reward: TASK_REWARD, icon: 'video',    limit: 3, cta: 'Watch' },
    { id: 'share',   title: 'Share MelodyPay', desc: 'Copy and share your invite link', reward: TASK_REWARD, icon: 'share',  limit: 1, cta: 'Share' }
  ];

  const MILESTONES = [
    { id: 'songs10', title: 'Music Lover',  desc: 'Listen to 10 songs',       icon: 'headphones', reward: 5000,  goal: 10,    value: (s) => s.songsPlayed },
    { id: 'tasks25', title: 'Task Master',  desc: 'Complete 25 tasks',        icon: 'check',      reward: 10000, goal: 25,    value: (s) => s.tasks },
    { id: 'refs5',   title: 'Influencer',   desc: 'Invite 5 friends',         icon: 'users',      reward: 5000,  goal: 5,     value: (s) => s.referrals },
    { id: 'earn100k', title: 'High Earner',  desc: 'Reach ₦100,000 total earnings', icon: 'trophy', reward: 10000, goal: 100000, value: (s) => s.total }
  ];

  const ACT_META = {
    music:    { icon: 'music',    title: 'Music Reward' },
    tap:      { icon: 'tap',      title: 'Tap Task Reward' },
    checkin:  { icon: 'calendar', title: 'Daily Check-in' },
    video:    { icon: 'video',    title: 'Video Reward' },
    share:    { icon: 'share',    title: 'Share Reward' },
    referral: { icon: 'users',    title: 'Referral Bonus' },
    reward:   { icon: 'trophy',   title: 'Milestone Reward' },
    withdraw: { icon: 'wallet',   title: 'Withdrawal' }
  };

  /* =========================================================
     State
     ========================================================= */
  function freshToday(seed) {
    return { key: dayKey(), earn: 0, tasks: 0, done: {}, ...seed };
  }

  // A newly registered account starts with an empty wallet.
  function defaultState() {
    return {
      total: 0,
      balance: 0,
      tasks: 0,
      referrals: 0,
      referralEarnings: 0,
      songsPlayed: 0,
      claimed: {},
      muted: false,
      bank: null,
      today: freshToday(),
      friends: [],
      activity: []
    };
  }

  let state = { ...defaultState(), ...store.get(STATE_KEY) };
  if (!state.today || state.today.key !== dayKey()) state.today = freshToday();

  const firstName = () => (user.name || 'Friend').trim().split(/\s+/)[0];

  function save() { store.set(STATE_KEY, state); }

  function taskCount(id) { return state.today.done[id] || 0; }
  function taskLeft(t) { return t.limit - taskCount(t.id); }

  /** Credit the wallet and log activity. */
  function credit(amount, type, desc, { countsAsTask = false, taskId = null } = {}) {
    state.total += amount;
    state.balance += amount;
    state.today.earn += amount;
    if (countsAsTask) { state.tasks += 1; state.today.tasks += 1; }
    if (taskId) state.today.done[taskId] = taskCount(taskId) + 1;
    state.activity.unshift({ type, desc, amount, ts: Date.now() });
    save();
    toast(`+${naira(amount)} — ${desc.replace(/^You earned ₦[\d,]+ /, '')}`);
    refresh(['total', 'balance']);
  }

  /* =========================================================
     Toasts
     ========================================================= */
  function toast(msg, { coin = true } = {}) {
    const wrap = $('#toasts');
    const el = document.createElement('div');
    el.className = 'toast';
    el.innerHTML = `${coin ? '<span class="coin">₦</span>' : icon('check')}<span>${esc(msg)}</span>`;
    wrap.appendChild(el);
    setTimeout(() => { el.classList.add('out'); setTimeout(() => el.remove(), 300); }, 2800);
  }

  /* =========================================================
     Synth (WebAudio) — gives each song a little looping groove
     ========================================================= */
  const synth = {
    ctx: null, master: null, timer: null, step: 0,
    PROG: [[0, 4, 7, 11], [9, 12, 16, 19], [5, 9, 12, 16], [7, 11, 14, 17]],
    freq: (m) => 440 * Math.pow(2, (m - 69) / 12),

    note(midi, dur, type, vol) {
      const { ctx } = this;
      const t = ctx.currentTime;
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      o.type = type;
      o.frequency.value = this.freq(midi);
      g.gain.setValueAtTime(0.0001, t);
      g.gain.linearRampToValueAtTime(vol, t + 0.02);
      g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      o.connect(g).connect(this.master);
      o.start(t);
      o.stop(t + dur + 0.05);
    },

    start(song) {
      this.stop();
      try {
        this.ctx = this.ctx || new (window.AudioContext || window.webkitAudioContext)();
        this.ctx.resume();
        if (!this.master) { this.master = this.ctx.createGain(); this.master.connect(this.ctx.destination); }
        this.master.gain.value = state.muted ? 0 : 0.12;
      } catch { return; }
      const interval = 60000 / song.bpm / 2; // eighth notes
      this.timer = setInterval(() => {
        const s = this.step++;
        const chord = this.PROG[Math.floor(s / 8) % 4];
        const arp = chord[s % 4] + (s % 8 >= 4 ? 12 : 0);
        this.note(song.root + arp, 0.45, 'triangle', 0.35);
        if (s % 8 === 0) this.note(song.root - 12 + chord[0], 1.4, 'sine', 0.7);
        if (s % 4 === 2) this.note(song.root + 24 + chord[2], 0.15, 'square', 0.04);
      }, interval);
    },

    stop() { clearInterval(this.timer); this.timer = null; },
    setMuted(m) { if (this.master) this.master.gain.value = m ? 0 : 0.12; }
  };

  /* =========================================================
     Player
     ========================================================= */
  const player = { song: null, elapsed: 0, playing: false, timer: null };

  function playSong(id) {
    const song = SONGS.find((s) => s.id === id);
    if (!song) return;
    if (player.song && player.song.id === id) { togglePlayer(); return; }
    stopSong();
    Object.assign(player, { song, elapsed: 0, playing: true });
    synth.start(song);
    player.timer = setInterval(tickPlayer, 250);
    $('#playerCover').className = 'player-cover ' + song.art;
    $('#playerTitle').textContent = song.title;
    $('#playerGenre').textContent = `${song.artist} • ${song.genre}`;
    $('#playerReward').textContent = '+' + naira(song.reward);
    $('#player').hidden = false;
    updatePlayerUI();
  }

  function togglePlayer() {
    if (!player.song) return;
    player.playing = !player.playing;
    if (player.playing) {
      synth.start(player.song);
      player.timer = setInterval(tickPlayer, 250);
    } else {
      synth.stop();
      clearInterval(player.timer);
    }
    updatePlayerUI();
  }

  function stopSong() {
    synth.stop();
    clearInterval(player.timer);
    Object.assign(player, { song: null, elapsed: 0, playing: false, timer: null });
    $('#player').hidden = true;
    updatePlayerUI();
  }

  function tickPlayer() {
    player.elapsed += 0.25;
    if (player.elapsed >= LISTEN_SECONDS) {
      const song = player.song;
      state.songsPlayed += 1;
      credit(song.reward, 'music', `You earned ${naira(song.reward)} for listening to "${song.title}"`);
      stopSong();
      return;
    }
    updatePlayerUI();
  }

  function updatePlayerUI() {
    const pct = player.song ? (player.elapsed / LISTEN_SECONDS) * 100 : 0;
    const secs = Math.floor(player.elapsed);
    $('#playerBar').style.width = pct + '%';
    $('#playerTime').textContent = `0:${String(secs).padStart(2, '0')} / 0:${LISTEN_SECONDS}`;
    $('#playerToggle').innerHTML = icon(player.playing ? 'pause' : 'play');
    $('#playerToggle').setAttribute('aria-label', player.playing ? 'Pause' : 'Play');

    $$('.song').forEach((card) => {
      const active = player.song && card.dataset.id === player.song.id;
      card.classList.toggle('playing', !!active);
      $('.progress', card).style.width = active ? pct + '%' : '0';
      $('.cover-play', card).innerHTML = icon(active && player.playing ? 'pause' : 'play');
      const btn = $('.btn', card);
      btn.textContent = active ? (player.playing ? 'Pause' : 'Resume') : 'Play';
    });
  }

  /* =========================================================
     Markup builders
     ========================================================= */
  function statsHTML() {
    return `
      <section class="stats">
        <div class="stat purple">
          <span class="stat-icon">${icon('coins')}</span>
          <span class="label">Total Earnings</span>
          <span class="value" data-stat="total">${naira(state.total)}</span>
          <span class="delta">+ <span data-stat="todayEarn">${naira(state.today.earn)}</span> today</span>
        </div>
        <div class="stat blue">
          <span class="stat-icon">${icon('coins')}</span>
          <span class="label">Available Balance</span>
          <span class="value" data-stat="balance">${naira(state.balance)}</span>
          <button class="btn btn-primary btn-sm" data-action="withdraw">Withdraw</button>
        </div>
        <div class="stat teal">
          <span class="stat-icon">${icon('check')}</span>
          <span class="label">Tasks Completed</span>
          <span class="value" data-stat="tasks">${state.tasks}</span>
          <span class="delta">+ <span data-stat="todayTasks">${state.today.tasks}</span> today</span>
        </div>
        <div class="stat orange">
          <span class="stat-icon">${icon('users')}</span>
          <span class="label">Referral Bonus</span>
          <span class="value" data-stat="referralEarnings">${naira(state.referralEarnings)}</span>
          <span class="delta">+ <span data-stat="referrals">${state.referrals}</span> referrals</span>
        </div>
      </section>`;
  }

  function songHTML(s) {
    return `
      <article class="song" data-id="${s.id}" data-search="${esc((s.title + ' ' + s.genre + ' ' + s.artist).toLowerCase())}">
        <div class="song-cover">
          <div class="art ${s.art}">${icon(s.glyph)}</div>
          <button class="cover-play" data-action="play" data-id="${s.id}" aria-label="Play ${esc(s.title)}">${icon('play')}</button>
          <span class="progress"></span>
        </div>
        <div class="song-body">
          <b>${esc(s.title)}</b>
          <span class="genre">${esc(s.genre)} · ${esc(s.artist)}</span>
          <span class="reward"><span class="coin">₦</span> + ${naira(s.reward)}</span>
          <button class="btn btn-primary btn-sm" data-action="play" data-id="${s.id}">Play</button>
        </div>
      </article>`;
  }

  function taskHTML(t) {
    const left = taskLeft(t);
    const done = left <= 0;
    const label = done ? (t.id === 'checkin' ? 'Checked In' : 'Done today') : t.cta;
    const note = t.limit > 1 ? ` · ${Math.max(left, 0)}/${t.limit} left today` : '';
    return `
      <article class="task ${done ? 'done' : ''}" data-search="${esc((t.title + ' ' + t.desc).toLowerCase())}">
        <span class="task-icon">${icon(t.icon)}</span>
        <div>
          <b>${esc(t.title)}</b>
          <div class="desc">${esc(t.desc)}${note}</div>
          <div class="task-foot">
            <span class="reward"><span class="coin">₦</span> + ${naira(t.reward)}</span>
            <button class="btn btn-primary btn-sm" data-action="task" data-id="${t.id}" ${done ? 'disabled' : ''}>${label}</button>
          </div>
        </div>
      </article>`;
  }

  function activityHTML(list) {
    if (!list.length) return '<div class="empty">No activity yet — play a song to start earning!</div>';
    return list.map((a) => {
      const meta = ACT_META[a.type] || ACT_META.reward;
      return `
        <div class="act">
          <span class="act-icon ${a.type}">${icon(meta.icon)}</span>
          <div><b>${meta.title}${a.status ? `<em class="status">${esc(a.status)}</em>` : ''}</b><span>${esc(a.desc)}</span></div>
          <span class="time">${relTime(a.ts)}</span>
          <span class="amt ${a.amount < 0 ? 'neg' : ''}">${a.amount < 0 ? '' : '+ '}${naira(a.amount)}</span>
        </div>`;
    }).join('');
  }

  const panelHead = (ic, title, sub, link) => `
    <div class="panel-head">
      ${icon(ic)}
      <div><h2>${title}</h2>${sub ? `<p>${sub}</p>` : ''}</div>
      ${link ? `<a class="view-all" href="#${link}">View All</a>` : ''}
    </div>`;

  /* =========================================================
     Views
     ========================================================= */
  let historyFilter = 'all';

  const VIEWS = {
    dashboard: () => `
      <section class="welcome">
        <h1>Welcome back, <span class="name">${esc(firstName())}</span> ${icon('crown')}</h1>
        <p>Keep listening, keep tapping, keep earning!</p>
        <div class="welcome-pills">
          <a href="#listen">${icon('music')} Listen to Music</a>
          <a href="#tasks">${icon('tap')} Complete Tasks</a>
          <a href="#rewards">${icon('gift')} Earn Rewards</a>
        </div>
        <div class="welcome-art" aria-hidden="true">${icon('headphones')}<span class="note a">${icon('music')}</span><span class="note b">${icon('music')}</span></div>
      </section>
      ${statsHTML()}
      <section class="panel">
        ${panelHead('headphones', 'Listen to Music &amp; Earn', 'Play your favourite songs and earn rewards.', 'listen')}
        <div class="songs">${SONGS.slice(0, 4).map(songHTML).join('')}</div>
      </section>
      <section class="panel">
        ${panelHead('tap', 'Tap Tasks', 'Tap the screen and earn rewards.', 'tasks')}
        <div class="tasks">${TASKS.slice(0, 2).map(taskHTML).join('')}</div>
      </section>
      <section class="panel">
        ${panelHead('clock', 'Recent Activity', '', 'history')}
        <div class="activity">${activityHTML(state.activity.slice(0, 3))}</div>
      </section>`,

    listen: () => `
      <div class="page-title"><div><h1>Listen &amp; Earn</h1><p>Listen for ${LISTEN_SECONDS} seconds to earn the reward for each song.</p></div></div>
      <section class="panel">
        ${panelHead('headphones', 'All Songs', `You've completed <b>${state.songsPlayed}</b> songs so far.`)}
        <div class="songs">${SONGS.map(songHTML).join('')}</div>
      </section>`,

    tasks: () => `
      <div class="page-title"><div><h1>Tap Tasks</h1><p>Quick tasks that add up. Limits reset every day at midnight.</p></div></div>
      <section class="panel">
        ${panelHead('tap', 'Available Tasks', `Completed today: <b>${state.today.tasks}</b>`)}
        <div class="tasks">${TASKS.map(taskHTML).join('')}</div>
      </section>`,

    rewards: () => `
      <div class="page-title"><div><h1>Rewards</h1><p>Hit milestones to unlock bonus cash.</p></div></div>
      <section class="panel">
        ${panelHead('gift', 'Milestones', 'Claim your bonus as soon as a bar fills up.')}
        <div class="milestones">${MILESTONES.map((m) => {
          const v = m.value(state);
          const pct = Math.min(100, (v / m.goal) * 100);
          const claimed = state.claimed[m.id];
          const ready = v >= m.goal && !claimed;
          const fmt = (n) => (m.id === 'earn100k' ? naira(n) : n.toLocaleString());
          return `
            <article class="milestone">
              <div class="milestone-top">${icon(m.icon)}<div><b>${m.title}</b><small>${m.desc}</small></div></div>
              <div class="meter"><span style="width:${pct}%"></span></div>
              <div class="milestone-foot">
                <span>${fmt(Math.min(v, m.goal))} / ${fmt(m.goal)} · <b class="text-gold">+${naira(m.reward)}</b></span>
                <button class="btn btn-sm ${ready ? 'btn-pink' : 'btn-ghost'}" data-action="claim" data-id="${m.id}" ${ready ? '' : 'disabled'}>${claimed ? 'Claimed' : 'Claim'}</button>
              </div>
            </article>`;
        }).join('')}</div>
      </section>`,

    history: () => {
      const list = state.activity.filter((a) =>
        historyFilter === 'all' ? true : historyFilter === 'withdrawals' ? a.amount < 0 : a.amount > 0
      );
      const earned = state.activity.filter((a) => a.amount > 0).reduce((s, a) => s + a.amount, 0);
      const withdrawn = state.activity.filter((a) => a.amount < 0).reduce((s, a) => s - a.amount, 0);
      return `
        <div class="page-title"><div><h1>Transaction History</h1><p>Every reward and withdrawal on your account.</p></div>
          <button class="btn btn-primary" data-action="withdraw">${icon('wallet')} Withdraw</button></div>
        <section class="ref-stats" style="margin-top:0">
          <div><strong class="text-gold">${naira(earned)}</strong><span>Logged earnings</span></div>
          <div><strong>${naira(withdrawn)}</strong><span>Withdrawn</span></div>
          <div><strong>${state.activity.length}</strong><span>Transactions</span></div>
        </section>
        <section class="panel">
          <div class="filters">
            ${['all', 'earnings', 'withdrawals'].map((f) => `<button class="chip ${historyFilter === f ? 'active' : ''}" data-filter="${f}">${f[0].toUpperCase() + f.slice(1)}</button>`).join('')}
          </div>
          <div class="activity">${activityHTML(list)}</div>
        </section>`;
    },

    referral: () => {
      const link = referralLink();
      return `
        <div class="page-title"><div><h1>Referral Program</h1><p>Earn <b class="text-gold">${naira(REFERRAL_BONUS)}</b> for every friend who joins and completes a task.</p></div></div>
        <div class="two-col">
          <section class="panel">
            ${panelHead('share', 'Your invite link', 'Share it on WhatsApp, Instagram or anywhere.')}
            <div class="ref-box">
              <input class="input" id="refLink" value="${esc(link)}" readonly aria-label="Referral link" />
              <button class="btn btn-pink" data-action="copy-ref">${icon('copy')} Copy</button>
            </div>
            <div class="ref-stats">
              <div><strong>${state.referrals}</strong><span>Friends joined</span></div>
              <div><strong class="text-gold">${naira(state.referralEarnings)}</strong><span>Earned</span></div>
              <div><strong>${esc(referralCode())}</strong><span>Your code</span></div>
            </div>
          </section>
          <section class="panel">
            ${panelHead('help', 'How it works')}
            <ol class="ref-steps">
              <li><span><b>Share your link</b><br/>Send your unique invite link to friends.</span></li>
              <li><span><b>They sign up</b><br/>Your friend creates a free MelodyPay account.</span></li>
              <li><span><b>You both earn</b><br/>Once they finish their first task, ${naira(REFERRAL_BONUS)} lands in your wallet.</span></li>
            </ol>
          </section>
        </div>
        <section class="panel">
          ${panelHead('users', 'Your referrals')}
          <div class="activity">${state.friends.length ? '' : '<div class="empty">No referrals yet — share your link to start earning ' + naira(REFERRAL_BONUS) + ' per friend.</div>'}${state.friends.map((f) => `
            <div class="act">
              <span class="act-icon referral">${icon('user')}</span>
              <div><b>${esc(f.name)}</b><span>Joined and completed first task</span></div>
              <span class="time">${relTime(f.joined)}</span>
              <span class="amt">+ ${naira(REFERRAL_BONUS)}</span>
            </div>`).join('')}</div>
        </section>`;
    },

    settings: () => {
      const bank = state.bank || {};
      return `
        <div class="page-title"><div><h1>Account Settings</h1><p>Manage your profile and payout details.</p></div></div>
        <div class="two-col">
          <section class="panel">
            ${panelHead('user', 'Profile')}
            <form id="profileForm" class="form-grid" novalidate>
              <div class="field full"><label for="pfName">Full name</label><input class="input" id="pfName" name="name" value="${esc(user.name || '')}" /></div>
              <div class="field"><label for="pfEmail">Email</label><input class="input" id="pfEmail" name="email" type="email" value="${esc(user.email || '')}" readonly title="Your login email can't be changed" /></div>
              <div class="field"><label for="pfPhone">Phone</label><input class="input" id="pfPhone" name="phone" type="tel" placeholder="+234" value="${esc(user.phone || '')}" /></div>
              <div class="full"><button class="btn btn-primary" type="submit">Save profile</button></div>
            </form>
          </section>
          <section class="panel">
            ${panelHead('bank', 'Payout account', 'Used to pre-fill withdrawals.')}
            <form id="bankForm" novalidate>
              <div class="field"><label for="bkName">Bank</label><input class="input" id="bkName" name="bank" placeholder="e.g. GTBank" value="${esc(bank.bank || '')}" /></div>
              <div class="field"><label for="bkAcct">Account number</label><input class="input" id="bkAcct" name="account" inputmode="numeric" maxlength="10" value="${esc(bank.account || '')}" /><span class="field-error"></span></div>
              <button class="btn btn-primary" type="submit">Save bank details</button>
            </form>
          </section>
        </div>
        <section class="panel">
          ${panelHead('settings', 'Preferences')}
          <label style="display:flex;align-items:center;gap:12px;cursor:pointer">
            <input type="checkbox" id="muteToggle" ${state.muted ? 'checked' : ''} style="width:20px;height:20px;accent-color:#d946ef" />
            Mute music playback (you'll still earn rewards)
          </label>
        </section>
        <section class="panel danger-zone">
          ${panelHead('logout', 'Session')}
          <div style="display:flex;gap:12px;flex-wrap:wrap">
            <button class="btn btn-ghost" data-action="logout">${icon('logout')} Log out</button>
            <button class="btn btn-danger" data-action="reset">Reset my wallet data</button>
          </div>
        </section>`;
    },

    help: () => `
      <div class="page-title"><div><h1>Help &amp; Support</h1><p>Find answers or reach our team.</p></div></div>
      <section class="panel">
        ${panelHead('help', 'Frequently asked questions')}
        <div class="faq">
          <details><summary>How do I earn from songs? ${icon('chevron')}</summary><p>Press Play on any song and keep it playing for ${LISTEN_SECONDS} seconds. The reward is added to your wallet automatically.</p></details>
          <details><summary>What is the minimum withdrawal? ${icon('chevron')}</summary><p>You can withdraw once your available balance is at least ₦1,000. Payouts are processed within 24 hours.</p></details>
          <details><summary>Why is a task greyed out? ${icon('chevron')}</summary><p>Each task has a daily limit. Limits reset at midnight, so come back tomorrow for more.</p></details>
          <details><summary>How do referral bonuses work? ${icon('chevron')}</summary><p>Share your link from the Referral Program page. You earn ${naira(REFERRAL_BONUS)} when a friend signs up and completes their first task.</p></details>
        </div>
      </section>
      <section class="panel">
        ${panelHead('bell', 'Contact support', 'We usually reply within a few hours.')}
        <form id="supportForm" novalidate>
          <div class="field"><label for="spSubject">Subject</label><input class="input" id="spSubject" name="subject" placeholder="What do you need help with?" /></div>
          <div class="field"><label for="spMsg">Message</label><textarea class="input" id="spMsg" name="message" rows="4" placeholder="Describe the issue..."></textarea><span class="field-error"></span></div>
          <button class="btn btn-primary" type="submit">Send message</button>
        </form>
      </section>`
  };

  /* =========================================================
     Router + render
     ========================================================= */
  let current = 'dashboard';

  function render(view, { animate = true } = {}) {
    if (!VIEWS[view]) view = 'dashboard';
    current = view;
    const root = $('#view');
    root.innerHTML = VIEWS[view]();
    if (!animate) $$(':scope > *', root).forEach((el) => (el.style.animation = 'none'));
    $$('#sideNav a').forEach((a) => a.classList.toggle('active', a.dataset.view === view));
    updatePlayerUI();
    applySearch();
    updateChrome();
  }

  /** Re-render the current view after state changes (skips forms the user may be typing in). */
  function refresh(bump = []) {
    if (current !== 'settings' && current !== 'help') render(current, { animate: false });
    else updateChrome();
    bump.forEach((k) => $$(`[data-stat="${k}"]`).forEach((el) => {
      el.classList.remove('bump'); void el.offsetWidth; el.classList.add('bump');
    }));
  }

  function updateChrome() {
    $('#chipBalance').textContent = naira(state.balance);
    $('#avatarInitial').textContent = firstName().charAt(0).toUpperCase();
  }

  function onRoute() {
    const view = location.hash.slice(1) || 'dashboard';
    render(view);
    closeSidebar();
    window.scrollTo({ top: 0 });
  }

  /* =========================================================
     Search
     ========================================================= */
  function applySearch() {
    const q = $('#searchInput').value.trim().toLowerCase();
    $$('[data-search]').forEach((el) => { el.hidden = q && !el.dataset.search.includes(q); });
    $$('.songs, .tasks').forEach((grid) => {
      let msg = grid.nextElementSibling;
      if (msg && !msg.classList.contains('search-empty')) msg = null;
      const anyVisible = $$('[data-search]', grid).some((el) => !el.hidden);
      if (q && !anyVisible) {
        if (!msg) grid.insertAdjacentHTML('afterend', '<div class="empty search-empty"></div>');
        grid.nextElementSibling.textContent = `No results for "${q}"`;
      } else if (msg) msg.remove();
    });
  }

  /* =========================================================
     Tasks
     ========================================================= */
  function runTask(id) {
    const t = TASKS.find((x) => x.id === id);
    if (!t || taskLeft(t) <= 0) return;
    if (id === 'tap') openTap(t);
    else if (id === 'video') openVideo(t);
    else if (id === 'checkin') credit(t.reward, 'checkin', `You earned ${naira(t.reward)} for checking in`, { countsAsTask: true, taskId: id });
    else if (id === 'share') {
      copyText(referralLink());
      credit(t.reward, 'share', `You earned ${naira(t.reward)} for sharing MelodyPay`, { countsAsTask: true, taskId: id });
    }
  }

  // Tap task
  const TAP_GOAL = 50;
  const ARC = 2 * Math.PI * 54;
  let taps = 0;
  let tapTask = null;

  function openTap(t) {
    tapTask = t;
    taps = 0;
    $('#tapReward').textContent = naira(t.reward);
    $('#tapGoal').textContent = TAP_GOAL;
    $('#tapGoal2').textContent = TAP_GOAL;
    updateTap();
    openModal('#tapModal');
  }
  function updateTap() {
    $('#tapCount').textContent = taps;
    $('#tapArc').style.strokeDashoffset = ARC * (1 - taps / TAP_GOAL);
  }
  function onTap(e) {
    if (!tapTask || taps >= TAP_GOAL) return;
    taps++;
    updateTap();
    const btn = $('#tapBtn');
    btn.classList.remove('pop'); void btn.offsetWidth; btn.classList.add('pop');
    const ring = $('#tapRing');
    const r = ring.getBoundingClientRect();
    const plus = document.createElement('span');
    plus.className = 'tap-plus';
    plus.textContent = '+1';
    plus.style.left = (e.clientX ? e.clientX - r.left : r.width / 2) - 10 + 'px';
    plus.style.top = (e.clientY ? e.clientY - r.top : r.height / 2) - 20 + 'px';
    ring.appendChild(plus);
    setTimeout(() => plus.remove(), 700);
    if (navigator.vibrate) navigator.vibrate(8);
    if (taps === TAP_GOAL) {
      const t = tapTask;
      tapTask = null;
      setTimeout(() => {
        closeModal('#tapModal');
        credit(t.reward, 'tap', `You earned ${naira(t.reward)} for completing a tap task`, { countsAsTask: true, taskId: t.id });
      }, 500);
    }
  }

  // Video task
  let videoTimer = null;
  function openVideo(t) {
    const DURATION = 10;
    let elapsed = 0;
    $('#videoBar').style.width = '0';
    $('#videoReward').textContent = naira(t.reward);
    $('#videoLeft').textContent = `${DURATION}s remaining`;
    openModal('#videoModal');
    clearInterval(videoTimer);
    videoTimer = setInterval(() => {
      elapsed += 0.25;
      $('#videoBar').style.width = (elapsed / DURATION) * 100 + '%';
      $('#videoLeft').textContent = `${Math.ceil(DURATION - elapsed)}s remaining`;
      if (elapsed >= DURATION) {
        clearInterval(videoTimer);
        closeModal('#videoModal');
        credit(t.reward, 'video', `You earned ${naira(t.reward)} for watching a clip`, { countsAsTask: true, taskId: t.id });
      }
    }, 250);
  }

  /* =========================================================
     Rewards, referral, withdraw
     ========================================================= */
  function claim(id) {
    const m = MILESTONES.find((x) => x.id === id);
    if (!m || state.claimed[id] || m.value(state) < m.goal) return;
    state.claimed[id] = true;
    credit(m.reward, 'reward', `You earned ${naira(m.reward)} for "${m.title}"`);
  }

  function referralCode() {
    const slug = firstName().toUpperCase().replace(/[^A-Z]/g, '').slice(0, 6) || 'USER';
    return `MP-${slug}${(user.email || '').length + 21}`;
  }
  function referralLink() { return `https://www.melodypay.com/join?ref=${referralCode()}`; }

  function copyText(text) {
    if (navigator.clipboard && window.isSecureContext) {
      navigator.clipboard.writeText(text).catch(() => {});
    } else {
      const ta = document.createElement('textarea');
      ta.value = text; document.body.appendChild(ta); ta.select();
      try { document.execCommand('copy'); } catch { /* ignore */ }
      ta.remove();
    }
  }

  function openWithdraw() {
    const form = $('#withdrawForm');
    form.reset();
    $$('.field-error', form).forEach((e) => (e.textContent = ''));
    $('#wdAvail').textContent = naira(state.balance);
    if (state.bank) { form.bank.value = state.bank.bank; form.account.value = state.bank.account; }
    const amounts = [5000, 10000, 50000, state.balance].filter((v, i, a) => v >= 1000 && v <= state.balance && a.indexOf(v) === i);
    $('#quickAmounts').innerHTML = amounts.map((v) => `<button type="button" data-amt="${v}">${v === state.balance ? 'Max' : naira(v)}</button>`).join('');
    openModal('#withdrawModal');
  }

  function submitWithdraw(e) {
    e.preventDefault();
    const form = e.target;
    const amount = Math.floor(+form.amount.value);
    const errs = {
      amount: !amount ? 'Enter an amount.' : amount < 1000 ? 'Minimum withdrawal is ₦1,000.' : amount > state.balance ? 'Amount is more than your available balance.' : '',
      bank: form.bank.value ? '' : 'Select your bank.',
      account: /^\d{10}$/.test(form.account.value) ? '' : 'Account number must be 10 digits.'
    };
    ['amount', 'bank', 'account'].forEach((k) => { form[k].closest('.field').querySelector('.field-error').textContent = errs[k]; });
    if (Object.values(errs).some(Boolean)) return;

    state.balance -= amount;
    state.bank = { bank: form.bank.value, account: form.account.value };
    state.activity.unshift({
      type: 'withdraw', amount: -amount, ts: Date.now(), status: 'Pending',
      desc: `Withdrawal to ${form.bank.value} ••••${form.account.value.slice(-4)}`
    });
    save();
    closeModal('#withdrawModal');
    toast(`Withdrawal of ${naira(amount)} requested — arrives within 24 hours`, { coin: false });
    refresh(['balance']);
  }

  /* =========================================================
     Modals + sidebar
     ========================================================= */
  function openModal(sel) { $(sel).classList.add('open'); }
  function closeModal(sel) {
    $(sel).classList.remove('open');
    if (sel === '#videoModal') clearInterval(videoTimer);
    if (sel === '#tapModal') tapTask = null;
  }
  function closeSidebar() { $('#sidebar').classList.remove('open'); }

  /* =========================================================
     Events
     ========================================================= */
  document.addEventListener('DOMContentLoaded', () => {
    // Delegated clicks inside the page
    document.addEventListener('click', (e) => {
      const el = e.target.closest('[data-action], [data-filter], [data-amt]');
      if (!el) return;
      if (el.dataset.amt) { $('#wdAmount').value = el.dataset.amt; return; }
      if (el.dataset.filter) { historyFilter = el.dataset.filter; render('history', { animate: false }); return; }
      const { action, id } = el.dataset;
      if (action === 'play') playSong(id);
      else if (action === 'task') runTask(id);
      else if (action === 'withdraw') openWithdraw();
      else if (action === 'claim') claim(id);
      else if (action === 'copy-ref') { copyText(referralLink()); toast('Invite link copied!', { coin: false }); }
      else if (action === 'logout') { stopSong(); Auth.logout(); location.href = 'index.html'; }
      else if (action === 'reset') {
        if (confirm('Reset your balance, tasks and activity to zero?')) { stopSong(); state = defaultState(); save(); render(current); toast('Wallet data reset', { coin: false }); }
      }
    });

    // Delegated form submits
    document.addEventListener('submit', (e) => {
      const f = e.target;
      if (f.id === 'withdrawForm') return submitWithdraw(e);
      e.preventDefault();
      if (f.id === 'profileForm') {
        Object.assign(user, Auth.update({ name: f.name.value.trim() || user.name, phone: f.phone.value.trim() }));
        updateChrome();
        toast('Profile saved', { coin: false });
      } else if (f.id === 'bankForm') {
        const err = /^\d{10}$/.test(f.account.value) ? '' : 'Account number must be 10 digits.';
        f.account.closest('.field').querySelector('.field-error').textContent = err;
        if (err) return;
        state.bank = { bank: f.bank.value.trim(), account: f.account.value };
        save();
        toast('Bank details saved', { coin: false });
      } else if (f.id === 'supportForm') {
        const err = f.message.value.trim().length < 5 ? 'Please describe your issue.' : '';
        f.message.closest('.field').querySelector('.field-error').textContent = err;
        if (err) return;
        f.reset();
        toast("Message sent — we'll get back to you soon", { coin: false });
      }
    });

    document.addEventListener('change', (e) => {
      if (e.target.id === 'muteToggle') { state.muted = e.target.checked; synth.setMuted(state.muted); save(); }
    });

    // Modals
    $$('.modal').forEach((m) => m.addEventListener('click', (e) => {
      if (e.target === m || e.target.closest('[data-close]')) closeModal('#' + m.id);
    }));
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') { $$('.modal.open').forEach((m) => closeModal('#' + m.id)); closeSidebar(); }
    });
    $('#tapBtn').addEventListener('pointerdown', onTap);

    // Player
    $('#playerToggle').addEventListener('click', togglePlayer);
    $('#playerClose').addEventListener('click', stopSong);

    // Sidebar (mobile)
    $('#menuBtn').addEventListener('click', () => $('#sidebar').classList.add('open'));
    $('#sidebarBackdrop').addEventListener('click', closeSidebar);

    // Top bar
    $('#searchInput').addEventListener('input', () => {
      if (!['dashboard', 'listen', 'tasks'].includes(current)) location.hash = 'listen';
      applySearch();
    });
    $('#bellBtn').addEventListener('click', () => { $('#bellDot').hidden = true; location.hash = 'history'; });
    $('#avatarBtn').addEventListener('click', () => (location.hash = 'settings'));

    window.addEventListener('hashchange', onRoute);
    onRoute();
    save();

    // Keep "x hours ago" labels fresh
    setInterval(() => { if (current === 'dashboard' || current === 'history') refresh(); }, 60e3);
  });
})();
