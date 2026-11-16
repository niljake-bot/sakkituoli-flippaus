const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

let score = 0;
let highScore = 0;
let state = 'start'; // 'start', 'charging', 'playing', 'landed'

let chargeAmount = 0;
let chargeDirection = 1;
const CHARGE_SPEED = 2; // Sopiva nopeus, jotta ehtii reagoida

// Fysiikkavakiot
const GRAVITY = 0.5;
const FLOOR_Y = canvas.height - 40;

// Säkkituolin ominaisuudet
const beanbag = {
    x: canvas.width / 2,
    y: FLOOR_Y - 35, 
    width: 80,
    height: 70, // Visuaalinen korkeus (35 ylös ja 35 alas keskipisteestä)
    vx: 0,
    vy: 0,
    angle: 0,
    angularVelocity: 0,
    
    reset() {
        this.y = FLOOR_Y - 35;
        this.vy = 0;
        this.angle = 0;
        this.angularVelocity = 0;
    },
    
    jump(charge) {
        const chargeRatio = charge / 100;
        // Kulman ja vauhdin lineaarinen säätö tekee tietyistä latauksista "sweet spotteja"
        this.vy = -10 - (chargeRatio * 15); // -10 ... -25
        this.angularVelocity = 0.1 + (chargeRatio * 0.15); // 0.1 ... 0.25
    }
};

function startCharge() {
    if (state === 'start' || state === 'landed') {
        beanbag.reset();
        state = 'charging';
        chargeAmount = 0;
        chargeDirection = 1;
    }
}

function releaseCharge() {
    if (state === 'charging') {
        state = 'playing';
        beanbag.jump(chargeAmount);
    }
}

// Näppäimistö ja hiiri -kuuntelijat
window.addEventListener('keydown', (e) => {
    if (e.code === 'Space' && !e.repeat) {
        e.preventDefault();
        startCharge();
    }
});
window.addEventListener('keyup', (e) => {
    if (e.code === 'Space') {
        e.preventDefault();
        releaseCharge();
    }
});

canvas.addEventListener('mousedown', startCharge);
window.addEventListener('mouseup', releaseCharge);

canvas.addEventListener('touchstart', (e) => { 
    e.preventDefault(); 
    startCharge(); 
}, {passive: false});
window.addEventListener('touchend', (e) => { 
    e.preventDefault(); 
    releaseCharge(); 
});

function checkLanding() {
    // Normalisoi kulma välille -PI ja PI
    let normalizedAngle = Math.atan2(Math.sin(beanbag.angle), Math.cos(beanbag.angle));
    
    // Sallittu toleranssi on noin 35 astetta (0.6 radiaania)
    const tolerance = 0.6;
    
    if (Math.abs(normalizedAngle) <= tolerance) {
        score++;
        if (score > highScore) {
            highScore = score;
        }
        return true;
    } else {
        score = 0;
        return false;
    }
}

function update() {
    if (state === 'charging') {
        chargeAmount += CHARGE_SPEED * chargeDirection;
        if (chargeAmount >= 100) {
            chargeAmount = 100;
            chargeDirection = -1; // Sahalaita-efekti (menee edestakaisin)
        } else if (chargeAmount <= 0) {
            chargeAmount = 0;
            chargeDirection = 1;
        }
    } else if (state === 'playing') {
        // Päivitä fysiikka
        beanbag.vy += GRAVITY;
        beanbag.y += beanbag.vy;
        beanbag.angle += beanbag.angularVelocity;

        // Lattia-törmäys
        if (beanbag.y + 35 >= FLOOR_Y && beanbag.vy > 0) {
            beanbag.y = FLOOR_Y - 35;
            state = 'landed';
            checkLanding();
        }
        
        // Katto-törmäys (estetään ruudun yläpuolelle karkaaminen)
        if (beanbag.y - 35 <= 0) {
            beanbag.y = 35;
            beanbag.vy = 0;
        }
    }
}

