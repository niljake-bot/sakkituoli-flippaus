// Säkkituolin Flippaus - Moderni Nitor-versio
const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

// --- Äänijärjestelmä (Web Audio API) ---
class SoundManager {
    constructor() {
        this.ctx = null;
        this.muted = false;
        this.chargeOsc = null;
        this.chargeGain = null;
    }

    init() {
        if (!this.ctx) {
            const AudioContext = window.AudioContext || window.webkitAudioContext;
            if (AudioContext) {
                this.ctx = new AudioContext();
            }
        }
        if (this.ctx && this.ctx.state === 'suspended') {
            this.ctx.resume();
        }
    }

    startCharge() {
        if (this.muted) return;
        this.init();
        if (!this.ctx) return;
        this.stopCharge();

        this.chargeOsc = this.ctx.createOscillator();
        this.chargeGain = this.ctx.createGain();

        this.chargeOsc.type = 'triangle';
        this.chargeOsc.frequency.setValueAtTime(140, this.ctx.currentTime);
        this.chargeGain.gain.setValueAtTime(0.08, this.ctx.currentTime);

        this.chargeOsc.connect(this.chargeGain);
        this.chargeGain.connect(this.ctx.destination);
        this.chargeOsc.start();
    }

    updateCharge(ratio) {
        if (!this.chargeOsc || !this.ctx || this.muted) return;
        // Nostetaan taajuutta varauksen mukaan
        const targetFreq = 140 + ratio * 320;
        this.chargeOsc.frequency.setTargetAtTime(targetFreq, this.ctx.currentTime, 0.05);
    }

    stopCharge() {
        if (this.chargeOsc) {
            try {
                this.chargeOsc.stop();
                this.chargeOsc.disconnect();
            } catch (e) {}
            this.chargeOsc = null;
        }
    }

    playJump() {
        if (this.muted) return;
        this.init();
        if (!this.ctx) return;

        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();

        osc.type = 'sine';
        osc.frequency.setValueAtTime(450, this.ctx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(120, this.ctx.currentTime + 0.28);

        gain.gain.setValueAtTime(0.25, this.ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + 0.28);

        osc.connect(gain);
        gain.connect(this.ctx.destination);

        osc.start();
        osc.stop(this.ctx.currentTime + 0.28);
    }

    playLandSuccess(flips) {
        if (this.muted) return;
        this.init();
        if (!this.ctx) return;

        // Iloinen sointu: C-duuri tai enemmän nuotteja flippien määrän mukaan
        const freqs = flips >= 3 ? [523.25, 659.25, 783.99, 1046.50] : 
                      flips >= 2 ? [523.25, 659.25, 783.99] : 
                                   [523.25, 659.25];

        freqs.forEach((freq, idx) => {
            const osc = this.ctx.createOscillator();
            const gain = this.ctx.createGain();

            osc.type = 'triangle';
            osc.frequency.setValueAtTime(freq, this.ctx.currentTime + idx * 0.07);

            gain.gain.setValueAtTime(0, this.ctx.currentTime + idx * 0.07);
            gain.gain.linearRampToValueAtTime(0.18, this.ctx.currentTime + idx * 0.07 + 0.02);
            gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + idx * 0.07 + 0.5);

            osc.connect(gain);
            gain.connect(this.ctx.destination);

            osc.start(this.ctx.currentTime + idx * 0.07);
            osc.stop(this.ctx.currentTime + idx * 0.07 + 0.55);
        });
    }

    playLandFail() {
        if (this.muted) return;
        this.init();
        if (!this.ctx) return;

        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();

        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(130, this.ctx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(45, this.ctx.currentTime + 0.35);

        gain.gain.setValueAtTime(0.2, this.ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + 0.35);

        osc.connect(gain);
        gain.connect(this.ctx.destination);

        osc.start();
        osc.stop(this.ctx.currentTime + 0.35);
    }

    toggleMute() {
        this.muted = !this.muted;
        if (this.muted) this.stopCharge();
        return this.muted;
    }
}

const sounds = new SoundManager();

// Ääninapin logiikka
const soundToggleBtn = document.getElementById('soundToggle');
const soundIcon = document.getElementById('soundIcon');
if (soundToggleBtn) {
    soundToggleBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        const isMuted = sounds.toggleMute();
        soundIcon.textContent = isMuted ? '🔇' : '🔊';
    });
}

