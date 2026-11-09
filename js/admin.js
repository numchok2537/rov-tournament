(function () {
  var gate = document.getElementById("gate");
  var dashboard = document.getElementById("dashboard");
  var passcodeInput = document.getElementById("f-passcode");
  var loginBtn = document.getElementById("btn-login");
  var loginStatus = document.getElementById("login-status");

  var setupCard = document.getElementById("setup-card");
  var teamsInput = document.getElementById("f-teams");
  var setupBtn = document.getElementById("btn-setup");
  var setupStatus = document.getElementById("setup-status");

  var resultsCard = document.getElementById("results-card");
  var matchesBody = document.getElementById("matches-admin-body");
  var finalSection = document.getElementById("final-admin-section");
  var finalBody = document.getElementById("final-admin-body");
  var championBanner = document.getElementById("champion-banner-admin");
  var championName = document.getElementById("champion-name-admin");

  var resetBtn = document.getElementById("btn-reset");
  var resetStatus = document.getElementById("reset-status");

  var PASSCODE_KEY = "rovTournament.adminPasscode";
  var passcode = "";
  var latestState = null;

  function escapeHtml(str) {
    return String(str)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;");
  }

  function apiPost(body) {
    return fetch(CONFIG.API_URL, {
      method: "POST",
      body: JSON.stringify(body),
    }).then(function (res) {
      return res.json();
    });
  }

  function tryLogin(pc) {
    loginStatus.textContent = "กำลังตรวจสอบ...";
    loginStatus.className = "status-msg";
    apiPost({ action: "adminCheckPasscode", passcode: pc })
      .then(function (res) {
        if (res && res.ok) {
          passcode = pc;
          sessionStorage.setItem(PASSCODE_KEY, pc);
          gate.hidden = true;
          dashboard.hidden = false;
          refresh();
        } else {
          loginStatus.textContent = "รหัสผ่านไม่ถูกต้อง";
          loginStatus.className = "status-msg error";
        }
      })
      .catch(function (err) {
        loginStatus.textContent = "เชื่อมต่อไม่สำเร็จ: " + err.message;
        loginStatus.className = "status-msg error";
      });
  }

  loginBtn.addEventListener("click", function () {
    var pc = passcodeInput.value.trim();
    if (!pc) return;
    tryLogin(pc);
  });

  passcodeInput.addEventListener("keydown", function (e) {
    if (e.key === "Enter") loginBtn.click();
  });

  setupBtn.addEventListener("click", function () {
    var teams = teamsInput.value
      .split("\n")
      .map(function (t) {
        return t.trim();
      })
      .filter(function (t) {
        return t.length > 0;
      });
    if (teams.length < 2) {
      setupStatus.textContent = "ต้องมีอย่างน้อย 2 ทีม";
      setupStatus.className = "status-msg error";
      return;
    }
    setupBtn.disabled = true;
    setupStatus.textContent = "กำลังสุ่มตาราง...";
    setupStatus.className = "status-msg";
    apiPost({ action: "setupTeams", teams: teams, passcode: passcode })
      .then(function (res) {
        setupBtn.disabled = false;
        if (res && res.ok) {
          setupStatus.textContent = "สุ่มตารางสำเร็จ (" + teams.length + " ทีม)";
          setupStatus.className = "status-msg success";
          refresh();
        } else {
          setupStatus.textContent = "ผิดพลาด: " + (res && res.error ? res.error : "unknown");
          setupStatus.className = "status-msg error";
        }
      })
      .catch(function (err) {
        setupBtn.disabled = false;
        setupStatus.textContent = "ผิดพลาด: " + err.message;
        setupStatus.className = "status-msg error";
      });
  });

  function renderMatchRow(m) {
    var scoreCell = m.played
      ? m.scoreA + " - " + m.scoreB
      : '<input type="text" class="score-input" placeholder="0" /> - <input type="text" class="score-input" placeholder="0" />';
    var mvpCell = m.played
      ? escapeHtml(m.mvp || "-")
      : '<input type="text" class="mvp-input" placeholder="ชื่อผู้เล่น" />';
    var btnCell = m.played ? '<span class="pill">บันทึกแล้ว</span>' : '<button class="btn small btn-save">บันทึกผล</button>';
    return (
      '<tr data-id="' +
      escapeHtml(m.id) +
      '"><td>' +
      escapeHtml(m.teamA) +
      " vs " +
      escapeHtml(m.teamB) +
      "</td><td>" +
      scoreCell +
      "</td><td>" +
      mvpCell +
      "</td><td>" +
      btnCell +
      "</td></tr>"
    );
  }

  function renderDashboard(state) {
    if (!state.teams || !state.teams.length) {
      setupCard.hidden = false;
      resultsCard.hidden = true;
      return;
    }

    setupCard.hidden = true;
    resultsCard.hidden = false;

    if (state.champion) {
      championBanner.hidden = false;
      championName.textContent = state.champion;
    } else {
      championBanner.hidden = true;
    }

    matchesBody.innerHTML = state.matches.map(renderMatchRow).join("");

    if (state.final) {
      finalSection.hidden = false;
      finalBody.innerHTML = renderMatchRow(state.final);
    } else {
      finalSection.hidden = true;
    }
  }

  function attachSaveHandlers() {
    document.querySelectorAll(".btn-save").forEach(function (btn) {
      btn.addEventListener("click", function () {
        var row = btn.closest("tr");
        var id = row.dataset.id;
        var inputs = row.querySelectorAll(".score-input");
        var scoreA = inputs[0].value.trim();
        var scoreB = inputs[1].value.trim();
        var mvpInput = row.querySelector(".mvp-input");
        var mvp = mvpInput ? mvpInput.value.trim() : "";
        if (scoreA === "" || scoreB === "" || scoreA === scoreB) {
          alert("กรอกสกอร์ให้ครบและห้ามเสมอกัน");
          return;
        }
        btn.disabled = true;
        btn.textContent = "...";
        apiPost({ action: "recordResult", matchId: id, scoreA: scoreA, scoreB: scoreB, mvp: mvp, passcode: passcode })
          .then(function (res) {
            if (res && res.ok) {
              refresh();
            } else {
              alert("ผิดพลาด: " + (res && res.error ? res.error : "unknown"));
              btn.disabled = false;
              btn.textContent = "บันทึกผล";
            }
          })
          .catch(function (err) {
            alert("ผิดพลาด: " + err.message);
            btn.disabled = false;
            btn.textContent = "บันทึกผล";
          });
      });
    });
  }

  resetBtn.addEventListener("click", function () {
    if (!confirm("ยืนยันล้างทีมทั้งหมดและเริ่มทัวร์นาเมนต์ใหม่?")) return;
    apiPost({ action: "resetTournament", passcode: passcode })
      .then(function (res) {
        if (res && res.ok) {
          resetStatus.textContent = "ล้างข้อมูลสำเร็จ";
          resetStatus.className = "status-msg success";
          teamsInput.value = "";
          refresh();
        } else {
          resetStatus.textContent = "ผิดพลาด: " + (res && res.error ? res.error : "unknown");
          resetStatus.className = "status-msg error";
        }
      })
      .catch(function (err) {
        resetStatus.textContent = "ผิดพลาด: " + err.message;
        resetStatus.className = "status-msg error";
      });
  });

  function refresh() {
    fetch(CONFIG.API_URL, { cache: "no-store" })
      .then(function (res) {
        return res.json();
      })
      .then(function (state) {
        latestState = state;
        renderDashboard(state);
        attachSaveHandlers();
      })
      .catch(function () {});
  }

  var savedPasscode = sessionStorage.getItem(PASSCODE_KEY);
  if (savedPasscode) {
    tryLogin(savedPasscode);
  }
})();
