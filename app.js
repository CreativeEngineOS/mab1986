const teamThemes = {
    'Majors Astros': { primary: '#eb6e1f', secondary: '#002d62' },
    'Majors Braves': { primary: '#ce1141', secondary: '#13274f' },
    'Majors Brewers': { primary: '#ffc52f', secondary: '#12284b' },
    'Majors Cardinals': { primary: '#c41e3a', secondary: '#0c2340' },
    'Majors Cubs': { primary: '#0e3386', secondary: '#cc3433' },
    'Majors Diamondbacks': { primary: '#a71930', secondary: '#e3d4ad' },
    'Majors Dodgers': { primary: '#005a9c', secondary: '#ef3e42' },
    'Majors Giants': { primary: '#fd5a1e', secondary: '#27251f' },
    'Majors Marlins': { primary: '#00a3e0', secondary: '#ef3340' },
    'Majors Mets': { primary: '#ff5910', secondary: '#002d72' },
    'Majors Nationals': { primary: '#ab0003', secondary: '#14225a' },
    'Majors Padres': { primary: '#ffc425', secondary: '#2f241d' },
    'Majors Phillies': { primary: '#e81828', secondary: '#002d72' },
    'Majors Pirates': { primary: '#fdb827', secondary: '#27251f' },
    'Majors Reds': { primary: '#c6011f', secondary: '#000000' },
    'Majors Rockies': { primary: '#33006f', secondary: '#c4ced4' },
    'Majors Blue Jays': { primary: '#134a8e', secondary: '#e8291c' },
    'Majors Orioles': { primary: '#df4601', secondary: '#000000' },
    'Majors Rays': { primary: '#092c5c', secondary: '#8fbce6' },
    'Majors Red Sox': { primary: '#bd3039', secondary: '#0c2340' },
    'Majors Yankees': { primary: '#0c2340', secondary: '#e4002c' },
    'Majors Guardians': { primary: '#e31937', secondary: '#00385d' },
    'Majors Royals': { primary: '#004687', secondary: '#bd9b60' },
    'Majors Tigers': { primary: '#0c2340', secondary: '#fa4616' },
    'Majors Twins': { primary: '#002b5c', secondary: '#d31145' },
    'Majors White Sox': { primary: '#27251f', secondary: '#c4ced4' },
    'Majors Angels': { primary: '#ba0021', secondary: '#003263' },
    'Majors Athletics': { primary: '#003831', secondary: '#efb21e' },
    'Majors Mariners': { primary: '#005c5c', secondary: '#0c2c56' },
    'Majors Rangers': { primary: '#003278', secondary: '#c0111f' }
};

const IS_WEB_TRIAL = false;
const TRIAL_GAME_LIMIT = 5;

let rawData = null;
let allGames = [];
let teamNames = [];

// State Engine
let selectedTeam = null;
let timelineGames = [];
let currentGameIndex = 0;
let teamStates = {}; // Elo, Streak, W, L, T, PF, PA, history
let globalGameCursor = 0; 
let biasChartInstance = null;
let chartDataHistory = [];
let activeTab = 'run-diff';

let isPostSeason = false;
let playoffGames = [];
let regularTimelineCache = [];
let finalSeeds = [];


// Sound synthesis
const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
function playSound(type) {
    if (audioCtx.state === 'suspended') audioCtx.resume();
    const osc = audioCtx.createOscillator();
    const gainNode = audioCtx.createGain();
    osc.connect(gainNode);
    gainNode.connect(audioCtx.destination);
    
    if (type === 'move') {
        osc.type = 'square';
        osc.frequency.setValueAtTime(440, audioCtx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(220, audioCtx.currentTime + 0.1);
        gainNode.gain.setValueAtTime(0.05, audioCtx.currentTime);
        gainNode.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.1);
        osc.start();
        osc.stop(audioCtx.currentTime + 0.1);
    } else if (type === 'select') {
        osc.type = 'square';
        osc.frequency.setValueAtTime(660, audioCtx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(880, audioCtx.currentTime + 0.15);
        gainNode.gain.setValueAtTime(0.08, audioCtx.currentTime);
        gainNode.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.15);
        osc.start();
        osc.stop(audioCtx.currentTime + 0.15);
    } else if (type === 'tab') {
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(500, audioCtx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(1000, audioCtx.currentTime + 0.1);
        gainNode.gain.setValueAtTime(0.05, audioCtx.currentTime);
        gainNode.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.1);
        osc.start();
        osc.stop(audioCtx.currentTime + 0.1);
    } else if (type === 'win' || type === 'loss' || type === 'tie') {
        const now = audioCtx.currentTime;
        let notes;
        if (type === 'win') {
            notes = [523.25, 587.33, 659.25, 783.99, 1046.50]; // Ascending C Major Pentatonic
        } else if (type === 'loss') {
            notes = [932.33, 783.99, 698.46, 622.25, 523.25]; // Descending C Minor Pentatonic
        } else {
            notes = [440, 440, 440, 440, 440]; // Tie
        }
        const times = [0, 0.15, 0.3, 0.45, 0.6];
        notes.forEach((freq, i) => {
            const o = audioCtx.createOscillator();
            const g = audioCtx.createGain();
            o.type = 'square';
            o.frequency.value = freq;
            o.connect(g);
            g.connect(audioCtx.destination);
            g.gain.setValueAtTime(0.05, now + times[i]);
            g.gain.exponentialRampToValueAtTime(0.01, now + times[i] + 0.1);
            o.start(now + times[i]);
            o.stop(now + times[i] + 0.15);
        });
        return;
    }
}

// Gamepad polling
let lastGamepadTime = 0;
let gridSelectedIndex = 0;
let menuSelectedIndex = 0;

function cycleTabs(dir) {
    const tabs = Array.from(document.querySelectorAll('.tab-btn'));
    const activeIndex = tabs.findIndex(t => t.classList.contains('active'));
    if (activeIndex >= 0) {
        let nextIndex = (activeIndex + dir + tabs.length) % tabs.length;
        tabs[nextIndex].click();
    }
}

function toggleVitalsStandings() {
    const vitalsActive = document.getElementById('vitals-modal').classList.contains('active');
    const standingsActive = document.getElementById('standings-modal').classList.contains('active');
    
    if (vitalsActive) {
        closeModals();
        document.getElementById('btn-standings').click();
    } else if (standingsActive) {
        closeModals();
    } else {
        closeModals();
        document.getElementById('btn-vitals').click();
    }
}