// --- Kuvien lataus ---
const frontImg = new Image();
frontImg.src = typeof BEANBAG_FRONT_SRC !== 'undefined' ? BEANBAG_FRONT_SRC : 'beanbag_front.png';

const backImg = new Image();
backImg.src = typeof BEANBAG_BACK_SRC !== 'undefined' ? BEANBAG_BACK_SRC : 'beanbag_back.png';

// --- Pelin tilat ja vakiot ---
let score = 0;
let highScore = 0;
let streak = 0;
let state = 'start'; // 'start', 'charging', 'playing', 'landed'

let chargeAmount = 0;
let chargeDirection = 1;
const CHARGE_SPEED = 0.85;

// Fysiikkavakiot
const GRAVITY = 0.22;
const FLOOR_Y = 515;
const LANDING_TOLERANCE = 0.52; // Noin 30 astetta

// Ruudun tärinä
let screenShake = 0;

// Partikkelit (konfetti & pöly)
let particles = [];

// Laskutumisteksti ja tiedot
let landingResult = {
    text: '',
    subtext: '',
    success: false,
    flips: 0,
    side: 'front'
};

// --- Säkkituolin olento ---
const beanbag = {
    x: canvas.width / 2,
    y: FLOOR_Y - 82.5,
    width: 105,
    height: 165,
    vx: 0,
    vy: 0,
    angle: 0,
    angularVelocity: 0,
    totalAngle: 0,
    twistAngle: 0,
    twistVelocity: 0,
    landingSquish: 0,
    settleAngle: 0,

    reset() {
        this.x = canvas.width / 2;
        this.y = FLOOR_Y - this.height / 2;
        this.vx = 0;
        this.vy = 0;
        this.angle = 0;
        this.angularVelocity = 0;
        this.totalAngle = 0;
        this.twistAngle = 0;
        this.twistVelocity = 0;
        this.landingSquish = 0;
        this.settleAngle = 0;
    },

    jump(charge) {
        const ratio = charge / 100;
        // Hyppyvoima skaalautuu 0-100%
        this.vy = -5.8 - (ratio * 7.6);
        // Pyörimisnopeus: sidottu tarkasti hyppyyn, jotta syntyy selkeät flippivyöhykkeet
        this.angularVelocity = 0.045 + (ratio * 0.125);
        this.twistVelocity = this.angularVelocity * 0.5; // 3D-kääntymisnopeus
        this.totalAngle = 0;

        // Pölypöllähdys lattiasta lähtiessä
        spawnDustPuff(this.x, FLOOR_Y, 8);
        sounds.playJump();
    }
};

// --- Partikkelit ---
function spawnConfetti(x, y, count = 35) {
    const colors = ['#38bdf8', '#fbbf24', '#f43f5e', '#4ade80', '#c084fc', '#ffffff'];
    for (let i = 0; i < count; i++) {
        const angle = Math.random() * Math.PI * 2;
        const speed = 2 + Math.random() * 6;
        particles.push({
            x: x + (Math.random() - 0.5) * 60,
            y: y + (Math.random() - 0.5) * 20,
            vx: Math.cos(angle) * speed,
            vy: Math.sin(angle) * speed - 2.5,
            size: 4 + Math.random() * 5,
            color: colors[Math.floor(Math.random() * colors.length)],
            rotation: Math.random() * Math.PI,
            rotSpeed: (Math.random() - 0.5) * 0.2,
            life: 1.0,
            decay: 0.012 + Math.random() * 0.015,
            type: 'confetti'
        });
    }
}

function spawnDustPuff(x, y, count = 10) {
    for (let i = 0; i < count; i++) {
        particles.push({
            x: x + (Math.random() - 0.5) * 50,
            y: y - 2,
            vx: (Math.random() - 0.5) * 3,
            vy: -Math.random() * 1.5,
            size: 6 + Math.random() * 8,
            color: 'rgba(255, 255, 255, 0.4)',
            life: 1.0,
            decay: 0.03 + Math.random() * 0.02,
            type: 'dust'
        });
    }
}

