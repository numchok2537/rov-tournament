var STATE_PROP = "TOURNAMENT_STATE";
var ADMIN_PASSCODE_PROP = "ADMIN_PASSCODE";
var DEFAULT_PASSCODE = "1234";
var WIN_POINTS = 3;
var LOSS_POINTS = 0;

function getAdminPasscode_() {
  return PropertiesService.getScriptProperties().getProperty(ADMIN_PASSCODE_PROP) || DEFAULT_PASSCODE;
}

function jsonOut_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}

function newId_(prefix) {
  return prefix + "-" + Utilities.getUuid().slice(0, 8);
}

function withLock_(fn) {
  var lock = LockService.getScriptLock();
  lock.waitLock(15000);
  try {
    return fn();
  } finally {
    lock.releaseLock();
  }
}

function defaultState_() {
  return { teams: [], matches: [], final: null, champion: null, status: "setup" };
}

function getState_() {
  var raw = PropertiesService.getScriptProperties().getProperty(STATE_PROP);
  if (!raw) return defaultState_();
  try {
    return JSON.parse(raw);
  } catch (e) {
    return defaultState_();
  }
}

function saveState_(state) {
  PropertiesService.getScriptProperties().setProperty(STATE_PROP, JSON.stringify(state));
}

function shuffle_(arr) {
  for (var i = arr.length - 1; i > 0; i--) {
    var j = Math.floor(Math.random() * (i + 1));
    var tmp = arr[i];
    arr[i] = arr[j];
    arr[j] = tmp;
  }
  return arr;
}

function buildRoundRobinMatches_(teams) {
  var pairs = [];
  for (var i = 0; i < teams.length; i++) {
    for (var j = i + 1; j < teams.length; j++) {
      pairs.push([teams[i], teams[j]]);
    }
  }
  shuffle_(pairs);
  return pairs.map(function (p) {
    return {
      id: newId_("m"),
      teamA: p[0],
      teamB: p[1],
      scoreA: null,
      scoreB: null,
      played: false,
      stage: "group",
    };
  });
}

function computeStandings_(teams, matches) {
  var table = {};
  teams.forEach(function (t) {
    table[t] = { team: t, played: 0, wins: 0, losses: 0, points: 0, setsWon: 0, setsLost: 0 };
  });
  matches.forEach(function (m) {
    if (!m.played) return;
    var a = table[m.teamA];
    var b = table[m.teamB];
    if (!a || !b) return;
    a.played++;
    b.played++;
    a.setsWon += m.scoreA;
    a.setsLost += m.scoreB;
    b.setsWon += m.scoreB;
    b.setsLost += m.scoreA;
    if (m.scoreA > m.scoreB) {
      a.wins++;
      a.points += WIN_POINTS;
      b.losses++;
      b.points += LOSS_POINTS;
    } else {
      b.wins++;
      b.points += WIN_POINTS;
      a.losses++;
      a.points += LOSS_POINTS;
    }
  });
  var rows = teams.map(function (t) {
    return table[t];
  });
  rows.sort(function (x, y) {
    if (y.points !== x.points) return y.points - x.points;
    var diffX = x.setsWon - x.setsLost;
    var diffY = y.setsWon - y.setsLost;
    if (diffY !== diffX) return diffY - diffX;
    return y.setsWon - x.setsWon;
  });
  return rows;
}

function doPost(e) {
  var data = JSON.parse(e.postData.contents);
  var action = data.action;

  if (action === "adminCheckPasscode") {
    return jsonOut_({ ok: data.passcode === getAdminPasscode_() });
  }
  if (action === "setupTeams") {
    return withLock_(function () {
      return handleSetupTeams_(data);
    });
  }
  if (action === "recordResult") {
    return withLock_(function () {
      return handleRecordResult_(data);
    });
  }
  if (action === "resetTournament") {
    return withLock_(function () {
      if (data.passcode !== getAdminPasscode_()) return jsonOut_({ error: "wrong passcode" });
      saveState_(defaultState_());
      return jsonOut_({ ok: true });
    });
  }

  return jsonOut_({ error: "unknown action" });
}

function handleSetupTeams_(data) {
  if (data.passcode !== getAdminPasscode_()) return jsonOut_({ error: "wrong passcode" });
  var teams = (data.teams || []).map(function (t) {
    return String(t).trim();
  }).filter(function (t) {
    return t.length > 0;
  });
  if (teams.length < 2) return jsonOut_({ error: "need at least 2 teams" });

  var state = defaultState_();
  state.teams = teams;
  state.matches = buildRoundRobinMatches_(teams);
  state.status = "group";
  saveState_(state);
  return jsonOut_({ ok: true, state: state });
}

function handleRecordResult_(data) {
  if (data.passcode !== getAdminPasscode_()) return jsonOut_({ error: "wrong passcode" });
  var state = getState_();
  var scoreA = Number(data.scoreA);
  var scoreB = Number(data.scoreB);
  if (isNaN(scoreA) || isNaN(scoreB) || scoreA === scoreB) {
    return jsonOut_({ error: "invalid score" });
  }

  var match = null;
  if (state.final && state.final.id === data.matchId) {
    match = state.final;
  } else {
    match = state.matches.filter(function (m) {
      return m.id === data.matchId;
    })[0];
  }
  if (!match) return jsonOut_({ error: "match not found" });

  match.scoreA = scoreA;
  match.scoreB = scoreB;
  match.played = true;

  if (match.stage === "final") {
    state.champion = scoreA > scoreB ? match.teamA : match.teamB;
    state.status = "done";
  } else {
    var allGroupPlayed = state.matches.every(function (m) {
      return m.played;
    });
    if (allGroupPlayed && !state.final) {
      var standings = computeStandings_(state.teams, state.matches);
      state.final = {
        id: newId_("final"),
        teamA: standings[0].team,
        teamB: standings[1].team,
        scoreA: null,
        scoreB: null,
        played: false,
        stage: "final",
      };
      state.status = "final";
    }
  }

  saveState_(state);
  return jsonOut_({ ok: true });
}

function doGet(e) {
  var state = getState_();
  var standings = computeStandings_(state.teams, state.matches);
  return jsonOut_({
    teams: state.teams,
    matches: state.matches,
    final: state.final,
    champion: state.champion,
    status: state.status,
    standings: standings,
  });
}