function pollGamepad() {
    const gamepads = navigator.getGamepads();
    if (gamepads && gamepads[0]) {
        const gp = gamepads[0];
        const now = Date.now();
        if (now - lastGamepadTime > 200) { // debounce
            const vs = document.getElementById('view-select');
            const isSelectView = vs ? vs.classList.contains('active-view') : false;
            const mm = document.getElementById(isSelectView ? 'main-menu-home' : 'main-menu');
            const menuParent = mm ? mm.parentElement : null;
            const isMenuOpen = menuParent ? menuParent.classList.contains('active') : false;
            
            if (isMenuOpen) {
                // Menu navigation
                const links = mm.querySelectorAll('a');
                if (gp.buttons[12]?.pressed || gp.axes[1] < -0.5) { // Up
                    menuSelectedIndex = (menuSelectedIndex - 1 + links.length) % links.length;
                    playSound('move');
                    lastGamepadTime = now;
                } else if (gp.buttons[13]?.pressed || gp.axes[1] > 0.5) { // Down
                    menuSelectedIndex = (menuSelectedIndex + 1) % links.length;
                    playSound('move');
                    lastGamepadTime = now;
                } else if (gp.buttons[0]?.pressed) { // A
                    playSound('select');
                    links[menuSelectedIndex].click();
                    menuParent.classList.remove('active');
                    lastGamepadTime = now;
                } else if (gp.buttons[1]?.pressed || gp.buttons[9]?.pressed) { // B or Options
                    menuParent.classList.remove('active');
                    lastGamepadTime = now;
                }
                links.forEach((l, i) => l.style.background = i === menuSelectedIndex ? 'var(--theme-primary)' : 'transparent');
            } else if (isSelectView) {
                // Team selection grid
                const cards = document.querySelectorAll('.team-select-card');
                if (cards.length > 0) {
                    if (gp.buttons[14]?.pressed || gp.axes[0] < -0.5) { // Left
                        gridSelectedIndex = (gridSelectedIndex - 1 + cards.length) % cards.length;
                        playSound('move');
                        lastGamepadTime = now;
                    } else if (gp.buttons[15]?.pressed || gp.axes[0] > 0.5) { // Right
                        gridSelectedIndex = (gridSelectedIndex + 1) % cards.length;
                        playSound('move');
                        lastGamepadTime = now;
                    } else if (gp.buttons[12]?.pressed || gp.axes[1] < -0.5) { // Up
                        gridSelectedIndex = (gridSelectedIndex - 5 + cards.length) % cards.length;
                        playSound('move');
                        lastGamepadTime = now;
                    } else if (gp.buttons[13]?.pressed || gp.axes[1] > 0.5) { // Down
                        gridSelectedIndex = (gridSelectedIndex + 5) % cards.length;
                        playSound('move');
                        lastGamepadTime = now;
                    } else if (gp.buttons[0]?.pressed) { // A
                        playSound('select');
                        cards[gridSelectedIndex].click();
                        lastGamepadTime = now;
                    } else if (gp.buttons[9]?.pressed) { // Options
                        playSound('select');
                        lastGamepadTime = now;
                        document.getElementById('btn-menu-home').click();
                    }
                }
            } else {
                // Normal season view
                const awayInput = document.getElementById('away-score-input');
                const homeInput = document.getElementById('home-score-input');
                const isInputActive = awayInput && awayInput.style.display !== 'none';
                
                if (gp.buttons[0]?.pressed) { // A
                    playSound('select');
                    lastGamepadTime = now;
                    const btnPlay = document.getElementById('btn-play');
                    const btnSave = document.getElementById('btn-save');
                    const btnNext = document.getElementById('btn-next');
                    const isModalOpen = document.querySelector('.modal.active');
                    if (isModalOpen) {
                        closeModals();
                    } else if (btnPlay.style.display !== 'none' && !btnPlay.disabled) btnPlay.click();
                    else if (btnSave.style.display !== 'none') btnSave.click();
                    else if (btnNext.style.display !== 'none') btnNext.click();
                } else if (isInputActive && (gp.buttons[12]?.pressed || gp.axes[1] < -0.5)) { // Up (Away +)
                    playSound('move');
                    lastGamepadTime = now;
                    awayInput.value = Math.max(0, parseInt(awayInput.value || 0) + 1);
                } else if (isInputActive && (gp.buttons[13]?.pressed || gp.axes[1] > 0.5)) { // Down (Away -)
                    playSound('move');
                    lastGamepadTime = now;
                    awayInput.value = Math.max(0, parseInt(awayInput.value || 0) - 1);
                } else if (isInputActive && gp.buttons[3]?.pressed) { // Triangle (Home +)
                    playSound('move');
                    lastGamepadTime = now;
                    homeInput.value = Math.max(0, parseInt(homeInput.value || 0) + 1);
                } else if (isInputActive && gp.buttons[2]?.pressed) { // Square (Home -)
                    playSound('move');
                    lastGamepadTime = now;
                    homeInput.value = Math.max(0, parseInt(homeInput.value || 0) - 1);
                } else if (gp.buttons[14]?.pressed || gp.axes[0] < -0.5) { // Left
                    playSound('move');
                    lastGamepadTime = now;
                    document.getElementById('btn-prev-team').click();
                } else if (gp.buttons[15]?.pressed || gp.axes[0] > 0.5) { // Right
                    playSound('move');
                    lastGamepadTime = now;
                    document.getElementById('btn-next-team').click();
                } else if (gp.buttons[1]?.pressed) { // B
                    playSound('select');
                    lastGamepadTime = now;
                    closeModals();
                } else if (gp.buttons[4]?.pressed) { // L1
                    playSound('move');
                    lastGamepadTime = now;
                    cycleTabs(-1);
                } else if (gp.buttons[5]?.pressed) { // R1
                    playSound('move');
                    lastGamepadTime = now;
                    cycleTabs(1);
                } else if (gp.buttons[2]?.pressed && !isInputActive) { // Square
                    playSound('select');
                    lastGamepadTime = now;
                    toggleVitalsStandings();
                } else if (gp.buttons[6]?.pressed) { // L2
                    playSound('move');
                    lastGamepadTime = now;
                    if (currentGameIndex > 0) jumpToGame(currentGameIndex - 1);
                } else if (gp.buttons[7]?.pressed) { // R2
                    playSound('move');
                    lastGamepadTime = now;
                    if (currentGameIndex < timelineGames.length - 1) {
                        jumpToGame(currentGameIndex + 1);
                    } else if (!isPostSeason) {
                        enterPostSeason();
                    }
                } else if (gp.buttons[3]?.pressed && !isInputActive) { // Triangle
                    playSound('select');
                    lastGamepadTime = now;
                    const game = timelineGames[currentGameIndex];
                    let isTeam1 = game.team1 === selectedTeam;
                    let oppTeam = isTeam1 ? game.team2 : game.team1;
                    if (isPostSeason) oppTeam = game.team2;
                    switchTeamToOpponent(oppTeam);
                } else if (gp.buttons[9]?.pressed) { // Options
                    playSound('select');
                    lastGamepadTime = now;
                    document.getElementById('btn-menu').click();
                }
            }
        }
        

        // Continuous UI updates outside the debounce
        const viewSelect = document.getElementById('view-select');
        const isSelectView = viewSelect ? viewSelect.classList.contains('active-view') : false;
        if (isSelectView) {
            const cards = document.querySelectorAll('.team-select-card');
            cards.forEach((c, i) => {
                if (i === gridSelectedIndex) c.classList.add('gamepad-selected');
                else c.classList.remove('gamepad-selected');
            });
            
            // Handle gamepad in select view
            if (now - lastGamepadTime > 200) {
                if (gp.buttons[9]?.pressed) { // Options to open menu
                    playSound('select');
                    lastGamepadTime = now;
                    document.getElementById('btn-menu-home')?.click();
                } else if (gp.buttons[1]?.pressed) { // B to close modals
                    playSound('select');
                    lastGamepadTime = now;
                    closeModals();
                }
            }
        }
    }
    requestAnimationFrame(pollGamepad);
}
pollGamepad();

    document.addEventListener('DOMContentLoaded', () => {
        // Parallax for 3D Skydome
        document.addEventListener('mousemove', (e) => {
            const viewer = document.getElementById('bg-model');
            if (!viewer) return;
            const x = (e.clientX / window.innerWidth - 0.5) * 2;
            const y = (e.clientY / window.innerHeight - 0.5) * 2;
            const yaw = 0 + (x * -20);
            const pitch = 85 + (y * 10);
            viewer.setAttribute('camera-orbit', `${yaw}deg ${pitch}deg 0m`);
        });

        // Menu listeners
    const btnMenu = document.getElementById('btn-menu');
    btnMenu.addEventListener('click', (e) => {
        e.stopPropagation();
        const isActive = btnMenu.parentElement.classList.toggle('active');
        if (isActive) menuSelectedIndex = 0;
    });
    document.addEventListener('click', () => {
        btnMenu.parentElement.classList.remove('active');
    });

    document.getElementById('menu-restart').addEventListener('click', (e) => { e.preventDefault(); goBackToSelect(); });
    const btnReturnRs = document.getElementById('menu-return-rs');
    if (btnReturnRs) btnReturnRs.addEventListener('click', (e) => { e.preventDefault(); goBackToSelect(); });
    document.getElementById('menu-notebook').addEventListener('click', (e) => { e.preventDefault(); openNotebookModal(); });
    document.getElementById('menu-help').addEventListener('click', (e) => { e.preventDefault(); document.getElementById('modal-overlay').classList.add('active'); document.getElementById('help-modal').classList.add('active'); });
    document.getElementById('menu-about').addEventListener('click', (e) => { e.preventDefault(); document.getElementById('modal-overlay').classList.add('active'); document.getElementById('about-modal').classList.add('active'); });
    const btnQuit = document.getElementById('menu-quit');
    if (btnQuit) btnQuit.addEventListener('click', (e) => { e.preventDefault(); if(window.pywebview) window.pywebview.api.quit(); });

    // Home screen menu listeners
    
    const btnMenuHome = document.getElementById('btn-menu-home');
    if (btnMenuHome) {
        btnMenuHome.addEventListener('click', (e) => {
            e.stopPropagation();
            const isActive = btnMenuHome.parentElement.classList.toggle('active');
            if (isActive) menuSelectedIndex = 0;
        });
        document.getElementById('menu-help-home').addEventListener('click', (e) => { e.preventDefault(); btnMenuHome.parentElement.classList.remove('active'); document.getElementById('modal-overlay').classList.add('active'); document.getElementById('help-modal').classList.add('active'); });
        document.getElementById('menu-about-home').addEventListener('click', (e) => { e.preventDefault(); btnMenuHome.parentElement.classList.remove('active'); document.getElementById('modal-overlay').classList.add('active'); document.getElementById('about-modal').classList.add('active'); });
        // Close menu on click outside
        document.addEventListener('click', () => {
            btnMenuHome.parentElement.classList.remove('active');
        });
    }


    document.getElementById('btn-play').addEventListener('click', playGameAnimation);
    document.getElementById('btn-save').addEventListener('click', saveManualScore);
    document.getElementById('btn-next').addEventListener('click', nextGame);
    
    document.getElementById('btn-edit-note').addEventListener('click', (e) => {
        e.preventDefault();
        const noteInput = document.getElementById('manual-note-input');
        noteInput.style.display = 'block';
        noteInput.value = timelineGames[currentGameIndex].note || "";
        noteInput.focus();
        document.getElementById('btn-save').style.display = 'none';
        
        // Use a temporary save-note button so we don't trigger saveManualScore
        let btnSaveNote = document.getElementById('btn-save-note');
        if (!btnSaveNote) {
            btnSaveNote = document.createElement('button');
            btnSaveNote.id = 'btn-save-note';
            btnSaveNote.className = 'btn-primary';
            btnSaveNote.style.background = '#8b5cf6';
            btnSaveNote.innerText = 'SAVE NOTE';
            document.getElementById('btn-save').parentNode.insertBefore(btnSaveNote, document.getElementById('btn-next'));
        }
        btnSaveNote.style.display = 'inline-block';
        
        btnSaveNote.onclick = () => {
            timelineGames[currentGameIndex].note = noteInput.value;
            saveState();
            noteInput.style.display = 'none';
            btnSaveNote.style.display = 'none';
            document.getElementById('btn-next').style.display = 'block';
            document.getElementById('post-game-narrative').style.display = 'block';
        };
        
        document.getElementById('btn-next').style.display = 'none';
        document.getElementById('post-game-narrative').style.display = 'none';
    });
    
    document.getElementById('btn-prev-team').addEventListener('click', () => switchTeam(-1));
    document.getElementById('btn-next-team').addEventListener('click', () => switchTeam(1));
    
    document.getElementById('btn-vitals').addEventListener('click', openVitalsModal);
    document.getElementById('btn-standings').addEventListener('click', openStandingsModal);

    document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            const tabName = btn.getAttribute('data-tab');
            changeTab(tabName);
        });
    });

    fetch('scratch/processed_data.json')
        .then(res => {
            if (!res.ok) throw new Error("HTTP error " + res.status);
            return res.json();
        })
        .then(data => {
            let rawGames = data.games;
        
        const savedData = localStorage.getItem('mab1986_save');
        if (savedData) {
            try {
                const parsed = JSON.parse(savedData);
                if (parsed.allGames) rawGames = parsed.allGames;
                if (parsed.playoffGames) playoffGames = parsed.playoffGames;
            } catch (e) {
                console.error('Failed to load save state', e);
            }
        }
        
        allGames = rawGames.sort((a,b) => new Date(a.date) - new Date(b.date));
        teamNames = Object.keys(data.teams).sort();
            renderTeamGrid();
        })
        .catch(err => {
            console.error("Failed to load processed_data.json:", err);
            alert("Error loading data. Check console for details.");
        });
});