function updateParticles() {
    for (let i = particles.length - 1; i >= 0; i--) {
        const p = particles[i];
        p.x += p.vx;
        p.y += p.vy;
        p.life -= p.decay;

        if (p.type === 'confetti') {
            p.vy += 0.12; // painovoima
            p.vx *= 0.98;
            p.rotation += p.rotSpeed;
        } else if (p.type === 'dust') {
            p.size += 0.2;
            p.vx *= 0.94;
        }

        if (p.life <= 0) {
            particles.splice(i, 1);
        }
    }
}

function drawParticles() {
    particles.forEach(p => {
        ctx.save();
        ctx.globalAlpha = Math.max(0, p.life);
        if (p.type === 'confetti') {
            ctx.translate(p.x, p.y);
            ctx.rotate(p.rotation);
            ctx.fillStyle = p.color;
            ctx.fillRect(-p.size / 2, -p.size / 2, p.size, p.size * 0.6);
        } else if (p.type === 'dust') {
            ctx.beginPath();
            ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
            ctx.fillStyle = p.color;
            ctx.fill();
        }
        ctx.restore();
    });
}

// --- Ohjaus ---
function handleInputStart() {
    sounds.init();
    if (state === 'landed') {
        beanbag.reset();
        state = 'start';
    } else if (state === 'start') {
        beanbag.reset();
        state = 'charging';
        chargeAmount = 0;
        chargeDirection = 1;
        sounds.startCharge();
    }
}

function handleInputEnd() {
    if (state === 'charging') {
        sounds.stopCharge();
        state = 'playing';
        beanbag.jump(chargeAmount);
    }
}

window.addEventListener('keydown', (e) => {
    if (e.code === 'Space' && !e.repeat) {
        e.preventDefault();
        handleInputStart();
    }
});
window.addEventListener('keyup', (e) => {
    if (e.code === 'Space') {
        e.preventDefault();
        handleInputEnd();
    }
});

canvas.addEventListener('mousedown', (e) => {
    if (e.button === 0) handleInputStart();
});
window.addEventListener('mouseup', (e) => {
    if (e.button === 0) handleInputEnd();
});

canvas.addEventListener('touchstart', (e) => {
    e.preventDefault();
    handleInputStart();
}, { passive: false });
window.addEventListener('touchend', (e) => {
    e.preventDefault();
    handleInputEnd();
});

// --- Laskutumisen tarkastus ---
function checkLanding() {
    let normAngle = Math.atan2(Math.sin(beanbag.angle), Math.cos(beanbag.angle));
    const isUpright = Math.abs(normAngle) <= LANDING_TOLERANCE;
    
    // Lasketaan kuinka monta täyttä 360 kierrosta tehtiin
    const completedFlips = Math.max(1, Math.round(Math.abs(beanbag.totalAngle) / (Math.PI * 2)));
    
    // Tarkistetaan kumpi puoli osoittaa eteenpäin
    const isFrontSide = Math.cos(beanbag.twistAngle) >= 0;
    const sideName = isFrontSide ? 'Taide-kasvot' : 'NITOR-logo';

    if (isUpright) {
        const points = completedFlips;
        score += points;
        streak++;
        if (score > highScore) highScore = score;

        landingResult.success = true;
        landingResult.flips = completedFlips;
        landingResult.side = sideName;

        if (completedFlips === 1) {
            landingResult.text = 'FLIPPI! +1';
        } else if (completedFlips === 2) {
            landingResult.text = 'TUPLAFLIPPI! +2 🔥';
        } else if (completedFlips >= 3) {
            landingResult.text = `TRIPLAFLIPPI! +${points} 🚀`;
        }
        landingResult.subtext = `${sideName} osoittaa ylöspäin!`;

        // Konfettia ja kimmoisa laskeutumisefekti
        spawnConfetti(beanbag.x, FLOOR_Y, 40 + completedFlips * 15);
        spawnDustPuff(beanbag.x, FLOOR_Y, 12);
        beanbag.landingSquish = 0.35;
        beanbag.settleAngle = 0; // suoristuu pystyyn

        sounds.playLandSuccess(completedFlips);
    } else {
        streak = 0;
        score = 0;
        landingResult.success = false;
        landingResult.text = 'TULI NENILLEEN!';
        landingResult.subtext = 'Säkkituoli kellahti nurin. Yritä uudelleen!';

        screenShake = 12;
        spawnDustPuff(beanbag.x, FLOOR_Y, 15);
        beanbag.landingSquish = 0.4;
        // Jätetään säkkituoli kellahtaneeseen asentoon
        beanbag.settleAngle = normAngle > 0 ? Math.PI / 2 : -Math.PI / 2;

        sounds.playLandFail();
    }
}

