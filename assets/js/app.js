/* =========================================================
   同源共响 · 交互逻辑
   无依赖；音频优先读取 data.js 中的 audio 路径，
   没有录音时使用浏览器语音合成作为“声音样带”。
   ========================================================= */
(function () {
  "use strict";

  const DATA = window.SAME_ORIGIN;
  if (!DATA || !Array.isArray(DATA.pairs)) return;

  const $ = (selector, root) => (root || document).querySelector(selector);
  const $$ = (selector, root) => Array.from((root || document).querySelectorAll(selector));
  const reducedMotion = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const SIDES = ["mainland", "taiwan"];
  const SIDE_LABEL = { mainland: "大陆", taiwan: "台湾" };
  const OTHER = { mainland: "taiwan", taiwan: "mainland" };

  const TONE_INFO = {
    0: { name: "轻声", desc: "轻而短", path: "M5 10 L21 11", st: [1, 0] },
    1: { name: "第一声 · 高平", desc: "高而平", path: "M3 4 L23 4", st: [5, 5] },
    2: { name: "第二声 · 阳平", desc: "中音起，往上挑", path: "M3 12 C9 11 15 8 23 3", st: [0, 6] },
    3: { name: "第三声 · 上声", desc: "先降再升", path: "M3 10 C6 15 11 15 14 12 C17 9 20 7 23 7", st: [1, -3, 5] },
    4: { name: "第四声 · 去声", desc: "高起直降", path: "M3 3 C9 7 16 12 23 15", st: [6, 0] },
  };
  const SUPER = { 0: "⁰", 1: "¹", 2: "²", 3: "³", 4: "⁴" };
  const TONE_MARK = {
    "ā": ["a", 1], "á": ["a", 2], "ǎ": ["a", 3], "à": ["a", 4],
    "ē": ["e", 1], "é": ["e", 2], "ě": ["e", 3], "è": ["e", 4],
    "ī": ["i", 1], "í": ["i", 2], "ǐ": ["i", 3], "ì": ["i", 4],
    "ō": ["o", 1], "ó": ["o", 2], "ǒ": ["o", 3], "ò": ["o", 4],
    "ū": ["u", 1], "ú": ["u", 2], "ǔ": ["u", 3], "ù": ["u", 4],
    "ǖ": ["ü", 1], "ǘ": ["ü", 2], "ǚ": ["ü", 3], "ǜ": ["ü", 4],
  };

  const state = {
    started: false,
    pairIndex: 0,
    voiceIndex: { mainland: 0, taiwan: 0 },
    activeSide: null,
    playingSide: null,
    played: { mainland: false, taiwan: false },
    pendingMerge: false,
    merged: false,
    muted: false,
    carousel: false,
    carouselIndex: 0,
    carouselTimer: null,
    timers: [],
    playToken: 0,
    voiceToken: 0,
    audio: null,
    audioContext: null,
    speechWatchdog: null,
    toastTimer: null,
    activeModal: null,
    lastFocus: null,
    ambientFrame: null,
    ambientParticles: [],
    ambientSize: { w: 0, h: 0 },
    voices: [],
    pendingHash: false,
    toneTimers: [],
    toneNodes: [],
    toneSide: null,
    pendingChime: false,
    chimeTimer: null,
    voiceInfo: { mainland: null, taiwan: null },
    twFallbackNotified: false,
    noteDismissed: false,
    mockRecording: false,
    mockRecordStart: 0,
    mockRecordTimer: null,
  };

  const el = {};
  let toastEl;
  let liveEl;

  function currentPair() {
    return DATA.pairs[state.pairIndex];
  }

  function parsePinyin(pinyin) {
    return String(pinyin || "")
      .trim()
      .split(/\s+/)
      .filter(Boolean)
      .map(function (syllable) {
        let tone = 0;
        Array.from(syllable).forEach(function (char) {
          if (TONE_MARK[char]) tone = TONE_MARK[char][1];
        });
        return { display: syllable, tone: tone };
      });
  }

  function describeTones(side) {
    const pair = currentPair();
    return parsePinyin(pair[side].pinyin)
      .map(function (syllable) {
        const info = TONE_INFO[syllable.tone] || TONE_INFO[0];
        return syllable.display + "，" + info.name;
      })
      .join("；");
  }

  function renderTone(side) {
    const pair = currentPair();
    const isCn = side === "mainland";
    const toneEl = isCn ? el.cnTone : el.twTone;
    const pinyinEl = isCn ? el.cnPinyin : el.twPinyin;
    if (!toneEl || !pinyinEl) return;
    const syllables = parsePinyin(pair[side].pinyin);
    pinyinEl.textContent = syllables
      .map(function (syllable) {
        return syllable.display + SUPER[syllable.tone];
      })
      .join(" ");
    toneEl.innerHTML = syllables
      .map(function (syllable) {
        const info = TONE_INFO[syllable.tone] || TONE_INFO[0];
        return (
          '<span class="tone-syl" data-tone="' + syllable.tone + '" title="' +
          escapeHTML(syllable.display + " · " + info.name + "（" + info.desc + "）") + '">' +
          '<svg viewBox="0 0 26 16" aria-hidden="true"><path d="' + info.path + '"/></svg>' +
          "<i>" + (syllable.tone === 0 ? "·" : syllable.tone) + "</i></span>"
        );
      })
      .join("");
  }

  function escapeHTML(value) {
    return String(value)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  function cacheElements() {
    el.intro = $("#intro");
    el.experience = $("#experience");
    el.startBtn = $("#startBtn");
    el.brandHome = $("#brandHome");
    el.aboutBtn = $("#aboutBtn");
    el.introDetailBtn = $("#introDetailBtn");
    el.soundToggle = $("#soundToggle");
    el.soundLabel = $("#soundLabel");
    el.pairList = $("#pairList");
    el.audioNote = $("#audioNote");
    el.audioNoteClose = $("#audioNoteClose");
    el.voiceStatus = $("#voiceStatus");
    el.cnTone = $("#cnTone");
    el.twTone = $("#twTone");
    el.stageActionHint = $("#stageActionHint");
    el.dockTone = $("#dockTone");
    el.detailPronNote = $("#detailPronNote");
    el.pairIndex = $("#pairIndex");
    el.pairNavLabel = $("#pairNavLabel");
    el.prevPair = $("#prevPair");
    el.nextPair = $("#nextPair");
    el.journey = $("#journey");
    el.journeyBar = $("#journeyBar");
    el.journeyPercent = $("#journeyPercent");
    el.cnScript = $("#cnScript");
    el.cnWord = $("#cnWord");
    el.cnPinyin = $("#cnPinyin");
    el.cnListen = $("#cnListen");
    el.cnVoice = $("#cnVoice");
    el.cnDots = $("#cnDots");
    el.cnStory = $("#cnStory");
    el.cnStoryText = $("#cnStoryText");
    el.cnAvatar = $("#cnAvatar");
    el.cnTag = $("#cnTag");
    el.cnPlace = $("#cnPlace");
    el.cnQuote = $("#cnQuote");
    el.twScript = $("#twScript");
    el.twWord = $("#twWord");
    el.twPinyin = $("#twPinyin");
    el.twListen = $("#twListen");
    el.twVoice = $("#twVoice");
    el.twDots = $("#twDots");
    el.twStory = $("#twStory");
    el.twStoryText = $("#twStoryText");
    el.twAvatar = $("#twAvatar");
    el.twTag = $("#twTag");
    el.twPlace = $("#twPlace");
    el.twQuote = $("#twQuote");
    el.cardMainland = $("#cardMainland");
    el.cardTaiwan = $("#cardTaiwan");
    el.stage = $("#stage");
    el.stageType = $("#stageType");
    el.sourceChar = $("#sourceChar");
    el.ghostLeft = $("#ghostLeft");
    el.ghostRight = $("#ghostRight");
    el.toneConverge = $("#toneConverge");
    el.stageHint = $("#stageHint");
    el.stageNote = $("#stageNote");
    el.stageStat = $("#stageStat");
    el.ripples = $("#ripples");
    el.listenOtherBtn = $("#listenOtherBtn");
    el.detailBtn = $("#detailBtn");
    el.carouselBtn = $("#carouselBtn");
    el.footHint = $("#footHint");
    el.shareBtn = $("#shareBtn");
    el.voiceDock = $("#voiceDock");
    el.dockRegion = $("#dockRegion");
    el.dockTag = $("#dockTag");
    el.dockAvatar = $("#dockAvatar");
    el.dockStory = $("#dockStory");
    el.dockDemoFlag = $("#dockDemoFlag");
    el.dockQuote = $("#dockQuote");
    el.dockSwitch = $("#dockSwitch");
    el.dockOther = $("#dockOther");
    el.dockDetail = $("#dockDetail");
    el.detailModal = $("#detailModal");
    el.shareModal = $("#shareModal");
    el.aboutModal = $("#aboutModal");
    el.buildModal = $("#buildModal");
    el.detailType = $("#detailType");
    el.detailTitle = $("#detailTitle");
    el.detailSub = $("#detailSub");
    el.detailWords = $("#detailWords");
    el.detailSource = $("#detailSource");
    el.detailRoute = $("#detailRoute");
    el.detailStories = $("#detailStories");
    el.detailCitations = $("#detailCitations");
    el.detailShare = $("#detailShare");
    el.buildBtn = $("#buildBtn");
    el.buildNotify = $("#buildNotify");
    el.mockRecord = $("#mockRecord");
    el.mockRecordTime = $("#mockRecordTime");
    el.mockRecordTip = $("#mockRecordTip");
    el.mockRecordStart = $("#mockRecordStart");
    el.mockRecordStop = $("#mockRecordStop");
    el.poster = $("#posterCanvas");
    el.downloadPoster = $("#downloadPoster");
    el.shareNative = $("#shareNative");
    el.copyLink = $("#copyLink");
    el.toast = $("#toast");
    el.live = $("#live");
    toastEl = el.toast;
    liveEl = el.live;
  }

  /* ---------------------------------------------------------
     渲染与状态
     --------------------------------------------------------- */
  function renderPairList() {
    el.pairList.innerHTML = DATA.pairs
      .map((pair, index) => {
        const selected = index === state.pairIndex;
        return (
          '<button class="pair-chip' + (selected ? " is-active" : "") + '" type="button" role="tab" aria-selected="' +
          selected + '" tabindex="' + (selected ? "0" : "-1") + '" data-index="' + index + '">' +
          '<span class="chip-no">' + escapeHTML(pair.no) + "</span>" +
          "<span>" + escapeHTML(pair.mainland.display) + "</span>" +
          '<span class="chip-sep">/</span>' +
          "<span>" + escapeHTML(pair.taiwan.display) + "</span>" +
          "</button>"
        );
      })
      .join("");
  }

  function updatePairList() {
    const chips = $$(".pair-chip", el.pairList);
    chips.forEach((chip, index) => {
      const active = index === state.pairIndex;
      chip.classList.toggle("is-active", active);
      chip.setAttribute("aria-selected", String(active));
      chip.tabIndex = active ? 0 : -1;
    });
    const activeChip = chips[state.pairIndex];
    if (activeChip && el.pairList) {
      const target = activeChip.offsetLeft - el.pairList.clientWidth / 2 + activeChip.clientWidth / 2;
      el.pairList.scrollTo({ left: Math.max(0, target), behavior: reducedMotion ? "auto" : "smooth" });
    }
  }

  function setStageType(pair) {
    el.stageType.textContent = pair.type;
    el.stageType.className = "stage-type type-" + pair.typeKey;
  }

  function renderToneConverge(pair) {
    const box = el.toneConverge;
    if (!box) return;
    const isSound = pair.typeKey === "sound";
    el.stage.setAttribute("data-sound", isSound ? "true" : "false");
    if (!isSound) {
      box.innerHTML = "";
      box.classList.remove("is-on");
      return;
    }
    // 两条声调曲线（两岸首音节），复用 TONE_INFO.path，汇入中央同一个字。
    const cnTone = parsePinyin(pair.mainland.pinyin)[0] || { tone: 0, display: pair.mainland.pinyin };
    const twTone = parsePinyin(pair.taiwan.pinyin)[0] || { tone: 0, display: pair.taiwan.pinyin };
    const cnPath = (TONE_INFO[cnTone.tone] || TONE_INFO[0]).path;
    const twPath = (TONE_INFO[twTone.tone] || TONE_INFO[0]).path;
    box.innerHTML =
      '<svg class="tone-curve tone-curve-left" viewBox="0 0 26 16" aria-hidden="true"><path d="' + cnPath + '"/></svg>' +
      '<svg class="tone-curve tone-curve-right" viewBox="0 0 26 16" aria-hidden="true"><path d="' + twPath + '"/></svg>' +
      '<span class="tone-curve-label">' + escapeHTML(cnTone.display) + ' / ' + escapeHTML(twTone.display) + "</span>";
    box.classList.add("is-on");
  }

  function setStoryPlaceholder(side) {
    // 未点击时也展示该岸首位讲述者 + 短句（演示文本），不再显示"等待发声"。
    const pair = currentPair();
    const voice = pair[side].voices[0];
    if (!voice) return;
    const isCn = side === "mainland";
    const avatar = isCn ? el.cnAvatar : el.twAvatar;
    const tag = isCn ? el.cnTag : el.twTag;
    const place = isCn ? el.cnPlace : el.twPlace;
    const quote = isCn ? el.cnQuote : el.twQuote;
    const storyText = isCn ? el.cnStoryText : el.twStoryText;
    const story = isCn ? el.cnStory : el.twStory;
    avatar.textContent = voice.avatar;
    tag.textContent = voice.tag;
    place.textContent = voice.place;
    quote.textContent = "“" + voice.quote + "”";
    if (storyText) storyText.textContent = voice.story || "";
    story.classList.remove("is-empty");
    story.classList.add("is-demo");
  }

  function renderStory(side) {
    const pair = currentPair();
    const voice = pair[side].voices[state.voiceIndex[side]];
    if (!voice) return;
    const isCn = side === "mainland";
    const avatar = isCn ? el.cnAvatar : el.twAvatar;
    const tag = isCn ? el.cnTag : el.twTag;
    const place = isCn ? el.cnPlace : el.twPlace;
    const quote = isCn ? el.cnQuote : el.twQuote;
    const storyText = isCn ? el.cnStoryText : el.twStoryText;
    const story = isCn ? el.cnStory : el.twStory;
    avatar.textContent = voice.avatar;
    tag.textContent = voice.tag;
    place.textContent = voice.place;
    quote.textContent = "“" + voice.quote + "”";
    if (storyText) storyText.textContent = voice.story || "";
    story.classList.remove("is-empty");
    story.classList.add("is-demo");
  }

  function renderVoiceMeta(side) {
    const pair = currentPair();
    const voice = pair[side].voices[state.voiceIndex[side]];
    const isCn = side === "mainland";
    const voiceEl = isCn ? el.cnVoice : el.twVoice;
    const dotsEl = isCn ? el.cnDots : el.twDots;
    const listen = isCn ? el.cnListen : el.twListen;
    if (!voice) return;
    const total = pair[side].voices.length;
    voiceEl.textContent = "声音 " + (state.voiceIndex[side] + 1) + " / " + total + (voice.audio ? " · 生成音频" : " · 合成声");
    voiceEl.setAttribute("title", voice.audio ? "生成音频：机器合成、非真人录音、非田野采集；正式版替换真人录音" : "合成声样带：已按讲述者年龄与语气调整语速、音高；正式版替换真人录音");
    dotsEl.innerHTML = pair[side].voices
      .map((_, index) => '<i class="' + (index === state.voiceIndex[side] ? "is-on" : "") + '"></i>')
      .join("");
    if (!state.playingSide) {
      listen.textContent = state.played[side] ? "再听一次" : "点击听音";
    }
  }

  function renderDock() {
    const pair = currentPair();
    const side = state.activeSide || "mainland";
    const voice = pair[side].voices[state.voiceIndex[side]];
    if (!voice) return;
    if (el.dockAvatar) {
      el.dockAvatar.textContent = voice.avatar;
      el.dockAvatar.classList.toggle("is-tw", side === "taiwan");
    }
    el.dockRegion.textContent = SIDE_LABEL[side];
    el.dockRegion.className = "dock-region" + (side === "mainland" ? " is-mainland" : "");
    el.dockTag.textContent = voice.tag + " · " + voice.place;
    el.dockQuote.textContent = "“" + voice.quote + "”";
    if (el.dockStory) el.dockStory.textContent = voice.story || "";
    if (el.dockDemoFlag) el.dockDemoFlag.hidden = false;
    el.voiceDock.classList.add("is-live");
    el.dockSwitch.textContent = "换声音";
    el.dockOther.textContent = "听" + SIDE_LABEL[OTHER[side]];
    el.dockDetail.textContent = "完整故事";
  }

  function resetDock() {
    const pair = currentPair();
    const voice = pair.mainland.voices[0];
    if (el.dockAvatar && voice) {
      el.dockAvatar.textContent = voice.avatar;
      el.dockAvatar.classList.remove("is-tw");
    }
    el.dockRegion.textContent = "大陆 · 讲述者";
    el.dockRegion.className = "dock-region is-mainland";
    el.dockTag.textContent = voice ? voice.tag + " · " + voice.place : "演示讲述者";
    el.dockQuote.textContent = voice ? "“" + voice.quote + "”" : "";
    if (el.dockStory) el.dockStory.textContent = voice ? voice.story || "" : "";
    if (el.dockDemoFlag) el.dockDemoFlag.hidden = false;
    el.voiceDock.classList.add("is-live");
    el.dockSwitch.textContent = "换声音";
    el.dockOther.textContent = "听台湾";
    el.dockDetail.textContent = "完整故事";
  }

  function updateCardContent(side) {
    const pair = currentPair();
    const isCn = side === "mainland";
    const data = pair[side];
    const scriptEl = isCn ? el.cnScript : el.twScript;
    const wordEl = isCn ? el.cnWord : el.twWord;
    const card = isCn ? el.cardMainland : el.cardTaiwan;
    scriptEl.textContent = data.script;
    wordEl.textContent = data.display;
    renderTone(side);
    card.dataset.watermark = pair.sourceChar;
    card.setAttribute("aria-label", "播放" + SIDE_LABEL[side] + "发音：" + data.display + "，" + describeTones(side));
    renderVoiceMeta(side);
  }

  function applyPair(index, options) {
    const opts = options || {};
    const total = DATA.pairs.length;
    const nextIndex = ((index % total) + total) % total;
    stopAudio();
    stopCarousel(true);
    clearTimers();
    state.pairIndex = nextIndex;
    state.activeSide = null;
    state.playingSide = null;
    state.played = { mainland: false, taiwan: false };
    state.pendingMerge = false;
    state.merged = false;
    state.voiceIndex = { mainland: 0, taiwan: 0 };
    state.carouselIndex = 0;
    const pair = currentPair();

    updateCardContent("mainland");
    updateCardContent("taiwan");
    setStoryPlaceholder("mainland");
    setStoryPlaceholder("taiwan");
    resetDock();

    el.pairIndex.textContent = pair.no;
    el.pairNavLabel.textContent = pair.mainland.display + " / " + pair.taiwan.display;
    el.stage.dataset.state = "idle";
    el.sourceChar.textContent = pair.sourceChar;
    el.ghostLeft.textContent = pair.mainland.display;
    el.ghostRight.textContent = pair.taiwan.display;
    setStageType(pair);
    renderToneConverge(pair);
    el.stageHint.textContent = "点一张词卡，听见它的来路";
    el.stageNote.textContent = pair.typeNote;
    el.stageStat.textContent = "0 / 2 个声音";
    resetStageActions();
    el.footHint.textContent = "先点任意一张词卡，下一步会浮现";
    el.cardMainland.classList.remove("is-playing");
    el.cardTaiwan.classList.remove("is-playing");
    el.shareBtn.classList.remove("is-nudge");
    setJourney("listen");
    updatePairList();

    if (state.started) {
      document.title = DATA.title + " · " + pair.mainland.display + " / " + pair.taiwan.display;
      if (!opts.silentHash) setHash(pair.id);
    }
    if (!opts.keepLive) {
      el.live.textContent = "已选择：" + pair.mainland.display + " / " + pair.taiwan.display + "。" + pair.typeNote;
    }
    if (!opts.silentHash && !state.started) setHash(pair.id);
  }

  function setHash(id) {
    if (!id) return;
    try {
      history.replaceState(null, "", "#" + id);
    } catch (error) {
      location.hash = id;
    }
  }

  const JOURNEY_PROGRESS = { listen: 0, trace: 45, echo: 100 };
  function setJourney(step) {
    const order = ["listen", "trace", "echo"];
    const index = order.indexOf(step);
    $$(".journey-step", el.journey).forEach((node, nodeIndex) => {
      node.classList.toggle("is-active", nodeIndex === index);
      node.classList.toggle("is-done", nodeIndex < index);
    });
    const progress = JOURNEY_PROGRESS[step] || 0;
    if (el.journeyBar) el.journeyBar.style.width = progress + "%";
    if (el.journeyPercent) el.journeyPercent.textContent = progress + "%";
  }

  function revealButton(button) {
    if (!button) return;
    const wasHidden = button.hidden;
    button.hidden = false;
    button.removeAttribute("disabled");
    if (wasHidden) {
      button.classList.remove("is-revealed");
      void button.offsetWidth;
      button.classList.add("is-revealed");
    }
  }

  function resetStageActions() {
    [el.listenOtherBtn, el.detailBtn].forEach(function (button) {
      if (!button) return;
      button.hidden = true;
      button.classList.remove("is-revealed");
      button.removeAttribute("disabled");
    });
    if (el.stageActionHint) {
      el.stageActionHint.hidden = false;
      el.stageActionHint.textContent = "点一张词卡，下一步会出现在这里";
    }
  }

  function updateStageActions() {
    const any = state.played.mainland || state.played.taiwan;
    const both = state.played.mainland && state.played.taiwan;
    const other = state.activeSide ? OTHER[state.activeSide] : "taiwan";
    if (any) {
      el.listenOtherBtn.textContent = state.played[other] ? "再听" + SIDE_LABEL[other] : "听" + SIDE_LABEL[other];
      revealButton(el.listenOtherBtn);
    } else {
      el.listenOtherBtn.hidden = true;
      el.listenOtherBtn.classList.remove("is-revealed");
    }
    if (both) {
      revealButton(el.detailBtn);
    } else {
      el.detailBtn.hidden = true;
      el.detailBtn.classList.remove("is-revealed");
    }
    if (el.stageActionHint) el.stageActionHint.hidden = any;
  }

  function updateStageCount() {
    const count = Number(state.played.mainland) + Number(state.played.taiwan);
    el.stageStat.textContent = count + " / 2 个声音";
  }

  function setActiveSideUI(side) {
    [el.cardMainland, el.cardTaiwan].forEach((card) => {
      const isThis = card === (side === "mainland" ? el.cardMainland : el.cardTaiwan);
      card.classList.toggle("is-playing", isThis);
    });
    const activeListen = side === "mainland" ? el.cnListen : el.twListen;
    const otherListen = side === "mainland" ? el.twListen : el.cnListen;
    activeListen.textContent = state.muted ? "声音已关闭" : "正在播放";
    otherListen.textContent = state.played[OTHER[side]] ? "再听一次" : "点击听音";
  }

  function finishPlayback(side) {
    if (state.playingSide !== side) return;
    state.playingSide = null;
    el.cardMainland.classList.remove("is-playing");
    el.cardTaiwan.classList.remove("is-playing");
    el.cnListen.textContent = state.played.mainland ? "再听一次" : "点击听音";
    el.twListen.textContent = state.played.taiwan ? "再听一次" : "点击听音";
    // 两条录音都播放结束 → 共鸣成功，进度条读满 100%。
    if (state.pendingMerge && !state.merged && state.played.mainland && state.played.taiwan) {
      state.pendingMerge = false;
      mergeStage();
    }
    if (state.pendingChime) {
      state.pendingChime = false;
      clearTimeout(state.chimeTimer);
      state.chimeTimer = setTimeout(function () {
        state.chimeTimer = null;
        if (!state.playingSide) playChime();
      }, 260);
    }
  }

  /* ---------------------------------------------------------
     播放
     --------------------------------------------------------- */
  function initAudioContext() {
    if (!state.audioContext) {
      const Context = window.AudioContext || window.webkitAudioContext;
      if (!Context) return null;
      try {
        state.audioContext = new Context();
      } catch (error) {
        return null;
      }
    }
    if (state.audioContext.state === "suspended") {
      state.audioContext.resume().catch(function () {});
    }
    return state.audioContext;
  }

  function playChime() {
    if (state.muted) return;
    const context = initAudioContext();
    if (!context) return;
    const now = context.currentTime;
    [196, 293.66, 392].forEach(function (frequency, index) {
      const oscillator = context.createOscillator();
      const gain = context.createGain();
      oscillator.type = index === 0 ? "sine" : "triangle";
      oscillator.frequency.setValueAtTime(frequency, now);
      gain.gain.setValueAtTime(0.0001, now);
      gain.gain.exponentialRampToValueAtTime(0.035 / (index + 1), now + 0.06);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + 1.15 + index * 0.18);
      oscillator.connect(gain);
      gain.connect(context.destination);
      oscillator.start(now);
      oscillator.stop(now + 1.5 + index * 0.18);
    });
  }

  function playClick() {
    // 60ms 极轻咔嗒，卡片点击时；只受静音开关控制，不随动效降级关闭。
    if (state.muted) return;
    const ctx = initAudioContext();
    if (!ctx) return;
    const t = ctx.currentTime;
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.type = "triangle";
    osc.frequency.setValueAtTime(880, t);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.022, t + 0.005);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.06);
    osc.connect(g);
    g.connect(ctx.destination);
    osc.start(t);
    osc.stop(t + 0.07);
  }

  function playThud() {
    // 260ms 低咚，汇流时；只受静音开关控制。
    if (state.muted) return;
    const ctx = initAudioContext();
    if (!ctx) return;
    const t = ctx.currentTime;
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.type = "sine";
    osc.frequency.setValueAtTime(110, t);
    osc.frequency.exponentialRampToValueAtTime(62, t + 0.26);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.055, t + 0.02);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.26);
    osc.connect(g);
    g.connect(ctx.destination);
    osc.start(t);
    osc.stop(t + 0.28);
  }

  function getSpeechVoices() {
    const synth = window.speechSynthesis;
    if (!synth) return [];
    if (!state.voices.length) {
      try {
        state.voices = synth.getVoices() || [];
      } catch (error) {
        state.voices = [];
      }
    }
    return state.voices;
  }

  function isTaiwanVoice(voice) {
    const lang = String(voice.lang || "").toLowerCase();
    const name = String(voice.name || "");
    return /^zh[-_]?(tw|hant)/.test(lang) || /taiwan|台灣|台湾|yating|meijia|美佳|hanhan|han-han/i.test(name);
  }

  function isMainlandVoice(voice) {
    if (isTaiwanVoice(voice)) return false;
    const lang = String(voice.lang || "").toLowerCase();
    const name = String(voice.name || "");
    return /^zh[-_]?(cn|hans|sg)/.test(lang) || /mainland|china|中国|大陸|大陆|huihui|xiaoxiao|xiaoyi|kangkang|yaoyao|tingting|lili|yunxi|yunyang|yunjian|普通话/i.test(name);
  }

  function pickVoice(side, index) {
    const voices = getSpeechVoices();
    const want = side === "taiwan" ? "zh-TW" : "zh-CN";
    if (!voices.length) {
      return { voice: null, lang: want, fallback: false, label: "系统默认声线" };
    }
    const zhVoices = voices.filter(function (voice) {
      return /^zh/i.test(String(voice.lang || "")) || /chinese|中文|國語|国语|普通話|普通话/i.test(String(voice.name || ""));
    });
    const pool = zhVoices.length ? zhVoices : voices;
    let candidates = side === "taiwan" ? pool.filter(isTaiwanVoice) : pool.filter(isMainlandVoice);
    let fallback = false;
    if (!candidates.length) {
      candidates = pool;
      fallback = true;
    }
    const chosen = candidates[index % candidates.length] || null;
    if (chosen) {
      if (side === "taiwan" && !isTaiwanVoice(chosen)) fallback = true;
      if (side === "mainland" && isTaiwanVoice(chosen)) fallback = true;
    }
    return {
      voice: chosen,
      lang: chosen ? String(chosen.lang || want) : want,
      fallback: fallback,
      label: chosen ? String(chosen.name || chosen.lang || "系统声线") : "系统默认声线",
    };
  }

  function voiceProfile(voiceData, side, index) {
    const tag = String((voiceData && voiceData.tag) || "");
    let rate = 0.94;
    let pitch = 1;
    if (/青年/.test(tag)) {
      rate = 1;
      pitch = 1.08;
    } else if (/中年/.test(tag)) {
      rate = 0.94;
      pitch = 0.99;
    } else if (/老年|長者|长者/.test(tag)) {
      rate = 0.86;
      pitch = 0.87;
    }
    pitch += (index % 2) * 0.06;
    rate += (index % 2) * 0.04;
    if (side === "taiwan") {
      pitch += 0.01;
      rate -= 0.01;
    }
    return {
      rate: Math.max(0.62, Math.min(1.22, rate)),
      pitch: Math.max(0.7, Math.min(1.3, pitch)),
    };
  }

  function sampleSentence(voiceData) {
    const raw = String((voiceData && (voiceData.quote || voiceData.story)) || "");
    const clean = raw.replace(/^[“”"'「」]+|[“”"'「」]+$/g, "").trim();
    if (!clean) return "";
    const sentences = clean
      .split(/[。！？!?；;]/)
      .map(function (sentence) {
        return sentence.trim();
      })
      .filter(function (sentence) {
        return sentence && !/[A-Za-z]/.test(sentence);
      });
    const first = sentences[0] || clean;
    return first.length > 24 ? first.slice(0, 24) + "…" : first;
  }

  function speechFallback(side) {
    showToast("此浏览器没有可用的语音合成，先用声调示范听这一岸。");
    finishPlayback(side);
    playToneGuide(side);
  }

  function speakSide(side) {
    const synth = window.speechSynthesis;
    if (!synth || typeof SpeechSynthesisUtterance === "undefined") {
      speechFallback(side);
      return;
    }
    const pair = currentPair();
    const index = state.voiceIndex[side];
    const voiceData = pair[side].voices[index];
    if (!voiceData) return;
    const info = pickVoice(side, index);
    const profile = voiceProfile(voiceData, side, index);
    const word = voiceData.ttsText || voiceData.text || pair[side].text;
    // 同字异读词：多音字单念时，中文 TTS 引擎普遍按最高频音朗读（期→qī、微→wēi），
    // 台湾标准音会被抹平。音频加载失败回退到合成声时，用同音字引导读出本地标准音（期→其 qí、微→围 wéi）。
    // 只作用于单字示范部分；生活短句仍读原字，避免把“期中考/微信”读成怪词。
    const ttsWord = pair.typeKey === "sound" && pair[side].ttsSpeak ? pair[side].ttsSpeak : word;
    const sample = sampleSentence(voiceData);
    const parts = [{ text: ttsWord, rate: profile.rate * 0.8, pitch: profile.pitch, pause: sample ? 420 : 0 }];
    if (sample && sample !== word) {
      parts.push({ text: sample, rate: profile.rate * 0.98, pitch: profile.pitch, pause: 0 });
    }
    const token = ++state.voiceToken;
    try {
      synth.cancel();
    } catch (error) {}
    let settled = false;
    let watchdog = null;
    function finish() {
      if (settled) return;
      settled = true;
      clearTimeout(watchdog);
      watchdog = null;
      if (token !== state.voiceToken) return;
      finishPlayback(side);
    }
    function speakPart(partIndex) {
      if (settled || token !== state.voiceToken) return;
      if (partIndex >= parts.length) {
        finish();
        return;
      }
      const part = parts[partIndex];
      const utterance = new SpeechSynthesisUtterance(String(part.text || ""));
      utterance.lang = info.lang || (side === "taiwan" ? "zh-TW" : "zh-CN");
      if (info.voice) utterance.voice = info.voice;
      utterance.rate = Math.max(0.5, Math.min(1.5, part.rate));
      utterance.pitch = Math.max(0.5, Math.min(1.6, part.pitch));
      utterance.volume = state.muted ? 0 : 0.94;
      let advanced = false;
      function next() {
        if (advanced) return;
        advanced = true;
        clearTimeout(watchdog);
        watchdog = null;
        if (settled || token !== state.voiceToken) return;
        if (partIndex + 1 >= parts.length) {
          finish();
          return;
        }
        watchdog = setTimeout(function () {
          speakPart(partIndex + 1);
        }, part.pause);
      }
      utterance.onend = next;
      utterance.onerror = next;
      try {
        synth.speak(utterance);
      } catch (error) {
        next();
        return;
      }
      watchdog = setTimeout(next, Math.max(3200, String(part.text).length * 560));
    }
    speakPart(0);
  }

  function playVoice(pair, side, voiceIndex, playToken) {
    const voice = pair[side].voices[voiceIndex];
    if (!voice) return;
    if (state.muted) {
      showToast("声音已关闭，点右上角开启。");
      setTimeout(function () {
        if (state.playToken === playToken) finishPlayback(side);
      }, 900);
      return;
    }
    if (voice.audio) {
      const audio = new Audio(voice.audio);
      state.audio = audio;
      audio.preload = "auto";
      audio.volume = 0.96;
      const finish = function () {
        if (state.audio === audio) state.audio = null;
        if (state.playToken === playToken) finishPlayback(side);
      };
      audio.onended = finish;
      audio.onerror = function () {
        if (state.audio === audio) state.audio = null;
        if (state.playToken === playToken) speakSide(side);
      };
      audio.play().catch(function () {
        if (state.audio === audio) state.audio = null;
        if (state.playToken === playToken) speakSide(side);
      });
      return;
    }
    speakSide(side);
  }

  function stopAudio() {
    state.pendingChime = false;
    clearTimeout(state.chimeTimer);
    state.chimeTimer = null;
    state.voiceToken += 1;
    if (window.speechSynthesis) {
      try {
        window.speechSynthesis.cancel();
      } catch (error) {}
    }
    if (state.audio) {
      try {
        state.audio.pause();
        state.audio.currentTime = 0;
      } catch (error) {}
      state.audio = null;
    }
    clearTimeout(state.speechWatchdog);
    state.speechWatchdog = null;
    clearToneHighlight();
    if (state.playingSide) finishPlayback(state.playingSide);
  }

  function clearToneHighlight() {
    state.toneTimers.forEach(function (timer) {
      clearTimeout(timer);
    });
    state.toneTimers = [];
    state.toneNodes.forEach(function (node) {
      try {
        node.stop();
      } catch (error) {}
    });
    state.toneNodes = [];
    state.toneSide = null;
    [el.cnTone, el.twTone].forEach(function (node) {
      if (!node) return;
      $$(".tone-syl", node).forEach(function (syl) {
        syl.classList.remove("is-on");
      });
    });
    [el.cardMainland, el.cardTaiwan].forEach(function (card) {
      if (card) card.classList.remove("is-toning");
    });
  }

  function playToneGuide(side) {
    if (state.muted) {
      showToast("声音已关闭，点右上角开启后再听声调。");
      return;
    }
    if (state.carousel) stopCarousel(true);
    state.pendingChime = false;
    const context = initAudioContext();
    if (!context) {
      showToast("当前浏览器不支持声调示范，请更换较新的浏览器。");
      return;
    }
    stopAudio();
    const pair = currentPair();
    const syllables = parsePinyin(pair[side].pinyin);
    if (!syllables.length) return;
    const toneEl = side === "mainland" ? el.cnTone : el.twTone;
    const card = side === "mainland" ? el.cardMainland : el.cardTaiwan;
    if (card) card.classList.add("is-toning");
    state.toneSide = side;
    const base = 196;
    const start = context.currentTime + 0.08;
    let cursor = start;
    syllables.forEach(function (syllable, index) {
      const info = TONE_INFO[syllable.tone] || TONE_INFO[0];
      const duration = syllable.tone === 0 ? 0.34 : 0.64;
      const oscillator = context.createOscillator();
      const gain = context.createGain();
      oscillator.type = "sine";
      const freqs = info.st.map(function (semitone) {
        return base * Math.pow(2, semitone / 12);
      });
      oscillator.frequency.setValueAtTime(freqs[0], cursor);
      if (freqs.length > 2) {
        oscillator.frequency.linearRampToValueAtTime(freqs[1], cursor + duration * 0.55);
        oscillator.frequency.linearRampToValueAtTime(freqs[2], cursor + duration);
      } else {
        oscillator.frequency.exponentialRampToValueAtTime(freqs[1], cursor + duration);
      }
      gain.gain.setValueAtTime(0.0001, cursor);
      gain.gain.exponentialRampToValueAtTime(0.085, cursor + 0.05);
      gain.gain.setValueAtTime(0.085, cursor + duration * 0.7);
      gain.gain.exponentialRampToValueAtTime(0.0001, cursor + duration);
      oscillator.connect(gain);
      gain.connect(context.destination);
      oscillator.start(cursor);
      oscillator.stop(cursor + duration + 0.02);
      state.toneNodes.push(oscillator);
      const offset = Math.round((cursor - start) * 1000);
      state.toneTimers.push(setTimeout(function () {
        if (!toneEl) return;
        $$(".tone-syl", toneEl).forEach(function (node, nodeIndex) {
          node.classList.toggle("is-on", nodeIndex === index);
        });
        el.live.textContent = "声调示范：" + pair[side].display + "，第 " + (index + 1) + " 个音节 " + syllable.display + "，" + info.name + "（" + info.desc + "）。";
      }, offset));
      cursor += duration + 0.2;
    });
    state.toneTimers.push(setTimeout(function () {
      clearToneHighlight();
      showToast("声调示范：" + describeTones(side));
    }, Math.round((cursor - start) * 1000) + 120));
  }

  function updateVoiceStatus() {
    if (!el.voiceStatus) return;
    const synth = window.speechSynthesis;
    if (!synth || typeof SpeechSynthesisUtterance === "undefined") {
      el.voiceStatus.hidden = false;
      el.voiceStatus.classList.add("is-warn");
      el.voiceStatus.textContent = "本机不支持语音合成 · 可用「声调」听四声";
      return;
    }
    const voices = getSpeechVoices();
    if (!voices.length) {
      el.voiceStatus.hidden = false;
      el.voiceStatus.textContent = "正在检测本机语音…";
      return;
    }
    const mainland = pickVoice("mainland", 0);
    const taiwan = pickVoice("taiwan", 0);
    function shortLabel(label) {
      return String(label || "系统声线")
        .replace(/^Microsoft\s+/i, "")
        .replace(/\s*-\s*(Chinese|中文).*$/i, "")
        .replace(/\s*\(.*?\)\s*/g, "")
        .trim()
        .slice(0, 14) || "系统声线";
    }
    const notes = ["本机：" + shortLabel(mainland.label)];
    if (taiwan.fallback) {
      notes.push("未检出台湾国语声线 · 暂用普通话声线");
      el.voiceStatus.classList.add("is-warn");
      state.voiceInfo.taiwanFallback = true;
    } else {
      notes.push("台湾：" + shortLabel(taiwan.label));
      el.voiceStatus.classList.remove("is-warn");
      state.voiceInfo.taiwanFallback = false;
    }
    el.voiceStatus.textContent = notes.join(" · ");
    el.voiceStatus.title = notes.join("\n");
    if (state.voiceInfo.taiwanFallback && state.started && !state.twFallbackNotified) {
      state.twFallbackNotified = true;
      showToast("本机没有台湾国语声线，台湾声音暂用普通话声线代替；口音差异以注音和声调示范标注。");
    }
  }

  /* ---------------------------------------------------------
     播放流程与词源动效
     --------------------------------------------------------- */
  function clearTimers() {
    state.timers.forEach(function (timer) {
      clearTimeout(timer);
    });
    state.timers = [];
  }

  function later(fn, delay) {
    const timer = setTimeout(fn, delay);
    state.timers.push(timer);
    return timer;
  }

  function traceStage() {
    if (!state.started || !state.activeSide) return;
    const pair = currentPair();
    el.stage.dataset.state = "tracing";
    if (pair.typeKey === "sound") {
      el.stageHint.textContent = "同一个字，两条声调，正在回到同一个中古音";
      el.stageNote.textContent = pair.shared + "。两岸写法相同，只是声调各走了一条路。";
    } else {
      el.stageHint.textContent = "两个字，正在回到共同的源头";
      el.stageNote.textContent = pair.shared + "。沿着各自的口音往回走，它们会在同一个字形里相遇。";
    }
    setJourney("trace");
    el.live.textContent = "开始溯源：" + pair.shared;
  }

  function mergeStage() {
    if (!state.started || state.merged) return;
    const pair = currentPair();
    state.merged = true;
    el.stage.dataset.state = "merged";
    el.stageHint.textContent = pair.typeKey === "sound" ? "同一个字，两条声调，回到同一个中古音" : "同源，在此共鸣";
    el.stageNote.textContent = pair.sourceNote;
    setJourney("echo");
    updateStageCount();
    updateStageActions();
    el.footHint.textContent = state.played.mainland && state.played.taiwan
      ? "两岸都听过了 · 看词源，或把同源卡分享出去"
      : "再听另一岸，词源与完整故事就会打开";
    el.shareBtn.classList.add("is-nudge");
    triggerRipples();
    // 高潮帧定格：落印金线一闪，300ms 后移除，截图即海报视觉。
    if (!reducedMotion) {
      el.stage.classList.add("is-climax");
      setTimeout(function () { el.stage.classList.remove("is-climax"); }, 300);
    }
    playThud();
    if (state.playingSide) {
      state.pendingChime = true;
    } else {
      setTimeout(playChime, 80);
    }
    if (!reducedMotion && navigator.vibrate && navigator.userActivation && navigator.userActivation.isActive) {
      try {
        navigator.vibrate([16, 42, 24]);
      } catch (error) {}
    }
    el.live.textContent = "同源共鸣：" + pair.shared + "。" + pair.sourceNote;
  }

  function triggerRipples() {
    el.ripples.classList.remove("is-pulsing");
    void el.ripples.offsetWidth;
    el.ripples.classList.add("is-pulsing");
    setTimeout(function () {
      el.ripples.classList.remove("is-pulsing");
    }, 2300);
  }

  function playSide(side, options) {
    const opts = options || {};
    if (!state.started) return;
    if (!opts.fromCarousel && state.carousel) stopCarousel(true);
    if (!opts.keepTimers) clearTimers();
    initAudioContext();
    stopAudio();
    const token = ++state.playToken;
    const pair = currentPair();
    const other = OTHER[side];
    const voice = pair[side].voices[state.voiceIndex[side]];
    state.activeSide = side;
    state.played[side] = true;
    state.playingSide = side;
    setActiveSideUI(side);
    renderStory(side);
    renderVoiceMeta(side);
    renderDock();
    updateStageCount();
    el.stage.dataset.state = "listening";
    el.stageHint.textContent = "正在听：" + SIDE_LABEL[side] + " · " + pair[side].display;
    el.stageNote.textContent = state.played[other]
      ? "两种声音都到了。让它们回到同一个源头。"
      : "再听一听" + SIDE_LABEL[other] + "，同一个词，会有另一种日常。";
    updateStageActions();
    el.footHint.textContent = state.played[other]
      ? "两岸都听过了，点「看词源」或「完整故事」"
      : "再听另一岸，词源就会打开";
    el.shareBtn.classList.remove("is-nudge");
    el.live.textContent = "正在播放" + SIDE_LABEL[side] + "，" + (voice ? voice.tag : "") + "。";

    if (!opts.silent) playVoice(pair, side, state.voiceIndex[side], token);

    // 进度与真实交互对齐：
    // 未点录音 = 听见 0%；点任意一条 = 溯源 45%；两条录音都播放结束 = 共鸣 100%。
    const both = state.played.mainland && state.played.taiwan;
    if (state.merged) {
      // 本组词已完成共鸣，重听不回退进度。
      setJourney("echo");
    } else {
      setJourney("trace"); // 任意一条录音即推进到 45%
      later(function () {
        if (state.playToken !== token || state.merged) return;
        traceStage();
      }, 450);
      if (both) {
        // 两岸都点过，等当前这条播放结束再共鸣（由 finishPlayback 触发）。
        state.pendingMerge = true;
      }
    }
  }

  function cycleVoice(side) {
    if (!state.started) return;
    const pair = currentPair();
    const total = pair[side].voices.length;
    if (total < 2) {
      showToast("这一岸暂时只有一个声音。");
      return;
    }
    state.voiceIndex[side] = (state.voiceIndex[side] + 1) % total;
    const nextVoice = pair[side].voices[state.voiceIndex[side]];
    renderVoiceMeta(side);
    renderStory(side);
    renderDock();
    showToast("已换声音：" + (nextVoice ? nextVoice.tag + " · " + nextVoice.place : SIDE_LABEL[side]));
    playSide(side);
  }

  function listenOther() {
    if (!state.started) return;
    const side = state.activeSide ? OTHER[state.activeSide] : "taiwan";
    playSide(side);
  }

  /* ---------------------------------------------------------
     多声轮播
     --------------------------------------------------------- */
  function stopCarousel(silent) {
    const wasOn = state.carousel;
    state.carousel = false;
    clearInterval(state.carouselTimer);
    state.carouselTimer = null;
    if (el.carouselBtn) {
      el.carouselBtn.setAttribute("aria-pressed", "false");
      el.carouselBtn.innerHTML = '<span class="carousel-dot" aria-hidden="true"></span> 多声轮播';
    }
    if (wasOn && !silent) showToast("已停止多声轮播。");
  }

  function carouselNext() {
    if (!state.carousel) return;
    const sequence = [
      { side: "mainland", voice: 0 },
      { side: "taiwan", voice: 0 },
      { side: "mainland", voice: 1 },
      { side: "taiwan", voice: 1 },
    ];
    const item = sequence[state.carouselIndex % sequence.length];
    state.carouselIndex += 1;
    const pair = currentPair();
    state.voiceIndex[item.side] = Math.min(item.voice, pair[item.side].voices.length - 1);
    renderVoiceMeta(item.side);
    renderStory(item.side);
    renderDock();
    playSide(item.side, { fromCarousel: true });
  }

  function toggleCarousel() {
    if (!state.started) return;
    if (state.carousel) {
      stopCarousel(false);
      return;
    }
    if (state.muted) setMuted(false, true);
    state.carousel = true;
    state.carouselIndex = 0;
    el.carouselBtn.setAttribute("aria-pressed", "true");
    el.carouselBtn.innerHTML = '<span class="carousel-dot" aria-hidden="true"></span> 正在轮播';
    showToast("多声轮播：大陆、台湾、两种声音，依次响起。");
    carouselNext();
    state.carouselTimer = setInterval(carouselNext, 9200);
  }

  /* ---------------------------------------------------------
     体验切换（进度由交互步骤驱动，无倒计时压迫）
     --------------------------------------------------------- */
  function startExperience() {
    if (state.started) return;
    state.started = true;
    initAudioContext();
    updateVoiceStatus();
    document.body.classList.add("experience-mode");
    el.intro.classList.remove("is-active");
    el.experience.classList.add("is-active");
    setJourney("listen");
    setHash(currentPair().id);
    document.title = DATA.title + " · " + currentPair().mainland.display + " / " + currentPair().taiwan.display;
  }

  function goHome() {
    stopAudio();
    stopCarousel(true);
    clearTimers();
    closeAllModals();
    state.started = false;
    state.playingSide = null;
    state.carousel = false;
    document.body.classList.remove("experience-mode");
    el.experience.classList.remove("is-active");
    el.intro.classList.add("is-active");
    applyPair(state.pairIndex, { silentHash: true, keepLive: true });
    document.title = DATA.title + " · " + DATA.subtitle;
    setTimeout(function () {
      el.startBtn.focus({ preventScroll: true });
    }, 420);
  }

  function setMuted(muted, silent) {
    state.muted = Boolean(muted);
    el.soundToggle.classList.toggle("is-muted", state.muted);
    el.soundToggle.setAttribute("aria-pressed", String(!state.muted));
    el.soundToggle.setAttribute("aria-label", state.muted ? "开启声音" : "关闭声音");
    el.soundLabel.textContent = state.muted ? "静音" : "声音";
    if (state.muted) {
      stopAudio();
      if (!silent) showToast("声音已关闭，文字与动效继续。");
    } else if (!silent) {
      initAudioContext();
      showToast("声音已开启。");
    }
  }

  /* ---------------------------------------------------------
     声音档案 / 词源详情
     --------------------------------------------------------- */
  function openDetail() {
    const pair = currentPair();
    stopAudio();
    stopCarousel(true);
    // 主动查看词源即视为“溯源→共鸣”的交互：补齐阶段，让进度条真实反映到访。
    if (state.started && !state.merged) {
      clearTimers();
      state.pendingMerge = false;
      traceStage();
      mergeStage();
    }
    el.detailType.textContent = pair.type;
    el.detailType.className = "detail-type type-" + pair.typeKey;
    el.detailTitle.textContent = pair.mainland.display + " / " + pair.taiwan.display;
    el.detailSub.textContent = pair.typeNote;
    function wordMarkup(side) {
      const data = pair[side];
      const zhuyin = data.zhuyin ? '<em class="detail-zhuyin">' + escapeHTML(data.zhuyin) + "</em>" : "";
      return '<div class="detail-word ' + side + '"><small>' + SIDE_LABEL[side] + " · " + escapeHTML(data.lang) + "</small><b>" + escapeHTML(data.display) + "</b><i>" + escapeHTML(data.pinyin) + "</i>" + zhuyin + "</div>";
    }
    el.detailWords.innerHTML =
      wordMarkup("mainland") +
      '<div class="detail-source-mark"><span>' + escapeHTML(pair.sourceChar) + "</span><small>" + escapeHTML(pair.shared) + "</small></div>" +
      wordMarkup("taiwan");
    el.detailSource.textContent = pair.sourceNote;
    el.detailRoute.textContent = pair.route;
    if (el.detailPronNote) {
      const notes = SIDES.filter(function (side) {
        return pair[side].pronNote;
      }).map(function (side) {
        return SIDE_LABEL[side] + "：" + pair[side].pronNote;
      });
      el.detailPronNote.textContent = notes.join(" ");
      el.detailPronNote.hidden = !notes.length;
    }
    el.detailCitations.innerHTML = pair.citations.map(function (citation) {
      return "<li>" + escapeHTML(citation) + "</li>";
    }).join("");
    el.detailStories.innerHTML = SIDES.map(function (side) {
      return pair[side].voices.map(function (voice) {
        return '<div class="story-archive ' + side + '">' +
          '<div class="archive-head"><b>' + SIDE_LABEL[side] + "</b><span>" + escapeHTML(voice.tag) + "</span><span>" + escapeHTML(voice.place) + "</span></div>" +
          "<p>" + escapeHTML(voice.story) + "</p>" +
          "</div>";
      }).join("");
    }).join("");
    openModal("detailModal");
  }

  /* ---------------------------------------------------------
     弹层
     --------------------------------------------------------- */
  function focusable(panel) {
    return $$('button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])', panel).filter(function (node) {
      return !node.disabled && node.offsetParent !== null;
    });
  }

  function openModal(id) {
    const modal = document.getElementById(id);
    if (!modal) return;
    closeAllModals(true);
    state.lastFocus = document.activeElement;
    state.activeModal = id;
    modal.classList.add("is-open");
    modal.setAttribute("aria-hidden", "false");
    document.body.classList.add("modal-open");
    const panel = $(".modal-panel", modal);
    setTimeout(function () {
      if (panel) panel.focus({ preventScroll: true });
    }, 40);
  }

  function closeModal(id) {
    const modal = document.getElementById(id);
    if (!modal) return;
    if (id === "buildModal") stopMockRecord(false);
    modal.classList.remove("is-open");
    modal.setAttribute("aria-hidden", "true");
    if (state.activeModal === id) state.activeModal = null;
    if (!$$(".modal.is-open").length) document.body.classList.remove("modal-open");
    if (state.lastFocus && document.contains(state.lastFocus)) {
      try {
        state.lastFocus.focus({ preventScroll: true });
      } catch (error) {}
    }
    state.lastFocus = null;
  }

  function closeAllModals(silent) {
    if (state.mockRecording) stopMockRecord(false);
    $$(".modal.is-open").forEach(function (modal) {
      modal.classList.remove("is-open");
      modal.setAttribute("aria-hidden", "true");
    });
    state.activeModal = null;
    if (!silent) document.body.classList.remove("modal-open");
  }

  function trapFocus(event) {
    if (!state.activeModal || event.key !== "Tab") return;
    const modal = document.getElementById(state.activeModal);
    const panel = modal ? $(".modal-panel", modal) : null;
    if (!panel) return;
    const nodes = focusable(panel);
    if (!nodes.length) {
      event.preventDefault();
      panel.focus();
      return;
    }
    const first = nodes[0];
    const last = nodes[nodes.length - 1];
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  }

  /* ---------------------------------------------------------
     同源卡
     --------------------------------------------------------- */
  function roundRect(ctx, x, y, width, height, radius) {
    const r = Math.min(radius, width / 2, height / 2);
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + width, y, x + width, y + height, r);
    ctx.arcTo(x + width, y + height, x, y + height, r);
    ctx.arcTo(x, y + height, x, y, r);
    ctx.arcTo(x, y, x + width, y, r);
    ctx.closePath();
  }

  function drawSpaced(ctx, text, x, y, spacing, align) {
    const chars = String(text).split("");
    const widths = chars.map(function (char) { return ctx.measureText(char).width; });
    const total = widths.reduce(function (sum, width) { return sum + width; }, 0) + spacing * (chars.length - 1);
    let cursor = align === "center" ? x - total / 2 : x;
    ctx.save();
    ctx.textAlign = "left";
    chars.forEach(function (char, index) {
      ctx.fillText(char, cursor, y);
      cursor += widths[index] + spacing;
    });
    ctx.restore();
    return total;
  }

  function wrapCanvasText(ctx, text, maxWidth, maxLines) {
    const chars = String(text).split("");
    const lines = [];
    let line = "";
    chars.forEach(function (char) {
      const test = line + char;
      if (ctx.measureText(test).width > maxWidth && line) {
        if (/[，。；、！？：”]/.test(char)) {
          lines.push(line + char);
          line = "";
        } else if (/[“「]$/.test(line) && line.length > 1) {
          const opener = line.slice(-1);
          lines.push(line.slice(0, -1));
          line = opener + char;
        } else {
          lines.push(line);
          line = char;
        }
      } else {
        line = test;
      }
    });
    if (line) lines.push(line);
    if (lines.length > maxLines) {
      const clipped = lines.slice(0, maxLines);
      clipped[maxLines - 1] = clipped[maxLines - 1].replace(/[，。；、]$/, "") + "……";
      return clipped;
    }
    return lines;
  }

  function drawQRCode(ctx, text, x, y, size) {
    // 用本地 qrcode.min.js 把二维码同步画到一张临时 canvas，再合成进海报（纯本地、无上传）。
    // 这个 qrcodejs 版本内部走 canvas 渲染（不是 table），且绘制是同步的，直接读画布即可。
    if (typeof window.QRCode !== "function" || !text) return;
    let holder;
    try {
      holder = document.createElement("div");
      holder.style.cssText = "position:absolute;left:-99999px;top:0;";
      document.body.appendChild(holder);
      new window.QRCode(holder, {
        text: text,
        width: size,
        height: size,
        colorDark: "#202a27",
        colorLight: "#f4ecdd",
        correctLevel: (window.QRCode.CorrectLevel && window.QRCode.CorrectLevel.M) || 0,
      });
      const qrCanvas = holder.querySelector("canvas");
      if (!qrCanvas) { holder.remove(); return; }
      ctx.save();
      ctx.fillStyle = "#f4ecdd";
      ctx.fillRect(x - 5, y - 5, size + 10, size + 10);
      ctx.drawImage(qrCanvas, x, y, size, size);
      ctx.restore();
    } catch (error) {
      // 二维码生成失败不影响海报主体。
    } finally {
      if (holder && holder.parentNode) holder.remove();
    }
  }

  function drawPoster() {
    const canvas = el.poster;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const pair = currentPair();
    const side = state.activeSide || "mainland";
    const voice = pair[side].voices[state.voiceIndex[side]] || pair.mainland.voices[0];
    const W = canvas.width;
    const H = canvas.height;

    ctx.clearRect(0, 0, W, H);
    ctx.fillStyle = "#f4ecdd";
    ctx.fillRect(0, 0, W, H);

    let seed = 41;
    function random() {
      seed = (seed * 1664525 + 1013904223) % 4294967296;
      return seed / 4294967296;
    }
    ctx.save();
    for (let i = 0; i < 1500; i += 1) {
      const x = random() * W;
      const y = random() * H;
      ctx.fillStyle = random() > 0.5 ? "rgba(87, 64, 38, 0.045)" : "rgba(255, 255, 255, 0.42)";
      ctx.fillRect(x, y, 1.6, 1.6);
    }
    ctx.restore();

    ctx.strokeStyle = "rgba(32, 42, 39, 0.18)";
    ctx.lineWidth = 1;
    ctx.strokeRect(56, 56, W - 112, H - 112);
    ctx.strokeStyle = "rgba(181, 135, 73, 0.28)";
    ctx.strokeRect(66, 66, W - 132, H - 132);

    // 顶部品牌
    ctx.save();
    ctx.translate(88, 92);
    ctx.rotate(-0.05);
    roundRect(ctx, 0, 0, 54, 54, 7);
    ctx.fillStyle = "#a63d31";
    ctx.fill();
    ctx.fillStyle = "#fbf7ee";
    ctx.font = '500 32px "Songti SC", "STSong", "SimSun", serif';
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText("源", 27, 29);
    ctx.restore();

    ctx.textAlign = "left";
    ctx.textBaseline = "middle";
    ctx.fillStyle = "#202a27";
    ctx.font = '500 42px "Songti SC", "STSong", "SimSun", serif';
    ctx.fillText("同源共响", 158, 112);
    ctx.fillStyle = "#68706a";
    ctx.font = '400 18px "PingFang SC", "Microsoft YaHei", sans-serif';
    ctx.fillText("两岸同源词汇 · 声音叙事", 160, 148);
    ctx.textAlign = "right";
    ctx.fillStyle = "#8b8e84";
    ctx.font = '400 14px "SFMono-Regular", "Cascadia Code", monospace';
    ctx.fillText("SHARED ORIGIN / SHARED VOICE", W - 92, 116);

    // 顶部双声波小图：两条声波向中间汇聚
    (function drawTwinWaves() {
      const cx = W - 150;
      const cy = 156;
      [["#2e6a62", 1], ["#a63d31", -1]].forEach(function (cfg, idx) {
        ctx.save();
        ctx.strokeStyle = cfg[0];
        ctx.globalAlpha = 0.75;
        ctx.lineWidth = 1.6;
        ctx.beginPath();
        for (let x = 0; x <= 100; x += 2) {
          const amp = (1 - x / 100) * 9 + 1;
          const y = cy + (idx ? -1 : 1) * 5 + Math.sin((x / 100) * Math.PI * 5) * amp * cfg[1] * 0.6;
          const px = cx - 110 + x;
          if (x === 0) ctx.moveTo(px, y); else ctx.lineTo(px, y);
        }
        ctx.stroke();
        ctx.restore();
      });
      ctx.save();
      ctx.fillStyle = "#b58749";
      ctx.beginPath();
      ctx.arc(cx, cy, 3, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    })();

    ctx.strokeStyle = "rgba(32, 42, 39, 0.16)";
    ctx.beginPath();
    ctx.moveTo(88, 204);
    ctx.lineTo(W - 88, 204);
    ctx.stroke();

    // 词对
    ctx.textAlign = "center";
    ctx.fillStyle = "#68706a";
    ctx.font = '400 15px "PingFang SC", "Microsoft YaHei", sans-serif';
    ctx.fillText("大陆 · 普通话", 246, 286);
    ctx.fillText("台湾 · 国语", 834, 286);

    ctx.fillStyle = "#2e6a62";
    ctx.font = '500 98px "Songti SC", "STSong", "SimSun", serif';
    ctx.fillText(pair.mainland.display, 246, 408);
    ctx.fillStyle = "#a63d31";
    ctx.fillText(pair.taiwan.display, 834, 408);

    ctx.fillStyle = "#68706a";
    ctx.font = '400 19px "SFMono-Regular", "Cascadia Code", monospace';
    ctx.fillText(pair.mainland.pinyin, 246, 472);
    ctx.fillText(pair.taiwan.pinyin, 834, 472);

    // 共同源头
    ctx.fillStyle = "#8b8e84";
    ctx.font = '400 14px "PingFang SC", "Microsoft YaHei", sans-serif';
    ctx.fillText("共同源头", 540, 276);
    ctx.save();
    ctx.translate(540, 390);
    ctx.strokeStyle = "rgba(181, 135, 73, 0.35)";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.arc(0, 0, 94, 0, Math.PI * 2);
    ctx.stroke();
    ctx.setLineDash([4, 8]);
    ctx.beginPath();
    ctx.arc(0, 0, 82, 0, Math.PI * 2);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.fillStyle = "#a63d31";
    ctx.beginPath();
    ctx.arc(0, 0, 66, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#fbf7ee";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.font = '500 58px "Songti SC", "STSong", "SimSun", serif';
    ctx.fillText(pair.sourceChar, 0, 2);
    ctx.restore();

    ctx.strokeStyle = "rgba(181, 135, 73, 0.34)";
    ctx.setLineDash([4, 7]);
    ctx.beginPath();
    ctx.moveTo(354, 390);
    ctx.lineTo(452, 390);
    ctx.moveTo(628, 390);
    ctx.lineTo(726, 390);
    ctx.stroke();
    ctx.setLineDash([]);

    // 类型标签
    ctx.font = '500 18px "PingFang SC", "Microsoft YaHei", sans-serif';
    const badgeWidth = ctx.measureText(pair.type).width + 40;
    roundRect(ctx, 540 - badgeWidth / 2, 510, badgeWidth, 36, 18);
    ctx.fillStyle = "rgba(255, 252, 244, 0.5)";
    ctx.fill();
    ctx.strokeStyle = pair.typeKey === "sound" ? "rgba(181, 135, 73, 0.45)" : pair.typeKey === "meaning" ? "rgba(166, 61, 49, 0.35)" : "rgba(46, 106, 98, 0.3)";
    ctx.stroke();
    ctx.fillStyle = pair.typeKey === "sound" ? "#b58749" : pair.typeKey === "meaning" ? "#a63d31" : "#2e6a62";
    ctx.textAlign = "center";
    ctx.fillText(pair.type, 540, 529);

    ctx.strokeStyle = "rgba(32, 42, 39, 0.14)";
    ctx.beginPath();
    ctx.moveTo(88, 590);
    ctx.lineTo(W - 88, 590);
    ctx.stroke();

    // 引语
    const quote = "“" + String(voice.quote).replace(/^[“”]+|[“”]+$/g, "") + "”";
    ctx.textAlign = "left";
    ctx.fillStyle = "rgba(166, 61, 49, 0.13)";
    ctx.font = '600 128px "Songti SC", "STSong", "SimSun", serif';
    ctx.fillText("“", 94, 720);
    ctx.fillStyle = "#3c4843";
    ctx.font = '400 30px "Songti SC", "STSong", "SimSun", serif';
    ctx.textBaseline = "top";
    const lines = wrapCanvasText(ctx, quote, 820, 4);
    lines.forEach(function (line, index) {
      ctx.fillText(line, 146, 656 + index * 50);
    });
    const quoteBottom = 656 + lines.length * 50;
    ctx.fillStyle = "#68706a";
    ctx.font = '400 18px "PingFang SC", "Microsoft YaHei", sans-serif';
    ctx.fillText("— " + SIDE_LABEL[side] + " · " + voice.tag + " · " + voice.place, 146, quoteBottom + 18);

    // 一句词源
    ctx.textAlign = "center";
    ctx.textBaseline = "top";
    ctx.fillStyle = "#68706a";
    ctx.font = '400 19px "Songti SC", "STSong", "SimSun", serif';
    const noteLines = wrapCanvasText(ctx, pair.sourceNote, 780, 3);
    noteLines.forEach(function (line, index) {
      ctx.fillText(line, 540, 862 + index * 31);
    });

    // 同源说明
    ctx.textBaseline = "middle";
    ctx.fillStyle = "#b58749";
    ctx.font = '400 16px "PingFang SC", "Microsoft YaHei", sans-serif';
    ctx.fillText(pair.shared, 540, 1002);
    ctx.fillStyle = "#202a27";
    ctx.font = '500 30px "Songti SC", "STSong", "SimSun", serif';
    drawSpaced(ctx, "同根 · 分流 · 汇流", 540, 1060, 7, "center");
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillStyle = "#68706a";
    ctx.font = '400 17px "Songti SC", "STSong", "SimSun", serif';
    ctx.fillText("一个词，两种口音，一条共同的来路", 540, 1110);
    ctx.fillStyle = "#b58749";
    ctx.font = '400 14px "SFMono-Regular", "Cascadia Code", monospace';
    ctx.fillText("同源共响 · #" + pair.id, 540, 1150);

    // 演示角标
    ctx.save();
    ctx.translate(92, 1216);
    ctx.fillStyle = "rgba(166, 61, 49, 0.9)";
    roundRect(ctx, 0, 0, 196, 30, 6);
    ctx.fill();
    ctx.fillStyle = "#fbf7ee";
    ctx.font = '400 14px "PingFang SC", "Microsoft YaHei", sans-serif';
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText("演示文本 · 非田野采集", 98, 16);
    ctx.restore();

    // 底部
    ctx.strokeStyle = "rgba(32, 42, 39, 0.14)";
    ctx.beginPath();
    ctx.moveTo(88, 1262);
    ctx.lineTo(W - 88, 1262);
    ctx.stroke();
    ctx.textAlign = "left";
    ctx.fillStyle = "#8b8e84";
    ctx.font = '400 14px "SFMono-Regular", "Cascadia Code", monospace';
    ctx.fillText("同源共响 · 互动 H5", 90, 1312);
    const displayHost = /^(localhost|127\.0\.0\.1)(:\d+)?$/.test(location.host) ? "SHARED ORIGIN" : (location.host || "SHARED ORIGIN");
    ctx.fillText(displayHost, 90, 1340);

    // 二维码：扫码直达该词深链
    drawQRCode(ctx, pairUrl(), 892, 1268, 84);
    ctx.textAlign = "center";
    ctx.fillStyle = "#8b8e84";
    ctx.font = '400 11px "PingFang SC", "Microsoft YaHei", sans-serif';
    ctx.fillText("扫码直达这一词", 934, 1370);

    // 印章
    ctx.save();
    ctx.translate(906, 1140);
    ctx.rotate(-0.08);
    ctx.strokeStyle = "#a63d31";
    ctx.lineWidth = 3;
    ctx.strokeRect(-52, -52, 104, 104);
    ctx.strokeRect(-44, -44, 88, 88);
    ctx.fillStyle = "#a63d31";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.font = '500 30px "Songti SC", "STSong", "SimSun", serif';
    ctx.fillText("同", 0, -22);
    ctx.fillText("源", 0, 22);
    ctx.restore();
  }

  function openShare() {
    stopAudio();
    stopCarousel(true);
    // 生成同源卡是收束动作，同样补齐到共鸣阶段（不会重复触发音效/动画）。
    if (state.started && !state.merged) {
      clearTimers();
      state.pendingMerge = false;
      traceStage();
      mergeStage();
    }
    openModal("shareModal");
    state.lastFocus = el.shareBtn;
    requestAnimationFrame(function () {
      drawPoster();
    });
    if (document.fonts && document.fonts.ready) {
      document.fonts.ready.then(function () {
        if (state.activeModal === "shareModal") drawPoster();
      });
    }
    el.shareBtn.classList.remove("is-nudge");
  }

  function downloadBlob(blob, filename) {
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = filename;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    setTimeout(function () { URL.revokeObjectURL(url); }, 1500);
  }

  function posterFileName() {
    return "同源共响-" + currentPair().id + ".png";
  }

  function downloadPoster() {
    if (!el.poster) return;
    el.poster.toBlob(function (blob) {
      if (!blob) {
        showToast("图片生成失败，请重试。");
        return;
      }
      downloadBlob(blob, posterFileName());
      showToast("同源卡已保存到你的设备。");
    }, "image/png");
  }

  function pairUrl() {
    const base = location.href.split("#")[0];
    return base + "#" + currentPair().id;
  }

  function copyText(text) {
    if (navigator.clipboard && window.isSecureContext) {
      return navigator.clipboard.writeText(text);
    }
    return new Promise(function (resolve, reject) {
      const textarea = document.createElement("textarea");
      textarea.value = text;
      textarea.setAttribute("readonly", "");
      textarea.style.position = "fixed";
      textarea.style.opacity = "0";
      document.body.appendChild(textarea);
      textarea.select();
      try {
        document.execCommand("copy");
        resolve();
      } catch (error) {
        reject(error);
      } finally {
        textarea.remove();
      }
    });
  }

  function copyLink() {
    copyText(pairUrl()).then(function () {
      showToast("链接已复制。");
    }).catch(function () {
      showToast("复制失败，请手动复制地址栏链接。");
    });
  }

  function shareNative() {
    if (!el.poster) return;
    const text = "一个词，两种口音，一条共同的来路。";
    const shareData = {
      title: "同源共响 · " + currentPair().mainland.display + " / " + currentPair().taiwan.display,
      text: text,
      url: pairUrl(),
    };
    if (!navigator.share) {
      showToast("当前浏览器不支持系统分享，请保存图片。");
      return;
    }
    el.poster.toBlob(function (blob) {
      const file = blob && typeof File !== "undefined" ? new File([blob], posterFileName(), { type: "image/png" }) : null;
      if (file && navigator.canShare && navigator.canShare({ files: [file] })) {
        navigator.share({ files: [file], title: shareData.title, text: text }).catch(function () {});
      } else {
        navigator.share(shareData).catch(function () {});
      }
    }, "image/png");
  }

  /* ---------------------------------------------------------
     提示与事件
     --------------------------------------------------------- */
  function showToast(message) {
    if (!toastEl) return;
    clearTimeout(state.toastTimer);
    toastEl.textContent = message;
    toastEl.classList.add("is-visible");
    state.toastTimer = setTimeout(function () {
      toastEl.classList.remove("is-visible");
    }, 2800);
  }

  function stopMockRecord(done) {
    if (!state.mockRecording) return;
    state.mockRecording = false;
    clearInterval(state.mockRecordTimer);
    state.mockRecordTimer = null;
    if (el.mockRecord) el.mockRecord.classList.remove("is-recording");
    if (el.mockRecordStart) el.mockRecordStart.disabled = false;
    if (el.mockRecordStop) el.mockRecordStop.disabled = true;
    if (el.mockRecordTip) {
      el.mockRecordTip.textContent = done
        ? "模拟录制结束（仅演示，未调用麦克风、未保存任何音频）。正式版将在此录制并上传。"
        : "这是流程演示，不会调用麦克风、不上传任何内容；正式版将在此录制你的声音。";
    }
  }

  function startMockRecord() {
    if (state.mockRecording) return;
    state.mockRecording = true;
    state.mockRecordStart = performance.now();
    if (el.mockRecord) el.mockRecord.classList.add("is-recording");
    if (el.mockRecordStart) el.mockRecordStart.disabled = true;
    if (el.mockRecordStop) el.mockRecordStop.disabled = false;
    if (el.mockRecordTip) el.mockRecordTip.textContent = "正在模拟录制……假波形与计时仅为流程演示，不收集任何信息。";
    state.mockRecordTimer = setInterval(function () {
      const sec = Math.floor((performance.now() - state.mockRecordStart) / 1000);
      if (el.mockRecordTime) {
        el.mockRecordTime.textContent = String(Math.floor(sec / 60)).padStart(2, "0") + ":" + String(sec % 60).padStart(2, "0");
      }
    }, 250);
  }

  function tapCard(card) {
    // 弹性反馈 + 轻响，只绑在词卡点击上，避免轮播/dock 误触发。
    playClick();
    if (reducedMotion || !card) return;
    card.classList.remove("is-tapped");
    void card.offsetWidth;
    card.classList.add("is-tapped");
    setTimeout(function () { card.classList.remove("is-tapped"); }, 180);
  }

  function bindEvents() {
    el.startBtn.addEventListener("click", startExperience);
    el.brandHome.addEventListener("click", goHome);
    el.aboutBtn.addEventListener("click", function () {
      stopAudio();
      stopCarousel(true);
      openModal("aboutModal");
    });
    el.introDetailBtn.addEventListener("click", openDetail);
    el.soundToggle.addEventListener("click", function () {
      setMuted(!state.muted);
    });
    el.prevPair.addEventListener("click", function () {
      applyPair(state.pairIndex - 1);
    });
    el.nextPair.addEventListener("click", function () {
      applyPair(state.pairIndex + 1);
    });
    el.cardMainland.addEventListener("click", function () {
      tapCard(el.cardMainland);
      playSide("mainland");
    });
    el.cardTaiwan.addEventListener("click", function () {
      tapCard(el.cardTaiwan);
      playSide("taiwan");
    });
    $$(".voice-cycle").forEach(function (button) {
      button.addEventListener("click", function (event) {
        event.stopPropagation();
        cycleVoice(button.dataset.voiceSide);
      });
    });
    $$("[data-detail-side]").forEach(function (button) {
      button.addEventListener("click", function (event) {
        event.stopPropagation();
        openDetail();
      });
    });
    $$("[data-tone-side]").forEach(function (button) {
      button.addEventListener("click", function (event) {
        event.stopPropagation();
        playToneGuide(button.dataset.toneSide);
      });
    });
    if (el.dockTone) {
      el.dockTone.addEventListener("click", function () {
        playToneGuide(state.activeSide || "mainland");
      });
    }
    if (el.audioNoteClose) {
      el.audioNoteClose.addEventListener("click", function () {
        state.noteDismissed = true;
        if (el.audioNote) el.audioNote.hidden = true;
        try {
          localStorage.setItem("same-origin-audio-note", "dismissed");
        } catch (error) {}
      });
    }
    el.listenOtherBtn.addEventListener("click", listenOther);
    el.detailBtn.addEventListener("click", openDetail);
    el.carouselBtn.addEventListener("click", toggleCarousel);
    el.shareBtn.addEventListener("click", openShare);
    el.detailShare.addEventListener("click", function () {
      closeAllModals(true);
      openShare();
    });
    el.buildBtn.addEventListener("click", function () {
      closeAllModals(true);
      openModal("buildModal");
    });
    if (el.mockRecordStart) el.mockRecordStart.addEventListener("click", startMockRecord);
    if (el.mockRecordStop) el.mockRecordStop.addEventListener("click", function () { stopMockRecord(true); });
    el.buildNotify.addEventListener("click", function () {
      try {
        localStorage.setItem("same-origin-build-intent", new Date().toISOString());
      } catch (error) {}
      showToast("已记下你的共建意向。演示版不收集个人信息。");
      closeModal("buildModal");
    });
    el.dockSwitch.addEventListener("click", function () {
      cycleVoice(state.activeSide || "mainland");
    });
    el.dockOther.addEventListener("click", listenOther);
    el.dockDetail.addEventListener("click", openDetail);
    el.downloadPoster.addEventListener("click", downloadPoster);
    el.shareNative.addEventListener("click", shareNative);
    el.copyLink.addEventListener("click", copyLink);

    el.pairList.addEventListener("click", function (event) {
      const chip = event.target.closest(".pair-chip");
      if (!chip) return;
      const index = Number(chip.dataset.index);
      if (Number.isNaN(index) || index === state.pairIndex) return;
      applyPair(index);
    });
    el.pairList.addEventListener("keydown", function (event) {
      if (event.key !== "ArrowRight" && event.key !== "ArrowLeft") return;
      event.preventDefault();
      const delta = event.key === "ArrowRight" ? 1 : -1;
      const next = (state.pairIndex + delta + DATA.pairs.length) % DATA.pairs.length;
      applyPair(next);
      const chip = $('.pair-chip[data-index="' + next + '"]', el.pairList);
      if (chip) chip.focus();
    });

    document.addEventListener("click", function (event) {
      const close = event.target.closest("[data-close]");
      if (close) closeModal(close.dataset.close);
    });
    document.addEventListener("keydown", function (event) {
      if (event.key === "Escape" && state.activeModal) {
        closeModal(state.activeModal);
        return;
      }
      trapFocus(event);
    });
    document.addEventListener("visibilitychange", function () {
      if (document.hidden) {
        stopAudio();
        stopCarousel(true);
      }
    });
    window.addEventListener("hashchange", function () {
      const id = location.hash.replace("#", "");
      const index = DATA.pairs.findIndex(function (pair) { return pair.id === id; });
      if (index >= 0 && index !== state.pairIndex) {
        applyPair(index, { silentHash: true });
        if (!state.started) {
          showToast("已载入「" + DATA.pairs[index].mainland.display + " / " + DATA.pairs[index].taiwan.display + "」");
        }
      }
    });
    if (window.speechSynthesis) {
      window.speechSynthesis.onvoiceschanged = function () {
        try {
          state.voices = window.speechSynthesis.getVoices();
        } catch (error) {}
        updateVoiceStatus();
      };
    }
  }

  /* ---------------------------------------------------------
     背景粒子
     --------------------------------------------------------- */
  function initAmbient() {
    const canvas = document.getElementById("ambient");
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const colors = ["rgba(46,106,98,", "rgba(166,61,49,", "rgba(181,135,73,"];
    state.ambientParticles = Array.from({ length: 38 }, function (_, index) {
      return {
        x: Math.random(),
        y: Math.random(),
        radius: 0.6 + Math.random() * 1.7,
        speed: 0.004 + Math.random() * 0.012,
        phase: Math.random() * Math.PI * 2,
        color: colors[index % colors.length],
        alpha: 0.16 + Math.random() * 0.24,
      };
    });
    function resize() {
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      state.ambientSize.w = window.innerWidth;
      state.ambientSize.h = window.innerHeight;
      canvas.width = Math.floor(window.innerWidth * dpr);
      canvas.height = Math.floor(window.innerHeight * dpr);
      canvas.style.width = window.innerWidth + "px";
      canvas.style.height = window.innerHeight + "px";
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    }
    function draw(time) {
      const w = state.ambientSize.w;
      const h = state.ambientSize.h;
      ctx.clearRect(0, 0, w, h);
      state.ambientParticles.forEach(function (particle, index) {
        const drift = (time * particle.speed + particle.phase) % (Math.PI * 2);
        const x = ((particle.x + Math.sin(drift) * 0.035) % 1) * w;
        const y = ((particle.y - (time * particle.speed * 0.018) + 1) % 1) * h;
        ctx.beginPath();
        ctx.fillStyle = particle.color + particle.alpha + ")";
        ctx.arc(x, y, particle.radius, 0, Math.PI * 2);
        ctx.fill();
        if (index % 7 === 0) {
          ctx.beginPath();
          ctx.strokeStyle = particle.color + "0.05)";
          ctx.arc(x, y, particle.radius * 7, 0, Math.PI * 2);
          ctx.stroke();
        }
      });
      if (!reducedMotion) state.ambientFrame = requestAnimationFrame(draw);
    }
    resize();
    window.addEventListener("resize", resize);
    if (reducedMotion) {
      draw(0);
    } else {
      state.ambientFrame = requestAnimationFrame(draw);
    }
  }

  /* ---------------------------------------------------------
     初始化
     --------------------------------------------------------- */
  function init() {
    cacheElements();
    try {
      state.noteDismissed = localStorage.getItem("same-origin-audio-note") === "dismissed";
    } catch (error) {}
    if (state.noteDismissed && el.audioNote) el.audioNote.hidden = true;
    renderPairList();
    const hash = location.hash.replace("#", "");
    const initialIndex = DATA.pairs.findIndex(function (pair) { return pair.id === hash; });
    state.pendingHash = initialIndex >= 0;
    state.pairIndex = initialIndex >= 0 ? initialIndex : 0;
    applyPair(state.pairIndex, { silentHash: initialIndex < 0, keepLive: true });
    bindEvents();
    initAmbient();
    updateVoiceStatus();
    setTimeout(updateVoiceStatus, 700);
    setTimeout(updateVoiceStatus, 1900);
    document.title = DATA.title + " · " + DATA.subtitle;
    if (initialIndex >= 0) {
      el.startBtn.querySelector("span").textContent = "继续聆听";
    }

    const params = new URLSearchParams(location.search);
    if (params.get("start") === "1") {
      startExperience();
    }
    if (params.get("preview") === "detail") {
      setTimeout(openDetail, 500);
    }
    if (params.get("preview") === "merged") {
      startExperience();
      setTimeout(function () {
        playSide("mainland", { silent: true });
        setTimeout(function () {
          playSide("taiwan", { silent: true });
          setTimeout(mergeStage, 250);
        }, 300);
      }, 650);
    }
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