function initTeamStates() {
    teamStates = {};
    teamNames.forEach(t => {
        teamStates[t] = { elo: 1500, w: 0, l: 0, t: 0, streak: 0, pf: 0, pa: 0, history: [] };
    });
    globalGameCursor = 0;
    chartDataHistory = [];
}

function updateElo(game) {
    if (!game.played) return;
    const t1 = game.team1;
    const t2 = game.team2;
    const s1 = game.score1;
    const s2 = game.score2;
    
    const r1 = teamStates[t1].elo;
    const r2 = teamStates[t2].elo;
    
    const e1 = 1 / (1 + Math.pow(10, (r2 - r1) / 400));
    const e2 = 1 / (1 + Math.pow(10, (r1 - r2) / 400));
    
    let outcome1, outcome2;
    let res1, res2;
    if (s1 > s2) { outcome1 = 1; outcome2 = 0; res1 = 'w'; res2 = 'l'; }
    else if (s1 < s2) { outcome1 = 0; outcome2 = 1; res1 = 'l'; res2 = 'w'; }
    else { outcome1 = 0.5; outcome2 = 0.5; res1 = 't'; res2 = 't'; }
    
    const k = 50;
    teamStates[t1].elo = Math.round(r1 + k * (outcome1 - e1));
    teamStates[t2].elo = Math.round(r2 + k * (outcome2 - e2));

    teamStates[t1].pf += s1; teamStates[t1].pa += s2;
    teamStates[t2].pf += s2; teamStates[t2].pa += s1;
    
    teamStates[t1].history.push(res1);
    teamStates[t2].history.push(res2);

    if(outcome1 === 1) { teamStates[t1].w++; teamStates[t1].streak = teamStates[t1].streak > 0 ? teamStates[t1].streak + 1 : 1; }
    else if(outcome1 === 0) { teamStates[t1].l++; teamStates[t1].streak = teamStates[t1].streak < 0 ? teamStates[t1].streak - 1 : -1; }
    else { teamStates[t1].t++; teamStates[t1].streak = 0; }
    
    if(outcome2 === 1) { teamStates[t2].w++; teamStates[t2].streak = teamStates[t2].streak > 0 ? teamStates[t2].streak + 1 : 1; }
    else if(outcome2 === 0) { teamStates[t2].l++; teamStates[t2].streak = teamStates[t2].streak < 0 ? teamStates[t2].streak - 1 : -1; }
    else { teamStates[t2].t++; teamStates[t2].streak = 0; }
}

function getStreakStr(val) {
    if (val > 0) return `W${val}`;
    if (val < 0) return `L${Math.abs(val)}`;
    return '-';
}

function renderSparkline(elementId, team) {
    const el = document.getElementById(elementId);
    el.innerHTML = '';
    const hist = teamStates[team].history.slice(-5);
    hist.forEach(res => {
        const div = document.createElement('div');
        div.className = `spark ${res}`;
        el.appendChild(div);
    });
}

function renderTeamGrid() {
    const grid = document.getElementById('team-grid');
    grid.innerHTML = '';
    
    teamNames.forEach(team => {
        const theme = teamThemes[team] || { primary: '#444', secondary: '#222' };
        const card = document.createElement('div');
        card.className = 'team-select-card';
        card.style.setProperty('--card-primary', theme.primary);
        card.style.setProperty('--card-secondary', theme.secondary);
        card.innerHTML = `<h2>${team.replace('Majors ', '')}</h2>`;
        card.addEventListener('click', () => {
            currentGameIndex = 0;
            startSeason(team);
        });
        grid.appendChild(card);
    });
}

function switchTeam(dir) {
    let idx = teamNames.indexOf(selectedTeam);
    idx = (idx + dir + teamNames.length) % teamNames.length;
    
    if (isPostSeason) {
        selectedTeam = teamNames[idx];
        const theme = teamThemes[selectedTeam] || { primary: '#3b82f6', secondary: '#1d4ed8' };
        document.documentElement.style.setProperty('--theme-primary', theme.primary);
        document.documentElement.style.setProperty('--theme-secondary', theme.secondary);
        document.getElementById('nav-team-name').innerText = selectedTeam.replace('Majors ', '');
        document.getElementById('nav-team-name').style.color = theme.primary;
        document.getElementById('bias-team-name').innerText = selectedTeam.replace('Majors ', '');
        
        initBiasChart();
        renderTimelineTrack();
        jumpToGame(currentGameIndex);
    } else {
        startSeason(teamNames[idx]);
    }
}

function startSeason(team) {
    isPostSeason = false;
    selectedTeam = team;
    const theme = teamThemes[team] || { primary: '#3b82f6', secondary: '#1d4ed8' };
    document.documentElement.style.setProperty('--theme-primary', theme.primary);
    document.documentElement.style.setProperty('--theme-secondary', theme.secondary);
    
    document.getElementById('view-select').classList.remove('active-view');
    document.getElementById('view-season').classList.add('active-view');
    
    document.getElementById('nav-team-name').innerText = team.replace('Majors ', '');
    document.getElementById('nav-team-name').style.color = theme.primary;
    document.getElementById('bias-team-name').innerText = team.replace('Majors ', '');
    
    timelineGames = allGames.filter(g => g.team1 === team || g.team2 === team);
    if (currentGameIndex >= timelineGames.length) currentGameIndex = Math.max(0, timelineGames.length - 1);
    
    initBiasChart();
    renderTimelineTrack();
    jumpToGame(currentGameIndex);
}

function switchTeamToOpponent(oppTeam) {
    if (!oppTeam || oppTeam === 'TBD') return;
    let targetGame = timelineGames[currentGameIndex];
    
    selectedTeam = oppTeam;
    const theme = teamThemes[oppTeam] || { primary: '#3b82f6', secondary: '#1d4ed8' };
    document.documentElement.style.setProperty('--theme-primary', theme.primary);
    document.documentElement.style.setProperty('--theme-secondary', theme.secondary);
    
    document.getElementById('nav-team-name').innerText = oppTeam.replace('Majors ', '');
    document.getElementById('nav-team-name').style.color = theme.primary;
    document.getElementById('bias-team-name').innerText = oppTeam.replace('Majors ', '');
    
    if (isPostSeason) {
        initBiasChart();
        renderTimelineTrack();
        jumpToGame(currentGameIndex);
    } else {
        timelineGames = allGames.filter(g => g.team1 === oppTeam || g.team2 === oppTeam);
        let newIdx = timelineGames.indexOf(targetGame);
        if (newIdx === -1) newIdx = Math.max(0, timelineGames.length - 1);
        currentGameIndex = newIdx;
        initBiasChart();
        renderTimelineTrack();
        jumpToGame(currentGameIndex);
    }
}

function goBackToSelect() {
    isPostSeason = false;
    document.getElementById('view-season').classList.remove('active-view');
    document.getElementById('view-select').classList.add('active-view');
}