// --- Päivityslogiikka ---
function update() {
    if (screenShake > 0) {
        screenShake *= 0.88;
        if (screenShake < 0.5) screenShake = 0;
    }

    updateParticles();

    if (state === 'charging') {
        chargeAmount += CHARGE_SPEED * chargeDirection;
        if (chargeAmount >= 100) {
            chargeAmount = 100;
            chargeDirection = -1;
        } else if (chargeAmount <= 0) {
            chargeAmount = 0;
            chargeDirection = 1;
        }
        sounds.updateCharge(chargeAmount / 100);
    } else if (state === 'playing') {
        beanbag.vy += GRAVITY;
        beanbag.y += beanbag.vy;
        
        beanbag.angle += beanbag.angularVelocity;
        beanbag.totalAngle += beanbag.angularVelocity;
        beanbag.twistAngle += beanbag.twistVelocity;

        // Tarkka pohjan etäisyys keskipisteestä kääntyneenä
        const halfW = beanbag.width / 2;
        const halfH = beanbag.height / 2;
        const sinA = Math.sin(beanbag.angle);
        const cosA = Math.cos(beanbag.angle);
        const bottomExtent = halfW * Math.abs(sinA) + halfH * Math.abs(cosA);

        // Lattiatörmäys
        if (beanbag.y + bottomExtent >= FLOOR_Y && beanbag.vy > 0) {
            beanbag.y = FLOOR_Y - bottomExtent;
            state = 'landed';
            checkLanding();
        }

        // Kattoon törmäyksen esto (pehmeä yläraja)
        if (beanbag.y - halfH < 15) {
            beanbag.y = 15 + halfH;
            beanbag.vy = 0.5;
        }
    } else if (state === 'landed') {
        // Palautetaan kimmoisuus pehmeästi
        if (beanbag.landingSquish > 0.005) {
            beanbag.landingSquish *= 0.88;
        } else {
            beanbag.landingSquish = 0;
        }

        // Jos laskeuduttiin onnistuneesti, suoristetaan pystyasentoon pehmeästi
        if (landingResult.success) {
            let currentNorm = Math.atan2(Math.sin(beanbag.angle), Math.cos(beanbag.angle));
            beanbag.angle -= currentNorm * 0.15;
            // Asetetaan pohja tarkasti lattialle
            beanbag.y = FLOOR_Y - beanbag.height / 2;
        }
    }
}

// --- Piirtorutiinit ---