function drawBeanbag() {
    ctx.save();
    ctx.translate(beanbag.x, beanbag.y);
    ctx.rotate(beanbag.angle);
    
    // Rutistusefekti kun ladataan hyppyä
    if (state === 'charging') {
        const squish = 1 - (chargeAmount / 100) * 0.25; // max 25% litistys
        ctx.scale(1 + (1 - squish), squish);
        // Siirretään alaspäin, jotta pohja pysyy lattiassa litistyessä
        ctx.translate(0, 35 * (1 - squish));
    }
    
    // Säkkituolin muoto (pisaramainen, leveämpi alhaalta)
    ctx.fillStyle = '#E91E63'; // Pehmeä pinkki
    ctx.strokeStyle = '#880E4F';
    ctx.lineWidth = 4;
    
    ctx.beginPath();
    ctx.moveTo(0, -30); // Yläosa
    ctx.bezierCurveTo(25, -30, 40, 0, 40, 20); // Oikea kylki
    ctx.bezierCurveTo(40, 40, -40, 40, -40, 20); // Pohja
    ctx.bezierCurveTo(-40, 0, -25, -30, 0, -30); // Vasen kylki
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    // Rypyt / taitteet säkkituolin sisällä (lisää pehmeyden tuntua)
    ctx.strokeStyle = 'rgba(136, 14, 79, 0.4)'; // Läpinäkyvä tumma pinkki
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(-15, 10);
    ctx.quadraticCurveTo(0, 20, 15, 5);
    ctx.moveTo(-20, -5);
    ctx.quadraticCurveTo(-10, 0, -5, -15);
    ctx.stroke();

    // Säkkituolin yläosan kahva/nuppi (tärkeä suunnan tunnistamiseksi)
    ctx.fillStyle = '#C2185B';
    ctx.beginPath();
    ctx.arc(0, -32, 6, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#880E4F';
    ctx.lineWidth = 2;
    ctx.stroke();

    ctx.restore();
}

function draw() {
    // Tausta
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    // Lattia
    ctx.fillStyle = '#4CAF50';
    ctx.fillRect(0, FLOOR_Y, canvas.width, canvas.height - FLOOR_Y);
    ctx.fillStyle = '#388E3C';
    ctx.fillRect(0, FLOOR_Y, canvas.width, 10);

    // Latauspalkki (jos ladataan)
    if (state === 'charging') {
        const barWidth = 100;
        const barHeight = 12;
        const barX = beanbag.x - barWidth / 2;
        const barY = beanbag.y - 65;
        
        // Palkin tausta
        ctx.fillStyle = 'rgba(255, 255, 255, 0.5)';
        ctx.fillRect(barX, barY, barWidth, barHeight);
        
        // Täyttyvä osuus
        // Väri muuttuu varauksesta (vihreä -> keltainen -> punainen)
        const red = Math.min(255, (chargeAmount / 50) * 255);
        const green = Math.min(255, ((100 - chargeAmount) / 50) * 255);
        ctx.fillStyle = `rgb(${red}, ${green}, 0)`;
        ctx.fillRect(barX, barY, barWidth * (chargeAmount / 100), barHeight);
        
        // Reunukset
        ctx.strokeStyle = '#222';
        ctx.lineWidth = 2;
        ctx.strokeRect(barX, barY, barWidth, barHeight);
    }

    // Säkkituoli
    drawBeanbag();

    // UI-tekstit
    ctx.fillStyle = '#000';
    ctx.font = 'bold 28px sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText(`Pisteet: ${score}`, 20, 40);
    ctx.fillText(`Ennätys: ${highScore}`, 20, 80);
    
    if (state === 'start') {
        ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        
        ctx.fillStyle = '#FFF';
        ctx.textAlign = 'center';
        ctx.font = 'bold 36px sans-serif';
        ctx.fillText('Paina ja pidä välilyöntiä ladataksesi heiton', canvas.width / 2, canvas.height / 2);
    } else if (state === 'landed') {
        ctx.textAlign = 'center';
        let normalizedAngle = Math.atan2(Math.sin(beanbag.angle), Math.cos(beanbag.angle));
        
        if (Math.abs(normalizedAngle) <= 0.6) {
            ctx.fillStyle = '#4CAF50';
            ctx.font = 'bold 48px sans-serif';
            ctx.fillText('HIENOSTI!', canvas.width / 2, canvas.height / 2 - 30);
        } else {
            ctx.fillStyle = '#F44336';
            ctx.font = 'bold 48px sans-serif';
            ctx.fillText('TULI NENILLEEN!', canvas.width / 2, canvas.height / 2 - 30);
        }
        
        ctx.fillStyle = '#333';
        ctx.font = '24px sans-serif';
        ctx.fillText('Paina ja pidä välilyöntiä yrittääksesi uudelleen.', canvas.width / 2, canvas.height / 2 + 30);
    }
}

function gameLoop() {
    update();
    draw();
    requestAnimationFrame(gameLoop);
}

// Käynnistä peli
gameLoop();