function renderTimelineTrack() {
    const track = document.getElementById('timeline-track');
    track.innerHTML = '';
    timelineGames.forEach((g, i) => {
        const node = document.createElement('div');
        node.className = 'timeline-node';
        if (!g.played) node.classList.add('unplayed');
        node.innerText = isPostSeason ? (g.name ? g.name : (i+1)) : (i + 1);
        node.id = `node-${i}`;
        node.addEventListener('click', () => jumpToGame(i));
        track.appendChild(node);
    });

    if (!isPostSeason) {
        const psNode = document.createElement('div');
        psNode.className = 'timeline-node';
        psNode.innerText = 'PS';
        psNode.style.fontWeight = 'bold';
        psNode.style.color = '#fde047';
        psNode.addEventListener('click', () => enterPostSeason());
        track.appendChild(psNode);
    }
}
function getTeamFromSource(source) {
    if (typeof source === 'number') {
        return finalSeeds[source - 1]; // seed 1 is index 0
    }
    if (source.type === 'winner') {
        const g = playoffGames[source.gameId - 1];
        if (g && g.played) return g.score1 > g.score2 ? g.team1 : g.team2;
    }
    if (source.type === 'loser') {
        const g = playoffGames[source.gameId - 1];
        if (g && g.played) return g.score1 < g.score2 ? g.team1 : g.team2;
    }
    return "TBD";
}

function evaluateBracket() {
    playoffGames.forEach((g, i) => {
        // Game 18 special rule
        if (g.id === 18) {
            g.team2 = getTeamFromSource(g.awaySource); // Winner G17
            g.team1 = getTeamFromSource(g.homeSource); // Winner G15
        } else if (g.id === 19) {
            g.team2 = getTeamFromSource(g.awaySource); // Winner G15
            g.team1 = getTeamFromSource(g.homeSource); // Winner G17
        } else {
            g.team2 = getTeamFromSource(g.awaySource); // Away is always awaySource
            g.team1 = getTeamFromSource(g.homeSource); // Home is always homeSource
        }
    });
}

function enterPostSeason() {
    while (globalGameCursor < allGames.length) {
        updateElo(allGames[globalGameCursor]);
        globalGameCursor++;
    }

    if (playoffGames.length === 0) {
        // Calculate seeds
        let standings = teamNames.map(t => ({ team: t, ...teamStates[t] }));
        standings.sort((a, b) => {
            const pctA = (a.w + a.t*0.5) / (a.w + a.l + a.t || 1);
            const pctB = (b.w + b.t*0.5) / (b.w + b.l + b.t || 1);
            if (Math.abs(pctA - pctB) > 0.001) return pctB - pctA;
            return b.elo - a.elo;
        });
        finalSeeds = standings.map(s => s.team);
        
        // Initialize template
        playoffGames = [
            { id: 1, name: "G1", date: "2026-05-28", awaySource: 9, homeSource: 8, played: false, score1: 0, score2: 0, note: "" },
            { id: 2, name: "G2", date: "2026-05-28", awaySource: 10, homeSource: 7, played: false, score1: 0, score2: 0, note: "" },
            { id: 3, name: "G3", date: "2026-05-29", awaySource: 5, homeSource: 4, played: false, score1: 0, score2: 0, note: "" },
            { id: 4, name: "G4", date: "2026-05-29", awaySource: 6, homeSource: 3, played: false, score1: 0, score2: 0, note: "" },
            { id: 5, name: "G5", date: "2026-05-30", awaySource: {type: 'winner', gameId: 1}, homeSource: 1, played: false, score1: 0, score2: 0, note: "" },
            { id: 6, name: "G6", date: "2026-05-30", awaySource: {type: 'winner', gameId: 2}, homeSource: 2, played: false, score1: 0, score2: 0, note: "" },
            { id: 7, name: "G7", date: "2026-05-31", awaySource: {type: 'loser', gameId: 2}, homeSource: {type: 'loser', gameId: 3}, isElimination: true, played: false, score1: 0, score2: 0, note: "" },
            { id: 8, name: "G8", date: "2026-05-31", awaySource: {type: 'loser', gameId: 1}, homeSource: {type: 'loser', gameId: 4}, isElimination: true, played: false, score1: 0, score2: 0, note: "" },
            { id: 9, name: "G9", date: "2026-06-02", awaySource: {type: 'winner', gameId: 7}, homeSource: {type: 'loser', gameId: 5}, isElimination: true, played: false, score1: 0, score2: 0, note: "" },
            { id: 10, name: "G10", date: "2026-06-03", awaySource: {type: 'winner', gameId: 8}, homeSource: {type: 'loser', gameId: 6}, isElimination: true, played: false, score1: 0, score2: 0, note: "" },
            { id: 11, name: "G11", date: "2026-06-04", awaySource: {type: 'winner', gameId: 3}, homeSource: {type: 'winner', gameId: 5}, played: false, score1: 0, score2: 0, note: "" },
            { id: 12, name: "G12", date: "2026-06-04", awaySource: {type: 'winner', gameId: 6}, homeSource: {type: 'winner', gameId: 4}, played: false, score1: 0, score2: 0, note: "" },
            { id: 13, name: "G13", date: "2026-06-06", awaySource: {type: 'winner', gameId: 9}, homeSource: {type: 'loser', gameId: 12}, isElimination: true, played: false, score1: 0, score2: 0, note: "" },
            { id: 14, name: "G14", date: "2026-06-06", awaySource: {type: 'winner', gameId: 10}, homeSource: {type: 'loser', gameId: 11}, isElimination: true, played: false, score1: 0, score2: 0, note: "" },
            { id: 15, name: "G15", date: "2026-06-06", awaySource: {type: 'winner', gameId: 11}, homeSource: {type: 'winner', gameId: 12}, played: false, score1: 0, score2: 0, note: "" },
            { id: 16, name: "G16", date: "2026-06-08", awaySource: {type: 'winner', gameId: 13}, homeSource: {type: 'winner', gameId: 14}, isElimination: true, played: false, score1: 0, score2: 0, note: "" },
            { id: 17, name: "G17", date: "2026-06-10", awaySource: {type: 'winner', gameId: 16}, homeSource: {type: 'loser', gameId: 15}, isElimination: true, played: false, score1: 0, score2: 0, note: "" },
            { id: 18, name: "G18", date: "2026-06-13", awaySource: {type: 'winner', gameId: 17}, homeSource: {type: 'winner', gameId: 15}, isElimination: true, played: false, score1: 0, score2: 0, note: "" },
            { id: 19, name: "G19", date: "2026-06-14", awaySource: {type: 'winner', gameId: 15}, homeSource: {type: 'winner', gameId: 17}, isElimination: true, played: false, score1: 0, score2: 0, note: "" }
        ];
        evaluateBracket();
    }
    
    isPostSeason = true;
    showWelcomeToPostSeason();
}

function showWelcomeToPostSeason() {
    const s = teamStates[selectedTeam];
    const html = `
        <p style="margin-bottom:1rem;">Congratulations, the <strong>${selectedTeam.replace('Majors ', '')}</strong> have clinched a spot in the Post Season!</p>
        <p style="margin-bottom:1rem;">They enter the tournament with a fierce Elo rating of <strong>${s.elo}</strong> after finishing the regular season at <strong>${s.w}-${s.l}</strong>.</p>
        <p style="margin-bottom:1rem;">The Post Season is a brutal <strong>Double-Elimination Bracket</strong>. You must fight your way to the Grand Finals. Only the strongest survive.</p>
        <p style="color:#fde047; font-weight:bold;">Good luck!</p>
    `;
    showModal('Welcome to the Post Season', html);
    regularTimelineCache = timelineGames;
    
    // Hide game 19 if not necessary
    let displayGames = playoffGames;
    const g18 = playoffGames[17];
    if (g18.played) {
        const w15 = getTeamFromSource({type: 'winner', gameId: 15});
        if ((g18.score1 > g18.score2 && g18.team1 === w15) || (g18.score2 > g18.score1 && g18.team2 === w15)) {
            // Winner of 15 won game 18. Game 19 not necessary.
            displayGames = playoffGames.slice(0, 18);
            triggerChampionship(w15);
        } else if (playoffGames[18].played) {
            const g19 = playoffGames[18];
            const champ = g19.score1 > g19.score2 ? g19.team1 : g19.team2;
            triggerChampionship(champ);
        }
    }

    timelineGames = displayGames;
    renderTimelineTrack();
    jumpToGame(0);
}

