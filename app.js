/* ============================ helpers ============================ */
const $ = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];

// Strip accents, lowercase, drop parentheticals & punctuation, collapse spaces.
function normalize(s, stripAccents = true) {
  s = s.toLowerCase().trim();
  s = s.replace(/\([^)]*\)/g, " ");          // remove (…) notes
  s = s.replace(/\[[^\]]*\]/g, " ");         // remove […] notes
  if (stripAccents) s = s.normalize("NFD").replace(/[̀-ͯ]/g, "");
  s = s.replace(/[.,;:!?'’"]/g, " ");
  s = s.replace(/\s+/g, " ").trim();
  return s;
}

// Build the set of acceptable answers from a raw string like "to begin, to start".
function acceptableAnswers(raw, stripAccents) {
  const variants = new Set();
  const full = normalize(raw, stripAccents);
  if (full) variants.add(full);
  // split on / ; , and "or"
  raw.split(/[\/;,]| or /i).forEach(part => {
    const n = normalize(part, stripAccents);
    if (n) variants.add(n);
  });
  // also a version with leading article/"to" removed (un, une, le, la, les, l', des, to)
  [...variants].forEach(v => {
    const stripped = v.replace(/^(to |un |une |le |la |les |l |des |the |a |an )/,"").trim();
    if (stripped && stripped !== v) variants.add(stripped);
  });
  return variants;
}

function shuffle(arr) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/* ============================ tabs ============================ */
$$("nav.tabs button").forEach(btn => {
  btn.addEventListener("click", () => {
    $$("nav.tabs button").forEach(b => b.classList.remove("active"));
    btn.classList.add("active");
    $$(".view").forEach(v => v.classList.remove("active"));
    $("#view-" + btn.dataset.view).classList.add("active");
  });
});

/* ============================ BROWSE ============================ */
const lessons = [...new Set(VOCAB.map(v => v.lesson))];
const browseState = { lesson: "all", q: "" };

function buildBrowseFilters() {
  const row = $("#browse-chips");
  const mk = (label, value) => {
    const c = document.createElement("button");
    c.className = "chip" + (value === browseState.lesson ? " active" : "");
    c.textContent = label;
    c.onclick = () => { browseState.lesson = value; renderBrowse();
      $$("#browse-chips .chip").forEach(x => x.classList.toggle("active", x === c)); };
    return c;
  };
  row.appendChild(mk("All", "all"));
  lessons.forEach(l => row.appendChild(mk(l, l)));
}

function highlight(text, q) {
  if (!q) return text;
  const i = text.toLowerCase().indexOf(q.toLowerCase());
  if (i === -1) return text;
  return text.slice(0, i) + "<mark>" + text.slice(i, i + q.length) + "</mark>" + text.slice(i + q.length);
}

function renderBrowse() {
  const wrap = $("#browse-list");
  wrap.innerHTML = "";
  const q = browseState.q.trim();
  let items = VOCAB.filter(v => browseState.lesson === "all" || v.lesson === browseState.lesson);
  if (q) {
    const nq = q.toLowerCase();
    items = items.filter(v => v.fr.toLowerCase().includes(nq) || v.en.toLowerCase().includes(nq));
  }
  $("#browse-count").textContent = items.length + " word" + (items.length === 1 ? "" : "s");

  if (!items.length) { wrap.innerHTML = '<div class="empty">No matches. Try another search.</div>'; return; }

  // group by lesson then category
  const byLesson = {};
  items.forEach(v => { (byLesson[v.lesson] ??= {}); (byLesson[v.lesson][v.category] ??= []).push(v); });

  for (const lesson of lessons) {
    if (!byLesson[lesson]) continue;
    for (const cat in byLesson[lesson]) {
      const group = byLesson[lesson][cat];
      const sec = document.createElement("div");
      sec.className = "cat-group";
      sec.innerHTML = `<div class="cat-head">
          <span class="badge">${lesson}</span>
          <h3>${cat}</h3>
          <span class="num">${group.length}</span>
        </div>`;
      const grid = document.createElement("div");
      grid.className = "vocab-grid";
      group.forEach(v => {
        const card = document.createElement("div");
        card.className = "vocab-card";
        card.innerHTML = `<span class="fr">${highlight(v.fr, q)}</span>
                          <span class="en">${highlight(v.en, q)}</span>`;
        grid.appendChild(card);
      });
      sec.appendChild(grid);
      wrap.appendChild(sec);
    }
  }
}

$("#browse-search").addEventListener("input", e => { browseState.q = e.target.value; renderBrowse(); });

/* ============================ TRAIN ============================ */
const trainCfg = { dir: "fr2en", scope: "all", count: 20 };
let quiz = null;

function buildTrainScope() {
  const seg = $("#scope-seg");
  const mk = (label, value) => {
    const b = document.createElement("button");
    b.textContent = label;
    b.className = value === trainCfg.scope ? "active" : "";
    b.onclick = () => { trainCfg.scope = value; $$("#scope-seg button").forEach(x => x.classList.toggle("active", x === b)); };
    return b;
  };
  seg.appendChild(mk("All units", "all"));
  lessons.forEach(l => seg.appendChild(mk(l, l)));
}

$$("#dir-seg button").forEach(b => b.onclick = () => {
  trainCfg.dir = b.dataset.dir;
  $$("#dir-seg button").forEach(x => x.classList.toggle("active", x === b));
});
$$("#count-seg button").forEach(b => b.onclick = () => {
  trainCfg.count = b.dataset.count === "all" ? Infinity : +b.dataset.count;
  $$("#count-seg button").forEach(x => x.classList.toggle("active", x === b));
});

$("#start-quiz").onclick = startQuiz;

function startQuiz() {
  let pool = VOCAB.filter(v => trainCfg.scope === "all" || v.lesson === trainCfg.scope);
  pool = shuffle(pool);
  if (trainCfg.count !== Infinity) pool = pool.slice(0, trainCfg.count);
  if (!pool.length) return;
  quiz = { items: pool, i: 0, correct: 0, missed: [], answered: false };
  $("#train-setup").style.display = "none";
  $("#train-results").style.display = "none";
  $("#train-quiz").style.display = "block";
  renderQuestion();
}

function curDirForItem() {
  // supports "mixed": pick per-question
  if (trainCfg.dir === "mixed") return Math.random() < 0.5 ? "fr2en" : "en2fr";
  return trainCfg.dir;
}

function renderQuestion() {
  const q = quiz.items[quiz.i];
  q._dir = curDirForItem();
  quiz.answered = false;

  const askFr = q._dir === "fr2en"; // show French, ask English
  $("#q-meta").textContent = `${q.lesson} · ${q.category}`;
  $("#q-prompt").textContent = askFr ? q.fr : q.en;
  $("#q-dir").textContent = askFr ? "Translate to English" : "Traduis en français";
  $("#q-num").textContent = `${quiz.i + 1} / ${quiz.items.length}`;

  const input = $("#q-input");
  input.value = "";
  input.className = "q-input";
  input.placeholder = askFr ? "English…" : "français…";
  input.disabled = false;
  input.focus();

  $("#q-feedback").className = "feedback";
  $("#q-feedback").innerHTML = "";
  $("#progress-bar").style.width = (quiz.i / quiz.items.length * 100) + "%";
  updateScorePill();

  const main = $("#q-action");
  main.textContent = "Check";
  main.onclick = checkAnswer;
  $("#q-skip").style.display = "inline-block";
}

function updateScorePill() {
  $("#score-pill").innerHTML = `<b>${quiz.correct}</b> / ${quiz.i + (quiz.answered ? 1 : 0)} correct`;
}

function checkAnswer() {
  if (quiz.answered) return;
  const q = quiz.items[quiz.i];
  const askFr = q._dir === "fr2en";
  const target = askFr ? q.en : q.fr;        // expected answer text
  const stripAccents = askFr ? true : true;  // be lenient on accents both ways
  const accepted = acceptableAnswers(target, stripAccents);
  const userRaw = $("#q-input").value;
  const user = normalize(userRaw, stripAccents);

  const input = $("#q-input");
  const fb = $("#q-feedback");
  quiz.answered = true;
  input.disabled = true;

  const ok = user.length > 0 && accepted.has(user);
  if (ok) {
    quiz.correct++;
    input.classList.add("good");
    fb.className = "feedback good";
    fb.innerHTML = "✓ Correct!";
  } else {
    input.classList.add("bad");
    fb.className = "feedback bad";
    fb.innerHTML = `✗ Answer: <span class="answer">${target}</span>`;
    quiz.missed.push({ ...q, dir: q._dir });
  }
  updateScorePill();

  // "I was right" override for lenient self-grading on near-misses
  if (!ok) {
    const override = document.createElement("button");
    override.className = "btn ghost";
    override.style.cssText = "margin-top:12px;font-size:13px;padding:7px 14px;";
    override.textContent = "I was right — count it";
    override.onclick = () => {
      if (quiz.missed[quiz.missed.length - 1] && quiz.missed[quiz.missed.length - 1].fr === q.fr) quiz.missed.pop();
      quiz.correct++;
      input.classList.remove("bad"); input.classList.add("good");
      fb.className = "feedback good"; fb.innerHTML = "✓ Counted as correct";
      updateScorePill();
    };
    fb.appendChild(override);
  }

  const main = $("#q-action");
  main.textContent = quiz.i + 1 >= quiz.items.length ? "See results" : "Next →";
  main.onclick = nextQuestion;
  $("#q-skip").style.display = "none";
}

function nextQuestion() {
  quiz.i++;
  if (quiz.i >= quiz.items.length) return showResults();
  renderQuestion();
}

$("#q-skip").onclick = () => {
  if (quiz.answered) return;
  const q = quiz.items[quiz.i];
  quiz.missed.push({ ...q, dir: q._dir });
  quiz.answered = true;
  checkRevealOnSkip();
};
function checkRevealOnSkip() {
  const q = quiz.items[quiz.i];
  const askFr = q._dir === "fr2en";
  const target = askFr ? q.en : q.fr;
  const input = $("#q-input");
  input.disabled = true; input.classList.add("bad");
  const fb = $("#q-feedback");
  fb.className = "feedback bad";
  fb.innerHTML = `Answer: <span class="answer">${target}</span>`;
  updateScorePill();
  const main = $("#q-action");
  main.textContent = quiz.i + 1 >= quiz.items.length ? "See results" : "Next →";
  main.onclick = nextQuestion;
  $("#q-skip").style.display = "none";
}

// Enter key: check, then advance
$("#q-input").addEventListener("keydown", e => {
  if (e.key === "Enter") { e.preventDefault(); if (!quiz.answered) checkAnswer(); else $("#q-action").click(); }
});

function showResults() {
  $("#train-quiz").style.display = "none";
  $("#train-results").style.display = "block";
  const total = quiz.items.length;
  const pct = Math.round(quiz.correct / total * 100);
  $("#result-score").innerHTML = `<span>${quiz.correct}</span>/${total}`;
  let msg = "Keep going!";
  if (pct === 100) msg = "Parfait ! Flawless. 🎉";
  else if (pct >= 85) msg = "Très bien ! Almost there.";
  else if (pct >= 60) msg = "Pas mal — review the misses below.";
  else msg = "Bon courage — practice the misses below.";
  $("#result-sub").textContent = `${pct}% · ${msg}`;

  const missed = $("#result-missed");
  if (!quiz.missed.length) { missed.innerHTML = ""; }
  else {
    missed.innerHTML = `<h4>Review (${quiz.missed.length})</h4><ul>` +
      quiz.missed.map(m => `<li><b>${m.fr}</b> — ${m.en} <span style="color:var(--muted)">(${m.lesson})</span></li>`).join("") +
      `</ul>`;
  }
}

$("#retry-missed").onclick = () => {
  if (!quiz || !quiz.missed.length) return;
  const items = shuffle(quiz.missed.map(m => ({ unit: m.unit, lesson: m.lesson, category: m.category, fr: m.fr, en: m.en })));
  quiz = { items, i: 0, correct: 0, missed: [], answered: false };
  $("#train-results").style.display = "none";
  $("#train-quiz").style.display = "block";
  renderQuestion();
};
$("#new-quiz").onclick = () => {
  $("#train-results").style.display = "none";
  $("#train-quiz").style.display = "none";
  $("#train-setup").style.display = "block";
};

/* ============================ GRAMMAR ============================ */
function esc(s) { return String(s).replace(/[&<>]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" }[c])); }

function renderGrammar() {
  const wrap = $("#grammar-body");
  if (!GRAMMAR.length) return; // placeholder stays
  renderGrammarList();
}

function renderGrammarList() {
  const wrap = $("#grammar-body");
  wrap.innerHTML = '<div class="gram-grid"></div>';
  const grid = $(".gram-grid", wrap);
  GRAMMAR.forEach(g => {
    const card = document.createElement("button");
    card.className = "gram-card";
    card.innerHTML = `<span class="badge">${g.code}</span>
      <h3>${esc(g.title)}</h3>
      <p>${esc(g.goal)}</p>
      <span class="gram-go">${g.drills.length} practice items →</span>`;
    card.onclick = () => openGrammarTopic(g.id);
    grid.appendChild(card);
  });
}

function blockHTML(b) {
  if (b.type === "text") return `<p class="g-text">${b.html}</p>`;
  if (b.type === "ex")
    return `<div class="g-ex">${b.items.map(i =>
      `<div class="g-ex-row"><span class="fr">${esc(i.fr)}</span><span class="en">${esc(i.en)}</span></div>`).join("")}</div>`;
  if (b.type === "conj")
    return `<div class="g-conj"><div class="g-cap">${esc(b.caption)}</div><div class="g-conj-grid">${
      b.rows.map(r => `<div class="g-conj-cell"><b>${esc(r[0])}</b><span>${esc(r[1])}</span></div>`).join("")
    }</div></div>`;
  if (b.type === "table")
    return `<div class="g-table"><div class="g-cap">${esc(b.caption)}</div><table>${
      (b.head && b.head.some(h => h)) ? `<thead><tr>${b.head.map(h => `<th>${esc(h)}</th>`).join("")}</tr></thead>` : ""
    }<tbody>${b.rows.map(r => `<tr>${r.map(c => `<td>${esc(c)}</td>`).join("")}</tr>`).join("")}</tbody></table></div>`;
  return "";
}

function openGrammarTopic(id) {
  const g = GRAMMAR.find(x => x.id === id);
  if (!g) return;
  const wrap = $("#grammar-body");
  wrap.innerHTML = `
    <button class="btn ghost g-back">← All topics</button>
    <div class="g-head"><span class="badge">${g.code} · ${g.lesson}</span><h2>${esc(g.title)}</h2>
      <p class="g-goal">${esc(g.goal)}</p></div>
    <p class="g-intro"><b>Point de départ</b> ${esc(g.intro)}</p>
    <div class="g-blocks">${g.blocks.map(blockHTML).join("")}</div>
    <div class="g-essayez">
      <div class="g-essayez-head"><span class="badge red">Essayez !</span><p>${esc(g.drillTitle)}</p></div>
      <div class="g-drills"></div>
      <div class="row-btns" style="margin-top:16px">
        <button class="btn ghost g-reveal">Show answers</button>
        <button class="btn g-check">Check answers</button>
      </div>
      <div class="g-result" id="g-result"></div>
    </div>`;

  const drillBox = $(".g-drills", wrap);
  g.drills.forEach((d, i) => {
    const parts = d.q.split("___");
    const row = document.createElement("div");
    row.className = "g-drill";
    row.innerHTML = `<span class="g-num">${i + 1}</span>
      <span class="g-q">${esc(parts[0])}<input class="g-input" data-i="${i}" autocomplete="off" autocapitalize="off" spellcheck="false" />${esc(parts[1] || "")}</span>
      <span class="g-note">${esc(d.note || "")}</span>`;
    drillBox.appendChild(row);
  });

  $(".g-back", wrap).onclick = renderGrammarList;

  const grade = (reveal) => {
    let correct = 0;
    g.drills.forEach((d, i) => {
      const input = drillBox.querySelector(`.g-input[data-i="${i}"]`);
      const accepted = acceptableAnswers(d.a, true);
      const ok = input.value.trim() && accepted.has(normalize(input.value, true));
      input.classList.remove("good", "bad");
      // clear any prior inline answer
      const old = input.parentElement.querySelector(".g-ans"); if (old) old.remove();
      if (ok) { input.classList.add("good"); correct++; }
      else {
        input.classList.add("bad");
        if (reveal || input.value.trim()) {
          const ans = document.createElement("span");
          ans.className = "g-ans"; ans.textContent = " ✓ " + d.a;
          input.insertAdjacentElement("afterend", ans);
        }
      }
      if (reveal && !ok) { input.value = d.a; input.classList.remove("bad"); }
    });
    const res = $("#g-result", wrap);
    if (reveal) { res.className = "g-result"; res.textContent = "Answers filled in above."; }
    else {
      const pct = Math.round(correct / g.drills.length * 100);
      res.className = "g-result " + (correct === g.drills.length ? "good" : "");
      res.textContent = `${correct} / ${g.drills.length} correct (${pct}%)` + (correct === g.drills.length ? " — Parfait !" : "");
    }
  };

  $(".g-check", wrap).onclick = () => grade(false);
  $(".g-reveal", wrap).onclick = () => grade(true);
  // Enter inside a drill input checks all
  drillBox.querySelectorAll(".g-input").forEach(inp =>
    inp.addEventListener("keydown", e => { if (e.key === "Enter") { e.preventDefault(); grade(false); } }));
  wrap.scrollIntoView({ behavior: "smooth", block: "start" });
}

/* ============================ init ============================ */
buildBrowseFilters();
renderBrowse();
buildTrainScope();
renderGrammar();
$("#total-count").textContent = VOCAB.length;