// Huoneen tausta (Moderni Nitor-lounge)
function drawRoomBackground() {
    // Seinän gradientti (tumma, tyylikäs liuskeenharmaa / navy)
    const wallGrad = ctx.createLinearGradient(0, 0, 0, FLOOR_Y);
    wallGrad.addColorStop(0, '#151a24');
    wallGrad.addColorStop(0.5, '#1e2634');
    wallGrad.addColorStop(1, '#273142');
    ctx.fillStyle = wallGrad;
    ctx.fillRect(0, 0, canvas.width, FLOOR_Y);

    // Katto-spotti / pehmeä valokeila keskelle
    const spotGrad = ctx.createRadialGradient(canvas.width / 2, 80, 40, canvas.width / 2, FLOOR_Y, 460);
    spotGrad.addColorStop(0, 'rgba(56, 189, 248, 0.08)');
    spotGrad.addColorStop(0.5, 'rgba(255, 255, 255, 0.03)');
    spotGrad.addColorStop(1, 'rgba(0, 0, 0, 0)');
    ctx.fillStyle = spotGrad;
    ctx.fillRect(0, 0, canvas.width, FLOOR_Y);

    // Jalkalista
    ctx.fillStyle = '#11151f';
    ctx.fillRect(0, FLOOR_Y - 14, canvas.width, 14);
    ctx.fillStyle = 'rgba(255, 255, 255, 0.12)';
    ctx.fillRect(0, FLOOR_Y - 14, canvas.width, 2);

    // Lattia (Lämmin puuparketti / lounge-puulattia)
    const floorGrad = ctx.createLinearGradient(0, FLOOR_Y, 0, canvas.height);
    floorGrad.addColorStop(0, '#3e2c1e');
    floorGrad.addColorStop(0.3, '#322317');
    floorGrad.addColorStop(1, '#1e140d');
    ctx.fillStyle = floorGrad;
    ctx.fillRect(0, FLOOR_Y, canvas.width, canvas.height - FLOOR_Y);

    // Parkettiviivat / lautasaumat
    ctx.strokeStyle = 'rgba(0, 0, 0, 0.35)';
    ctx.lineWidth = 1.5;
    for (let y = FLOOR_Y + 18; y < canvas.height; y += 22) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(canvas.width, y);
        ctx.stroke();
    }
    // Lattian hento heijastusvalo
    ctx.fillStyle = 'rgba(255, 255, 255, 0.04)';
    ctx.fillRect(0, FLOOR_Y, canvas.width, 6);
}

// Säkkituolin varjo lattialla
function drawShadow() {
    const halfH = beanbag.height / 2;
    const distFromFloor = Math.max(0, FLOOR_Y - (beanbag.y + halfH));
    const maxDist = 420;
    const ratio = Math.max(0, Math.min(1, distFromFloor / maxDist));

    // Varjo laajenee ja haalenee ilmassa
    const shadowW = (beanbag.width * 1.05) * (1 - ratio * 0.35);
    const shadowH = 20 * (1 - ratio * 0.4);
    const alpha = 0.45 * (1 - ratio * 0.75);

    ctx.save();
    ctx.beginPath();
    ctx.ellipse(beanbag.x, FLOOR_Y + 4, Math.max(8, shadowW / 2), Math.max(3, shadowH / 2), 0, 0, Math.PI * 2);
    ctx.fillStyle = `rgba(0, 0, 0, ${alpha})`;
    ctx.fill();
    ctx.restore();
}

// Säkkituolin piirto
function drawBeanbag() {
    ctx.save();
    ctx.translate(beanbag.x, beanbag.y);
    ctx.rotate(beanbag.angle);

    const halfW = beanbag.width / 2;
    const halfH = beanbag.height / 2;

    // Rutistus heittoa ladatessa (kumimainen, elastinen painuma)
    if (state === 'charging') {
        const squish = 1 - (chargeAmount / 100) * 0.28;
        const bulge = 1 + (1 - squish) * 0.4;
        ctx.scale(bulge, squish);
        ctx.translate(0, halfH * (1 - squish));
    } else if (beanbag.landingSquish > 0.01) {
        // Laskeutumisen jousitus
        const s = beanbag.landingSquish;
        ctx.scale(1 + s * 0.35, 1 - s * 0.35);
        ctx.translate(0, halfH * (s * 0.35));
    }

    // 3D-kääntymisefekti: skaalataan X-akselilla ja vaihdetaan etu/takakuvaa
    const cosTwist = Math.cos(beanbag.twistAngle);
    const absCos = Math.abs(cosTwist);
    // Säilytetään säkkituolin paksuus vaikka käännytään profiiliin
    const scaleX = absCos * 0.88 + 0.12;
    ctx.scale(scaleX, 1);

    const activeImg = (cosTwist >= 0) ? frontImg : backImg;

    if (activeImg && activeImg.complete && activeImg.naturalWidth > 0) {
        ctx.drawImage(activeImg, -halfW, -halfH, beanbag.width, beanbag.height);
    } else {
        // Varalla oleva vektorigrafiikka jos kuvia ei ehditty ladata
        drawVectorBeanbag(cosTwist >= 0, halfW, halfH);
    }

    // Sauman/paksuuden 3D-korostus profiilissa
    if (absCos < 0.4) {
        ctx.save();
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.4)';
        ctx.lineWidth = 3;
        ctx.strokeRect(-halfW, -halfH, beanbag.width, beanbag.height);
        ctx.restore();
    }

    ctx.restore();
}