function triggerChampionship(champ) {
    const isMe = champ === selectedTeam;
    const name = champ.replace('Majors ', '');
    const s = teamStates[champ];
    const pyth = (s.w + s.t*0.5) / (s.w + s.l + s.t || 1);
    
    let html = `
        <div style="text-align:center; margin-bottom:1rem;">
            <h1 style="font-size:2rem; color:#fde047; margin-bottom:0.5rem;">${name} WIN THE CHAMPIONSHIP!</h1>
            <p style="font-size:1.2rem;">A Historic Season Concludes</p>
        </div>
        <hr style="border-color:rgba(255,255,255,0.2); margin-bottom:1rem;">
        <p style="margin-bottom:1rem;">The <strong>${name}</strong> have defied the odds and captured the MAB 1986 crown!</p>
        <p style="margin-bottom:1rem;">They finish the year with an impressive <strong>${s.elo}</strong> Elo rating and a final record of <strong>${s.w}-${s.l}</strong>.</p>
    `;
    
    if (pyth > 0.6) html += `<p style="margin-bottom:1rem;">Critics aren't surprised. Their underlying Pythagorean win expectation of ${Math.round(pyth*100)}% proved they were an absolute juggernaut all year.</p>`;
    else html += `<p style="margin-bottom:1rem;">It's a true underdog story! Their underlying Pythagorean win expectation was only ${Math.round(pyth*100)}%, but they found ways to win when it mattered most!</p>`;
    
    if (isMe) html += `<p style="margin-top:1.5rem; color:#22c55e; font-weight:bold; text-align:center;">Congratulations on guiding your franchise to glory!</p>`;
    else html += `<p style="margin-top:1.5rem; color:#ef4444; font-weight:bold; text-align:center;">Your team fell short this year, but there is always next season.</p>`;
    
    showModal('MAB 1986 Season Finale', html);
}

function leavePostSeason() {
    isPostSeason = false;
    timelineGames = regularTimelineCache;
    renderTimelineTrack();
    jumpToGame(timelineGames.length - 1);
}

function syncTimelineNodes() {
    timelineGames.forEach((g, i) => {
        const node = document.getElementById(`node-${i}`);
        node.className = 'timeline-node';
        if (!g.played) node.classList.add('unplayed');
        
        if (i < currentGameIndex && g.played) {
            node.classList.add('played');
            const isT1 = g.team1 === selectedTeam;
            const myScore = isT1 ? g.score1 : g.score2;
            const oppScore = isT1 ? g.score2 : g.score1;
            if (myScore > oppScore) node.classList.add('win');
            else if (myScore < oppScore) node.classList.add('loss');
        } else if (i === currentGameIndex) {
            node.classList.add('active');
            node.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
        }
    });
}

function jumpToGame(targetIndex) {
    currentGameIndex = targetIndex;
    initTeamStates();
    const targetGame = timelineGames[currentGameIndex];
    
    while (globalGameCursor < allGames.length && allGames[globalGameCursor] !== targetGame) {
        const g = allGames[globalGameCursor];
        updateElo(g);
        if (g.played && (g.team1 === selectedTeam || g.team2 === selectedTeam)) {
            const isT1 = g.team1 === selectedTeam;
            const pf = isT1 ? g.score1 : g.score2;
            const pa = isT1 ? g.score2 : g.score1;
            const diff = pf - pa;
            const oppName = isT1 ? g.team2 : g.team1;
            chartDataHistory.push({ 
                diff, 
                pf, 
                pa, 
                opp: oppName.replace('Majors ', ''), 
                date: g.date,
                elo: teamStates[selectedTeam].elo
            });
        }
        globalGameCursor++;
    }
    if (isPostSeason) {
        evaluateBracket();
        // Check game 19 visibility
        const g18 = playoffGames[17];
        if (g18.played) {
            const w15 = getTeamFromSource({type: 'winner', gameId: 15});
            if ((g18.score1 > g18.score2 && g18.team1 === w15) || (g18.score2 > g18.score1 && g18.team2 === w15)) {
                timelineGames = playoffGames.slice(0, 18); // remove G19
                renderTimelineTrack();
                triggerChampionship(w15);
            } else if (playoffGames[18].played) {
                const g19 = playoffGames[18];
                const champ = g19.score1 > g19.score2 ? g19.team1 : g19.team2;
                triggerChampionship(champ);
            } else {
                timelineGames = playoffGames; // Ensure 19 is visible
                renderTimelineTrack();
            }
        }
    }
    
    updateBiasChart();
    loadGameMatchup();
}

function checkRivalry(oppTeam) {
    let played = 0, won = 0, lost = 0;
    for (let i = 0; i < globalGameCursor; i++) {
        const g = allGames[i];
        if (g.played && ((g.team1 === selectedTeam && g.team2 === oppTeam) || (g.team2 === selectedTeam && g.team1 === oppTeam))) {
            played++;
            const isT1 = g.team1 === selectedTeam;
            const myS = isT1 ? g.score1 : g.score2;
            const oppS = isT1 ? g.score2 : g.score1;
            if (myS > oppS) won++;
            else if (myS < oppS) lost++;
        }
    }
    if (played === 0) return "";
    if (won > lost) return `Rivalry: You beat them earlier this season. They want revenge!`;
    if (lost > won) return `Rivalry: Looking for revenge! You lost to them earlier.`;
    return `Rivalry: Season series is tied. Rubber match!`;
}

