(function () {
  var placeholder = document.getElementById("placeholder");
  var content = document.getElementById("content");
  var championSection = document.getElementById("champion-section");
  var championName = document.getElementById("champion-name");
  var nextMatchSection = document.getElementById("next-match-section");
  var nextMatchHeading = document.getElementById("next-match-heading");
  var nextTeamA = document.getElementById("next-team-a");
  var nextTeamB = document.getElementById("next-team-b");
  var standingsBody = document.getElementById("standings-body");
  var matchesBody = document.getElementById("matches-body");
  var finalSection = document.getElementById("final-section");
  var finalBody = document.getElementById("final-body");
  var mvpSection = document.getElementById("mvp-section");
  var mvpBody = document.getElementById("mvp-body");

  function escapeHtml(str) {
    return String(str)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;");
  }

  function render(data) {
    if (!data.teams || !data.teams.length) {
      placeholder.hidden = false;
      placeholder.textContent = "ยังไม่มีทัวร์นาเมนต์ กรุณารอแอดมินตั้งค่าทีม";
      content.hidden = true;
      return;
    }

    placeholder.hidden = true;
    content.hidden = false;

    // champion
    if (data.champion) {
      championSection.hidden = false;
      championName.textContent = data.champion;
    } else {
      championSection.hidden = true;
    }

    // next match
    var nextMatch = null;
    if (!data.champion) {
      if (data.final && !data.final.played) {
        nextMatch = data.final;
        nextMatchHeading.textContent = "🔥 รอบชิงชนะเลิศ";
      } else if (!data.final) {
        nextMatch = data.matches.filter(function (m) {
          return !m.played;
        })[0];
        nextMatchHeading.textContent = "คู่ถัดไป";
      }
    }
    if (nextMatch) {
      nextMatchSection.hidden = false;
      nextTeamA.textContent = nextMatch.teamA;
      nextTeamB.textContent = nextMatch.teamB;
    } else {
      nextMatchSection.hidden = true;
    }

    // standings
    standingsBody.innerHTML = (data.standings || [])
      .map(function (s) {
        var diff = s.setsWon - s.setsLost;
        return (
          "<tr><td>" +
          escapeHtml(s.team) +
          "</td><td>" +
          s.played +
          "</td><td>" +
          s.wins +
          "</td><td>" +
          s.losses +
          "</td><td>" +
          s.points +
          "</td><td>" +
          (diff > 0 ? "+" : "") +
          diff +
          "</td></tr>"
        );
      })
      .join("");

    // matches
    matchesBody.innerHTML = (data.matches || [])
      .map(function (m) {
        var result = m.played ? m.scoreA + " - " + m.scoreB : '<span class="pill">ยังไม่แข่ง</span>';
        var mvp = m.played ? (m.mvp ? "🌟 " + escapeHtml(m.mvp) : "-") : "";
        return (
          '<tr class="' +
          (m.played ? "played" : "") +
          '"><td>' +
          escapeHtml(m.teamA) +
          " vs " +
          escapeHtml(m.teamB) +
          "</td><td>" +
          result +
          "</td><td>" +
          mvp +
          "</td></tr>"
        );
      })
      .join("");

    // final
    if (data.final) {
      finalSection.hidden = false;
      var f = data.final;
      var fResult = f.played ? f.scoreA + " - " + f.scoreB : '<span class="pill">ยังไม่แข่ง</span>';
      var fMvp = f.played && f.mvp ? " | 🌟 MVP: " + escapeHtml(f.mvp) : "";
      finalBody.innerHTML =
        "<tr><td>" + escapeHtml(f.teamA) + " vs " + escapeHtml(f.teamB) + "</td><td>" + fResult + fMvp + "</td></tr>";
    } else {
      finalSection.hidden = true;
    }

    // mvp stats
    if (data.mvpStats && data.mvpStats.length) {
      mvpSection.hidden = false;
      mvpBody.innerHTML = data.mvpStats
        .map(function (row, i) {
          var medal = i === 0 ? "🥇 " : i === 1 ? "🥈 " : i === 2 ? "🥉 " : "";
          return "<tr><td>" + medal + escapeHtml(row.name) + "</td><td>" + row.count + "</td></tr>";
        })
        .join("");
    } else {
      mvpSection.hidden = true;
    }
  }

  function poll() {
    if (!CONFIG.API_URL) {
      placeholder.hidden = false;
      placeholder.textContent = "ระบบยังไม่ได้เชื่อมต่อฐานข้อมูล";
      content.hidden = true;
      return;
    }
    fetch(CONFIG.API_URL, { cache: "no-store" })
      .then(function (res) {
        return res.json();
      })
      .then(render)
      .catch(function () {
        placeholder.hidden = false;
        placeholder.textContent = "โหลดข้อมูลไม่สำเร็จ";
        content.hidden = true;
      })
      .finally(function () {
        setTimeout(poll, CONFIG.POLL_MS);
      });
  }

  poll();
})();