// Vektorivarapiirros (jos kuva latautuu hitaasti)
function drawVectorBeanbag(isFront, halfW, halfH) {
    ctx.fillStyle = '#ffffff';
    ctx.strokeStyle = '#cbd5e1';
    ctx.lineWidth = 4;

    ctx.beginPath();
    ctx.moveTo(-halfW + 10, -halfH);
    ctx.lineTo(halfW - 10, -halfH);
    ctx.quadraticCurveTo(halfW, -halfH, halfW, -halfH + 15);
    ctx.quadraticCurveTo(halfW - 5, 0, halfW, halfH - 15);
    ctx.quadraticCurveTo(halfW, halfH, halfW - 10, halfH);
    ctx.lineTo(-halfW + 10, halfH);
    ctx.quadraticCurveTo(-halfW, halfH, -halfW, halfH - 15);
    ctx.quadraticCurveTo(-halfW + 5, 0, -halfW, -halfH + 15);
    ctx.quadraticCurveTo(-halfW, -halfH, -halfW + 10, -halfH);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    if (!isFront) {
        ctx.fillStyle = '#111';
        ctx.font = 'bold 22px Arial';
        ctx.textAlign = 'center';
        ctx.fillText('NITOR', 0, -halfH + 45);
    }
}

// Latausmittari
function drawChargeBar() {
    if (state !== 'charging') return;

    const barWidth = 140;
    const barHeight = 16;
    const barX = beanbag.x - barWidth / 2;
    const barY = beanbag.y - 120;

    ctx.save();

    // Taustalaatikko
    ctx.fillStyle = 'rgba(15, 23, 42, 0.75)';
    ctx.beginPath();
    ctx.roundRect(barX - 4, barY - 4, barWidth + 8, barHeight + 8, 10);
    ctx.fill();
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.2)';
    ctx.lineWidth = 1.5;
    ctx.stroke();

    // Täyttyvä palkki gradientilla
    const fillWidth = barWidth * (chargeAmount / 100);
    if (fillWidth > 2) {
        const grad = ctx.createLinearGradient(barX, 0, barX + barWidth, 0);
        grad.addColorStop(0, '#38bdf8'); // 1 flippi
        grad.addColorStop(0.5, '#facc15'); // 2 flippiä
        grad.addColorStop(1, '#f43f5e'); // 3 flippiä
        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.roundRect(barX, barY, fillWidth, barHeight, 6);
        ctx.fill();
    }

    // Merkkiviivat 1x, 2x ja 3x flipeille
    const tickMarks = [
        { ratio: 0.28, label: '1x' },
        { ratio: 0.62, label: '2x' },
        { ratio: 0.96, label: '3x' }
    ];

    tickMarks.forEach(tick => {
        const tx = barX + barWidth * tick.ratio;
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.7)';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(tx, barY - 2);
        ctx.lineTo(tx, barY + barHeight + 2);
        ctx.stroke();

        ctx.fillStyle = '#cbd5e1';
        ctx.font = 'bold 10px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(tick.label, tx, barY - 7);
    });

    ctx.restore();
}