function loadGameMatchup() {
    syncTimelineNodes();
    document.getElementById('post-game-box').style.display = 'none';
    document.getElementById('prediction-box').style.display = 'block';
    
    const game = timelineGames[currentGameIndex];
    document.getElementById('matchup-date').innerText = new Date(game.date).toLocaleDateString();
    
    let awayTeamStr = game.team2;
    let homeTeamStr = game.team1;
    let oppTeam = (homeTeamStr === selectedTeam) ? awayTeamStr : homeTeamStr;
    
    document.getElementById('away-name').innerText = awayTeamStr.replace('Majors ', '');
    document.getElementById('home-name').innerText = homeTeamStr.replace('Majors ', '');
    
    document.getElementById('away-name').onclick = () => { if (awayTeamStr !== 'TBD') switchTeamToOpponent(awayTeamStr); };
    document.getElementById('home-name').onclick = () => { if (homeTeamStr !== 'TBD') switchTeamToOpponent(homeTeamStr); };
    
    document.getElementById('away-elo').innerText = awayTeamStr === 'TBD' ? '' : `Elo: ${teamStates[awayTeamStr].elo}`;
    document.getElementById('home-elo').innerText = homeTeamStr === 'TBD' ? '' : `Elo: ${teamStates[homeTeamStr].elo}`;
    
    if (awayTeamStr !== 'TBD') {
        document.getElementById('away-streak').innerText = `Streak: ${getStreakStr(teamStates[awayTeamStr].streak)}`;
        renderSparkline('away-sparkline', awayTeamStr);
    } else {
        document.getElementById('away-streak').innerText = '';
        document.getElementById('away-sparkline').innerHTML = '';
    }
    
    if (homeTeamStr !== 'TBD') {
        document.getElementById('home-streak').innerText = `Streak: ${getStreakStr(teamStates[homeTeamStr].streak)}`;
        renderSparkline('home-sparkline', homeTeamStr);
    } else {
        document.getElementById('home-streak').innerText = '';
        document.getElementById('home-sparkline').innerHTML = '';
    }
    
    document.querySelector('.team-block.away').classList.remove('winner-highlight', 'team-focus');
    document.getElementById('home-block').classList.remove('winner-highlight', 'team-focus');
    
    if (awayTeamStr === selectedTeam) document.querySelector('.team-block.away').classList.add('team-focus');
    if (homeTeamStr === selectedTeam) document.getElementById('home-block').classList.add('team-focus');
    
    const awayScoreEl = document.getElementById('away-score');
    const homeScoreEl = document.getElementById('home-score');
    const awayInput = document.getElementById('away-score-input');
    const homeInput = document.getElementById('home-score-input');
    const noteInput = document.getElementById('manual-note-input');
    const btnPlay = document.getElementById('btn-play');
    const btnSave = document.getElementById('btn-save');
    const btnNext = document.getElementById('btn-next');
    
    awayScoreEl.classList.remove('ticking');
    homeScoreEl.classList.remove('ticking');
    
    if (awayTeamStr === 'TBD' || homeTeamStr === 'TBD') {
        document.getElementById('btn-play').disabled = true;
        btnPlay.style.display = 'block';
        btnSave.style.display = 'none';
        awayInput.style.display = 'none';
        homeInput.style.display = 'none';
        awayScoreEl.style.display = 'block';
        homeScoreEl.style.display = 'block';
        awayScoreEl.innerText = '-';
        homeScoreEl.innerText = '-';
        document.getElementById('matchup-status').innerText = 'WAITING ON PREVIOUS MATCHES';
        document.getElementById('matchup-status').style.background = '#4b5563';
        btnNext.style.display = 'none';
        noteInput.style.display = 'none';
    } else if (game.viewed) {
        document.getElementById('matchup-status').innerText = 'FINAL';
        document.getElementById('matchup-status').style.background = '#22c55e';
        
        awayScoreEl.innerText = game.score2;
        homeScoreEl.innerText = game.score1;
        awayScoreEl.style.display = 'block';
        homeScoreEl.style.display = 'block';
        awayInput.style.display = 'none';
        homeInput.style.display = 'none';
        noteInput.style.display = 'none';
        
        btnPlay.style.display = 'none';
        btnSave.style.display = 'none';
        btnNext.style.display = 'block';
        
        document.getElementById('prediction-box').style.display = 'none';
        document.getElementById('post-game-box').style.display = 'block';
        
        document.getElementById('post-game-narrative').innerText = game.note ? `Broadcast Note: "${game.note}"` : "Game Finalized.";
        
        if (game.score1 > game.score2) document.getElementById('home-block').classList.add('winner-highlight');
        else if (game.score2 > game.score1) document.querySelector('.team-block.away').classList.add('winner-highlight');
    } else {
        document.getElementById('matchup-status').innerText = isPostSeason ? 'SCHEDULED / POST-SEASON' : 'SCHEDULED';
        document.getElementById('matchup-status').style.background = '#4b5563';
        
        awayScoreEl.style.display = 'none';
        homeScoreEl.style.display = 'none';
        awayInput.style.display = 'inline-block';
        homeInput.style.display = 'inline-block';
        noteInput.style.display = 'block';
        noteInput.value = '';
        awayInput.value = '';
        homeInput.value = '';
        
        btnPlay.style.display = 'none';
        btnSave.style.display = 'block';
        btnNext.style.display = 'none';
        
        if (!isPostSeason && game.played) {
            btnPlay.style.display = 'block';
            btnPlay.disabled = false;
            btnSave.style.display = 'none';
            awayInput.style.display = 'none';
            homeInput.style.display = 'none';
            awayScoreEl.style.display = 'block';
            homeScoreEl.style.display = 'block';
            awayScoreEl.innerText = '-';
            homeScoreEl.innerText = '-';
            noteInput.style.display = 'none';
            document.getElementById('matchup-status').innerText = 'PRE-GAME';
            document.getElementById('matchup-status').style.background = 'var(--theme-secondary)';
        }
    }
    
    if (awayTeamStr !== 'TBD' && homeTeamStr !== 'TBD' && !game.played) {
        const rMy = teamStates[selectedTeam].elo;
        const rOpp = teamStates[oppTeam].elo;
        const prob = 1 / (1 + Math.pow(10, (rOpp - rMy) / 400));
        
        let predText = "";
        if (prob > 0.6) predText = `Strong favorite. ${(prob*100).toFixed(0)}% chance to win.`;
        else if (prob < 0.4) predText = `Underdog. Opponent has the edge (${((1-prob)*100).toFixed(0)}% win prob).`;
        else predText = `Even matchup. Toss up (${(prob*100).toFixed(0)}% chance).`;
        
        document.getElementById('prediction-text').innerText = predText;
        document.getElementById('rivalry-text').innerText = checkRivalry(oppTeam);
    }
    
    document.getElementById('nav-record').innerText = `${teamStates[selectedTeam].w}-${teamStates[selectedTeam].l}-${teamStates[selectedTeam].t}`;
    document.getElementById('nav-elo').innerText = teamStates[selectedTeam].elo;
    document.getElementById('nav-game-current').innerText = currentGameIndex + 1;
    document.getElementById('nav-game-total').innerText = timelineGames.length;
}
function saveManualScore() {
    const awayVal = document.getElementById('away-score-input').value;
    const homeVal = document.getElementById('home-score-input').value;
    
    if (awayVal === '' || homeVal === '') {
        showModal('Alert', 'Please enter both scores');
        return;
    }
    
    const game = timelineGames[currentGameIndex];
    game.played = true;
    game.viewed = true;
    
    if (isPostSeason) {
        game.score1 = parseInt(homeVal);
        game.score2 = parseInt(awayVal);
    } else {
        const isTeam1 = game.team1 === selectedTeam;
        if (isTeam1) {
            game.score1 = parseInt(homeVal);
            game.score2 = parseInt(awayVal);
        } else {
            game.score2 = parseInt(homeVal);
            game.score1 = parseInt(awayVal);
        }
    }
    
    const noteVal = document.getElementById('manual-note-input').value.trim();
    if (noteVal) game.note = noteVal;
    
    // Hide inputs, show static score
    document.getElementById('away-score-input').style.display = 'none';
    document.getElementById('home-score-input').style.display = 'none';
    document.getElementById('manual-note-input').style.display = 'none';
    document.getElementById('post-game-narrative').style.display = 'block';
    const awayScoreEl = document.getElementById('away-score');
    const homeScoreEl = document.getElementById('home-score');
    awayScoreEl.style.display = 'block';
    homeScoreEl.style.display = 'block';
    awayScoreEl.innerText = awayVal;
    homeScoreEl.innerText = homeVal;
    
    document.getElementById('btn-save').style.display = 'none';
    
    finishGame();
}

function playGameAnimation() {
    document.getElementById('btn-play').disabled = true;
    document.getElementById('matchup-status').innerText = 'IN PROGRESS';
    document.getElementById('matchup-status').style.background = '#eab308';
    
    const game = timelineGames[currentGameIndex];
    const isTeam1 = game.team1 === selectedTeam;
    const finalAway = isTeam1 ? game.score2 : game.score1;
    const finalHome = isTeam1 ? game.score1 : game.score2;
    
    let currentAway = 0;
    let currentHome = 0;
    
    document.getElementById('away-score').classList.add('ticking');
    document.getElementById('home-score').classList.add('ticking');
    
    const interval = setInterval(() => {
        if (currentAway < finalAway) {
            let increment = Math.floor(Math.random() * 3); // 0, 1, or 2
            currentAway = Math.min(finalAway, currentAway + increment);
        }
        if (currentHome < finalHome) {
            let increment = Math.floor(Math.random() * 3); // 0, 1, or 2
            currentHome = Math.min(finalHome, currentHome + increment);
        }
        
        document.getElementById('away-score').innerText = currentAway;
        document.getElementById('home-score').innerText = currentHome;
        
        if (currentAway === finalAway && currentHome === finalHome) {
            clearInterval(interval);
            finishGame();
        }
    }, 150);
}

function generateNarrative(game, rMy, rOpp, isWin, diff) {
    const oppName = (game.team1 === selectedTeam ? game.team2 : game.team1).replace('Majors ', '');
    const myName = selectedTeam.replace('Majors ', '');
    
    if (diff === 0) {
        return `A hard-fought ${game.score1}-${game.score2} tie between the ${myName} and ${oppName}.`;
    }
    
    if (isWin && rOpp - rMy > 100 && diff >= 5) return `MASSIVE UPSET! The underdog ${myName} absolutely crushed the favored ${oppName}!`;
    if (isWin && rOpp - rMy > 50) return `Great Upset! ${myName} secures a hard-fought win against a tougher opponent.`;
    if (isWin && teamStates[selectedTeam].w === teamStates[selectedTeam].l + 1) return `Above .500! ${myName} pushes their record into positive territory.`;
    if (isWin && teamStates[selectedTeam].streak >= 3) return `The Streak Continues! ${myName} wins their ${teamStates[selectedTeam].streak} in a row!`;
    if (!isWin && teamStates[selectedTeam].streak <= -3) return `The slump continues. ${myName} needs to find answers soon.`;
    if (!isWin && rMy - rOpp > 100) return `Heartbreaking Upset. The favored ${myName} fell to ${oppName}.`;
    
    if (isWin) return `Solid victory for the ${myName} against ${oppName}.`;
    return `Tough loss for ${myName} against ${oppName}.`;
}

function finishGame() {
    document.getElementById('away-score').classList.remove('ticking');
    document.getElementById('home-score').classList.remove('ticking');
    
    document.getElementById('matchup-status').innerText = 'FINAL';
    document.getElementById('matchup-status').style.background = '#22c55e';
    
    const game = timelineGames[currentGameIndex];
    game.viewed = true;
    const isTeam1 = game.team1 === selectedTeam;
    
    const finalAway = isTeam1 ? game.score2 : game.score1;
    const finalHome = isTeam1 ? game.score1 : game.score2;
    
    if (finalHome > finalAway) playSound('win');
    else if (finalHome < finalAway) playSound('loss');
    else playSound('tie');
    const oppTeam = isTeam1 ? game.team2 : game.team1;
    
    const oldEloMy = teamStates[selectedTeam].elo;
    const oldEloOpp = teamStates[oppTeam].elo;
    
    updateElo(game);
    globalGameCursor++;
    if (isPostSeason) {
        evaluateBracket();
        // Check game 19 visibility
        const g18 = playoffGames[17];
        if (g18.played) {
            const w15 = getTeamFromSource({type: 'winner', gameId: 15});
            if ((g18.score1 > g18.score2 && g18.team1 === w15) || (g18.score2 > g18.score1 && g18.team2 === w15)) {
                timelineGames = playoffGames.slice(0, 18); // remove G19
                renderTimelineTrack();
                triggerChampionship(w15);
            } else if (playoffGames[18].played) {
                const g19 = playoffGames[18];
                const champ = g19.score1 > g19.score2 ? g19.team1 : g19.team2;
                triggerChampionship(champ);
            } else {
                timelineGames = playoffGames; // Ensure 19 is visible
                renderTimelineTrack();
            }
        }
    }
 
    

    if (finalHome > finalAway) document.getElementById('home-block').classList.add('winner-highlight');
    else if (finalAway > finalHome) document.querySelector('.team-block.away').classList.add('winner-highlight');
    
    document.getElementById('away-elo').innerText = `New Elo: ${teamStates[oppTeam].elo}`;
    document.getElementById('home-elo').innerText = `New Elo: ${teamStates[selectedTeam].elo}`;
    
    const diff = finalHome - finalAway;
    const isWin = finalHome > finalAway;
    
    document.getElementById('prediction-box').style.display = 'none';
    const postBox = document.getElementById('post-game-box');
    postBox.style.display = 'block';
    
    let narrative = generateNarrative(game, oldEloMy, oldEloOpp, isWin, Math.abs(diff));
    if (game.note) {
        narrative += `\n\nBroadcast Note: "${game.note}"`;
    }
    document.getElementById('post-game-narrative').innerText = narrative;
    
    chartDataHistory.push({ 
        diff, 
        pf: finalHome, 
        pa: finalAway, 
        opp: oppTeam.replace('Majors ', ''), 
        date: game.date,
        elo: teamStates[selectedTeam].elo
    });
    updateBiasChart();
    
    document.getElementById('btn-play').style.display = 'none';
    if (currentGameIndex < timelineGames.length - 1) {
        document.getElementById('btn-next').style.display = 'block';
    }
    syncTimelineNodes();
    
    if (isPostSeason) {
        checkNewsFlashes(game);
    }
    
    saveState();
}

function saveState() {
    localStorage.setItem('mab1986_save', JSON.stringify({
        allGames: allGames,
        playoffGames: playoffGames
    }));
}

function checkNewsFlashes(game) {
    if (currentGameIndex !== timelineGames.length - 1) return;
    
    if (game.id === 4) {
        showModal('Post-Season News Flash', `
            <p style="margin-bottom:1rem;"><strong>Quarter-Finals Conclude!</strong></p>
            <p>The field is narrowing. The early rounds have separated the contenders from the pretenders. The remaining teams must now brace for the grueling semi-finals as the pressure mounts.</p>
        `);
    } else if (game.id === 10) {
        showModal('Post-Season News Flash', `
            <p style="margin-bottom:1rem;"><strong>Semi-Finals Wrap Up!</strong></p>
            <p>We are down to the absolute elite. Surviving the elimination bracket takes incredible grit, and the surviving franchises have proven they have championship DNA.</p>
        `);
    } else if (game.id === 14) {
        showModal('Post-Season News Flash', `
            <p style="margin-bottom:1rem;"><strong>Championship Series Imminent!</strong></p>
            <p>The stage is set. The final contenders have fought through the grueling double-elimination gauntlet. It all comes down to this. Who will etch their name into history?</p>
        `);
    }
}

function nextGame() {
    if (IS_WEB_TRIAL && !isPostSeason && currentGameIndex >= TRIAL_GAME_LIMIT) {
        showModal('Trial Version Complete', `
            <div style="text-align:center;">
                <h3 style="color:#fde047; font-size:1.5rem; margin-bottom:1rem;">Thanks for playing!</h3>
                <p style="margin-bottom:1rem;">You have completed the 5-game web trial.</p>
                <p style="margin-bottom:1rem;">To unlock the full 162-game season simulation, the Double-Elimination Playoffs, and Save Game support, please purchase the full Mac App!</p>
                <p style="color:#22c55e;">Available now from Vision Constructs LLC.</p>
            </div>
        `);
        return;
    }
    
    if (currentGameIndex < timelineGames.length - 1) {
        jumpToGame(currentGameIndex + 1);
    }
}

function changeTab(tabName) {
    activeTab = tabName;
    document.querySelectorAll('.tab-btn').forEach(btn => {
        if (btn.getAttribute('data-tab') === tabName) {
            btn.classList.add('active');
        } else {
            btn.classList.remove('active');
        }
    });
    updateBiasChart();
}

function initBiasChart() {
    const ctx = document.getElementById('biasChart').getContext('2d');
    if (biasChartInstance) biasChartInstance.destroy();
    
    // Create a dummy instance so updateBiasChart can destroy it
    biasChartInstance = new Chart(ctx, { type: 'bar', data: { labels: [], datasets: [] } });
}

function updateBiasChart() {
    if (!biasChartInstance) return;
    
    const ctx = document.getElementById('biasChart').getContext('2d');
    biasChartInstance.destroy();
    
    const labels = chartDataHistory.map((_, i) => `G${i+1}`);
    let config = {};
    
    if (activeTab === 'run-diff') {
        const colors = chartDataHistory.map(d => d.diff > 0 ? '#064e3b' : (d.diff < 0 ? '#b91c1c' : '#9ca3af'));
        config = {
            type: 'bar',
            data: {
                labels: labels,
                datasets: [{
                    label: 'Run Differential',
                    data: chartDataHistory.map(d => d.diff),
                    backgroundColor: colors,
                    borderRadius: 4
                }]
            },
            options: {
                responsive: true, maintainAspectRatio: false,
                plugins: {
                    legend: { display: false },
                    tooltip: {
                        titleFont: { family: 'VT323', size: 18 },
                        bodyFont: { family: 'VT323', size: 16 },
                        callbacks: {
                            title: (items) => {
                                const dataObj = chartDataHistory[items[0].dataIndex];
                                return `Game ${items[0].dataIndex + 1}: vs ${dataObj.opp}`;
                            },
                            label: (ctx) => `Diff: ${ctx.raw > 0 ? '+' : ''}${ctx.raw} runs (${new Date(chartDataHistory[ctx.dataIndex].date).toLocaleDateString()})`
                        }
                    }
                },
                scales: {
                    x: { grid: { color: 'rgba(255,255,255,0.1)' }, ticks: { color: '#9ca3af', font: { family: 'VT323', size: 16 } } },
                    y: { grid: { color: 'rgba(255,255,255,0.1)' }, ticks: { color: '#9ca3af', font: { family: 'VT323', size: 16 } }, suggestedMin: -10, suggestedMax: 10 }
                }
            }
        };
    } else if (activeTab === 'cum-diff') {
        let cumSum = 0;
        const cumData = chartDataHistory.map(d => {
            cumSum += d.diff;
            return cumSum;
        });
        
        config = {
            type: 'line',
            data: {
                labels: labels,
                datasets: [{
                    label: 'C Diff',
                    data: cumData,
                    borderColor: '#fde047',
                    backgroundColor: 'rgba(253, 224, 71, 0.1)',
                    borderWidth: 4,
                    fill: true,
                    tension: 0,
                    stepped: true,
                    pointStyle: 'rect',
                    pointRadius: 5,
                    pointHoverRadius: 7,
                    pointBackgroundColor: '#fde047',
                    pointBorderColor: '#000',
                    pointBorderWidth: 1
                }]
            },
            options: {
                responsive: true, maintainAspectRatio: false,
                plugins: {
                    legend: { display: false },
                    tooltip: {
                        titleFont: { family: 'VT323', size: 18 },
                        bodyFont: { family: 'VT323', size: 16 },
                        callbacks: {
                            title: (items) => {
                                const dataObj = chartDataHistory[items[0].dataIndex];
                                return `Game ${items[0].dataIndex + 1}: vs ${dataObj.opp}`;
                            },
                            label: (ctx) => `Total Run Diff: ${ctx.raw > 0 ? '+' : ''}${ctx.raw} runs`
                        }
                    }
                },
                scales: {
                    x: { grid: { color: 'rgba(255,255,255,0.1)' }, ticks: { color: '#9ca3af', font: { family: 'VT323', size: 16 } } },
                    y: { grid: { color: 'rgba(255,255,255,0.1)' }, ticks: { color: '#9ca3af', font: { family: 'VT323', size: 16 } } }
                }
            }
        };
    } else if (activeTab === 'runs-compare') {
        config = {
            type: 'bar',
            data: {
                labels: labels,
                datasets: [
                    {
                        label: 'Runs Scored (PF)',
                        data: chartDataHistory.map(d => d.pf),
                        backgroundColor: '#064e3b',
                        borderRadius: 2
                    },
                    {
                        label: 'Runs Allowed (PA)',
                        data: chartDataHistory.map(d => d.pa),
                        backgroundColor: '#b91c1c',
                        borderRadius: 2
                    }
                ]
            },
            options: {
                responsive: true, maintainAspectRatio: false,
                plugins: {
                    legend: {
                        display: true,
                        labels: { color: '#9ca3af', font: { family: 'VT323', size: 16 } }
                    },
                    tooltip: {
                        titleFont: { family: 'VT323', size: 18 },
                        bodyFont: { family: 'VT323', size: 16 },
                        callbacks: {
                            title: (items) => {
                                const dataObj = chartDataHistory[items[0].dataIndex];
                                return `Game ${items[0].dataIndex + 1}: vs ${dataObj.opp}`;
                            }
                        }
                    }
                },
                scales: {
                    x: { grid: { color: 'rgba(255,255,255,0.1)' }, ticks: { color: '#9ca3af', font: { family: 'VT323', size: 16 } } },
                    y: { grid: { color: 'rgba(255,255,255,0.1)' }, ticks: { color: '#9ca3af', font: { family: 'VT323', size: 16 } }, beginAtZero: true }
                }
            }
        };
    } else if (activeTab === 'elo-trend') {
        config = {
            type: 'line',
            data: {
                labels: labels,
                datasets: [{
                    label: 'Power Score (Elo)',
                    data: chartDataHistory.map(d => d.elo),
                    borderColor: '#a855f7',
                    backgroundColor: 'rgba(168, 85, 247, 0.1)',
                    borderWidth: 4,
                    fill: true,
                    tension: 0,
                    stepped: true,
                    pointStyle: 'rect',
                    pointRadius: 5,
                    pointHoverRadius: 7,
                    pointBackgroundColor: '#a855f7',
                    pointBorderColor: '#000',
                    pointBorderWidth: 1
                }]
            },
            options: {
                responsive: true, maintainAspectRatio: false,
                plugins: {
                    legend: { display: false },
                    tooltip: {
                        titleFont: { family: 'VT323', size: 18 },
                        bodyFont: { family: 'VT323', size: 16 },
                        callbacks: {
                            title: (items) => {
                                const dataObj = chartDataHistory[items[0].dataIndex];
                                return `Game ${items[0].dataIndex + 1}: vs ${dataObj.opp}`;
                            },
                            label: (ctx) => `Elo: ${ctx.raw}`
                        }
                    }
                },
                scales: {
                    x: { grid: { color: 'rgba(255,255,255,0.1)' }, ticks: { color: '#9ca3af', font: { family: 'VT323', size: 16 } } },
                    y: { grid: { color: 'rgba(255,255,255,0.1)' }, ticks: { color: '#9ca3af', font: { family: 'VT323', size: 16 } } }
                }
            }
        };
    } else if (activeTab === 'pyth-trend') {
        let cumPf = 0;
        let cumPa = 0;
        const pythData = chartDataHistory.map(d => {
            cumPf += d.pf;
            cumPa += d.pa;
            if (cumPf + cumPa === 0) return 50;
            const pct = (Math.pow(cumPf, 2)) / (Math.pow(cumPf, 2) + Math.pow(cumPa, 2));
            return Math.round(pct * 100);
        });
        
        config = {
            type: 'line',
            data: {
                labels: labels,
                datasets: [{
                    label: 'Pythagorean True %',
                    data: pythData,
                    borderColor: '#10b981',
                    backgroundColor: 'rgba(16, 185, 129, 0.1)',
                    borderWidth: 4,
                    fill: true,
                    tension: 0,
                    stepped: true,
                    pointStyle: 'rect',
                    pointRadius: 5,
                    pointHoverRadius: 7,
                    pointBackgroundColor: '#10b981',
                    pointBorderColor: '#000',
                    pointBorderWidth: 1
                }]
            },
            options: {
                responsive: true, maintainAspectRatio: false,
                plugins: {
                    legend: { display: false },
                    tooltip: {
                        titleFont: { family: 'VT323', size: 18 },
                        bodyFont: { family: 'VT323', size: 16 },
                        callbacks: {
                            title: (items) => {
                                const dataObj = chartDataHistory[items[0].dataIndex];
                                return `Game ${items[0].dataIndex + 1}: vs ${dataObj.opp}`;
                            },
                            label: (ctx) => `Pyth Win %: ${ctx.raw}%`
                        }
                    }
                },
                scales: {
                    x: { grid: { color: 'rgba(255,255,255,0.1)' }, ticks: { color: '#9ca3af', font: { family: 'VT323', size: 16 } } },
                    y: { grid: { color: 'rgba(255,255,255,0.1)' }, ticks: { color: '#9ca3af', font: { family: 'VT323', size: 16 } }, suggestedMin: 0, suggestedMax: 100 }
                }
            }
        };
    }
    
    biasChartInstance = new Chart(ctx, config);
}