// Käyttöliittymä (HUD)
function drawHUD() {
    ctx.save();

    // Pisteet ja Ennätys (tyylikäs kortti ylävasemmalla)
    ctx.fillStyle = 'rgba(15, 23, 42, 0.65)';
    ctx.beginPath();
    ctx.roundRect(20, 20, 200, 75, 12);
    ctx.fill();
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.12)';
    ctx.lineWidth = 1;
    ctx.stroke();

    ctx.textAlign = 'left';
    ctx.fillStyle = '#94a3b8';
    ctx.font = '12px sans-serif';
    ctx.fillText('PISTEET', 35, 42);
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 24px sans-serif';
    ctx.fillText(`${score}`, 35, 74);

    ctx.fillStyle = '#94a3b8';
    ctx.font = '12px sans-serif';
    ctx.fillText('ENNÄTYS', 125, 42);
    ctx.fillStyle = '#38bdf8';
    ctx.font = 'bold 24px sans-serif';
    ctx.fillText(`${highScore}`, 125, 74);

    // Putki / Kombo 🔥
    if (streak >= 2) {
        ctx.fillStyle = 'rgba(244, 63, 94, 0.2)';
        ctx.beginPath();
        ctx.roundRect(230, 20, 110, 75, 12);
        ctx.fill();
        ctx.strokeStyle = '#f43f5e';
        ctx.lineWidth = 1.5;
        ctx.stroke();

        ctx.textAlign = 'center';
        ctx.fillStyle = '#fda4af';
        ctx.font = '11px sans-serif';
        ctx.fillText('PUTKI', 285, 42);
        ctx.fillStyle = '#fff';
        ctx.font = 'bold 22px sans-serif';
        ctx.fillText(`${streak}x 🔥`, 285, 74);
    }

    // Alkunäyttö
    if (state === 'start') {
        ctx.fillStyle = 'rgba(10, 14, 23, 0.6)';
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        ctx.textAlign = 'center';
        ctx.fillStyle = '#ffffff';
        ctx.font = 'bold 32px sans-serif';
        ctx.fillText('Paina ja pidä välilyöntiä pohjassa', canvas.width / 2, canvas.height / 2 - 30);

        ctx.fillStyle = '#38bdf8';
        ctx.font = '18px sans-serif';
        ctx.fillText('Tähtää mittari merkkiviivoihin (1x, 2x, 3x flippi) ja vapauta!', canvas.width / 2, canvas.height / 2 + 15);

        ctx.fillStyle = '#94a3b8';
        ctx.font = '14px sans-serif';
        ctx.fillText('(Myös hiiren tai kosketuksen painallus toimii)', canvas.width / 2, canvas.height / 2 + 55);
    } else if (state === 'landed') {
        // Tulosruutu
        ctx.textAlign = 'center';

        if (landingResult.success) {
            ctx.fillStyle = '#22c55e';
            ctx.font = '900 44px sans-serif';
            ctx.fillText(landingResult.text, canvas.width / 2, canvas.height / 2 - 40);

            ctx.fillStyle = '#ffffff';
            ctx.font = 'bold 20px sans-serif';
            ctx.fillText(landingResult.subtext, canvas.width / 2, canvas.height / 2 + 5);
        } else {
            ctx.fillStyle = '#ef4444';
            ctx.font = '900 44px sans-serif';
            ctx.fillText(landingResult.text, canvas.width / 2, canvas.height / 2 - 40);

            ctx.fillStyle = '#cbd5e1';
            ctx.font = '18px sans-serif';
            ctx.fillText(landingResult.subtext, canvas.width / 2, canvas.height / 2 + 5);
        }

        ctx.fillStyle = '#94a3b8';
        ctx.font = '15px sans-serif';
        ctx.fillText('Paina välilyöntiä tai klikkaa jatkaaksesi', canvas.width / 2, canvas.height / 2 + 50);
    }

    ctx.restore();
}

// --- Pääsilmukka ---
function gameLoop() {
    update();

    ctx.save();
    // Ruudun tärinä virheen sattuessa
    if (screenShake > 0) {
        const shakeX = (Math.random() - 0.5) * screenShake;
        const shakeY = (Math.random() - 0.5) * screenShake;
        ctx.translate(shakeX, shakeY);
    }

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    drawRoomBackground();
    drawShadow();
    drawParticles();
    drawBeanbag();
    drawChargeBar();
    drawHUD();

    ctx.restore();

    requestAnimationFrame(gameLoop);
}

// Käynnistä peli
gameLoop();