// Modals & Trending logic
window.closeModals = function() {
    document.getElementById('modal-overlay').classList.remove('active');
    document.querySelectorAll('.modal').forEach(m => m.classList.remove('active'));
}

function getTrendHTML(historyArray) {
    if (historyArray.length === 0) return '<span style="color:#9ca3af">-</span>';
    const last = historyArray[historyArray.length - 1];
    if (last === 'w') return '<span style="color:#22c55e">▲</span>';
    if (last === 'l') return '<span style="color:#f43f5e">▼</span>';
    return '<span style="color:#9ca3af">-</span>';
}

function openVitalsModal() {
    const s = teamStates[selectedTeam];
    let pyth = 0;
    if (s.pf + s.pa > 0) pyth = (Math.pow(s.pf, 2)) / (Math.pow(s.pf, 2) + Math.pow(s.pa, 2));
    
    document.getElementById('vitals-team-name').innerText = selectedTeam.replace('Majors ', '');
    document.getElementById('vitals-record').innerText = `${s.w}-${s.l}-${s.t}`;
    document.getElementById('vitals-elo').innerText = s.elo;
    document.getElementById('vitals-elo-trend').innerHTML = getTrendHTML(s.history);
    document.getElementById('vitals-pf').innerText = s.pf;
    document.getElementById('vitals-pa').innerText = s.pa;
    document.getElementById('vitals-pyth').innerText = `${(pyth*100).toFixed(1)}%`;
    document.getElementById('vitals-pyth-trend').innerHTML = getTrendHTML(s.history); // Trend aligns with W/L
    
    // Dynamic Summary
    const tName = selectedTeam.replace('Majors ', '');
    let summary = "";
    if (s.w === 0 && s.l === 0) summary = `The ${tName} are waiting to kick off their season. Anticipation is high!`;
    else {
        let tone = "holding steady";
        if (s.w > s.l + 2) tone = "dominating the division";
        if (s.l > s.w + 2) tone = "struggling to find their rhythm";
        
        let streakText = "";
        if (s.streak >= 3) streakText = `, riding a massive ${s.streak}-game win streak`;
        if (s.streak <= -3) streakText = `, desperately needing to break a ${Math.abs(s.streak)}-game slide`;

        let expectedText = "";
        if (pyth > 0.6 && s.w <= s.l) expectedText = ` Despite their record, their underlying stats (Pythagorean Expectation) suggest they've been incredibly unlucky and should bounce back soon.`;
        if (pyth < 0.4 && s.w >= s.l) expectedText = ` They've been winning close games, but their run differential suggests regression might be coming.`;

        summary = `The ${tName} are currently ${tone} with a ${s.w}-${s.l} record${streakText}.${expectedText}`;
    }
    document.getElementById('vitals-summary').innerText = summary;

    document.getElementById('modal-overlay').classList.add('active');
    document.getElementById('vitals-modal').classList.add('active');
}

function showModal(title, html) {
    document.getElementById('generic-modal-title').innerText = title;
    document.getElementById('generic-modal-body').innerHTML = html;
    document.getElementById('modal-overlay').classList.add('active');
    document.getElementById('generic-modal').classList.add('active');
}

function openNotebookModal() {
    const feed = document.getElementById('notebook-feed');
    feed.innerHTML = '';
    
    let hasNotes = false;
    for (let i = 0; i < globalGameCursor; i++) {
        const g = allGames[i];
        if (g.played && g.note && (g.team1 === selectedTeam || g.team2 === selectedTeam)) {
            hasNotes = true;
            const isT1 = g.team1 === selectedTeam;
            const opp = (isT1 ? g.team2 : g.team1).replace('Majors ', '');
            const res = (isT1 ? g.score1 > g.score2 : g.score2 > g.score1) ? 'W' : 'L';
            const s = document.createElement('div');
            s.style.marginBottom = '1rem';
            s.style.borderBottom = '1px solid rgba(255,255,255,0.1)';
            s.style.paddingBottom = '0.5rem';
            s.innerHTML = `<strong>vs ${opp} (${res}) - ${new Date(g.date).toLocaleDateString()}</strong><br><em>"${g.note}"</em>`;
            feed.appendChild(s);
        }
    }
    
    if (!hasNotes) feed.innerHTML = '<p>No game notes recorded yet. Add notes when saving manual scores during the post-season!</p>';
    
    document.getElementById('modal-overlay').classList.add('active');
    document.getElementById('notebook-modal').classList.add('active');
}

function openStandingsModal() {
    const sorted = teamNames.map(t => ({ name: t, stats: teamStates[t] }))
                            .sort((a,b) => b.stats.elo - a.stats.elo);
                            
    const tbody = document.getElementById('standings-body');
    tbody.innerHTML = '';
    sorted.forEach((row, i) => {
        const tr = document.createElement('tr');
        if (row.name === selectedTeam) tr.style.background = 'rgba(255,255,255,0.1)';
        tr.innerHTML = `
            <td>${i+1}</td>
            <td>${getTrendHTML(row.stats.history)}</td>
            <td><strong>${row.name.replace('Majors ', '')}</strong></td>
            <td>${row.stats.elo}</td>
            <td>${row.stats.w}-${row.stats.l}-${row.stats.t}</td>
        `;
        tbody.appendChild(tr);
    });
    
    document.getElementById('modal-overlay').classList.add('active');
    document.getElementById('standings-modal').classList.add('active');
}
