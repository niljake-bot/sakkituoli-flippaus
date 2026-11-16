const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

let score = 0;
let highScore = 0;
let state = 'start'; // 'start', 'charging', 'playing', 'landed'

let chargeAmount = 0;
let chargeDirection = 1;
const CHARGE_SPEED = 2; // Sopiva nopeus, jotta ehtii reagoida

// Fysiikkavakiot
const GRAVITY = 0.25; // Pienempi painovoima tekee heitosta leijuvamman
const FLOOR_Y = canvas.height - 40;
const LANDING_TOLERANCE = 0.78; // Noin 45 astetta

// Säkkituolin ominaisuudet
const beanbag = {
    x: canvas.width / 2,
    y: FLOOR_Y - 40, 
    width: 120,
    height: 80, // Visuaalinen korkeus (40 ylös ja 40 alas keskipisteestä)
    vx: 0,
    vy: 0,
    angle: 0,
    angularVelocity: 0,
    
    reset() {
        this.y = FLOOR_Y - 40;
        this.vy = 0;
        this.angle = 0;
        this.angularVelocity = 0;
    },
    
    jump(charge) {
        const chargeRatio = charge / 100;
        // Pienemmät nopeudet ja pyöriminen hitaamman painovoiman vuoksi
        this.vy = -7 - (chargeRatio * 11); // -7 ... -18
        this.angularVelocity = 0.05 + (chargeRatio * 0.12); // 0.05 ... 0.17
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
    
    if (Math.abs(normalizedAngle) <= LANDING_TOLERANCE) {
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
        if (beanbag.y + 40 >= FLOOR_Y && beanbag.vy > 0) {
            beanbag.y = FLOOR_Y - 40;
            state = 'landed';
            checkLanding();
        }
        
        // Katto-törmäys (estetään ruudun yläpuolelle karkaaminen)
        if (beanbag.y - 40 <= 0) {
            beanbag.y = 40;
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
        ctx.translate(0, 40 * (1 - squish));
    }
    
    // Säkkituolin muoto (suorakaide, mutta löysä / Fatboy-tyylinen)
    ctx.fillStyle = '#E53935'; // Fatboy red
    ctx.strokeStyle = '#B71C1C';
    ctx.lineWidth = 4;
    
    ctx.beginPath();
    // Ylävasen nurkka
    ctx.moveTo(-50, -35);
    // Yläreuna, joka painuu hieman sisään (lötköys)
    ctx.quadraticCurveTo(0, -20, 50, -35);
    // Oikea kylki pullottaa
    ctx.quadraticCurveTo(65, 5, 55, 35);
    // Pohja
    ctx.quadraticCurveTo(0, 45, -55, 35);
    // Vasen kylki pullottaa
    ctx.quadraticCurveTo(-65, 5, -50, -35);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    // Rypyt / taitteet säkkituolin sisällä (lisää lötkön pehmeyden tuntua)
    ctx.strokeStyle = 'rgba(183, 28, 28, 0.4)'; // Läpinäkyvä tumma punainen
    ctx.lineWidth = 2;
    ctx.beginPath();
    // Y-mallinen ryppy / kangastaitos
    ctx.moveTo(-20, 0);
    ctx.quadraticCurveTo(0, 15, 25, 5);
    ctx.moveTo(0, 15);
    ctx.quadraticCurveTo(10, 30, 15, 35);
    ctx.stroke();

    // Fatboy-tyylinen lappu oikealla kyljellä
    ctx.save();
    // Siirrytään oikealle kyljelle
    ctx.translate(58, -10);
    ctx.rotate(0.2); // Pieni kallistus
    ctx.beginPath();
    ctx.rect(0, 0, 30, 14); // Lapun koko
    ctx.fillStyle = '#FFF';
    ctx.fill();
    ctx.strokeStyle = '#333';
    ctx.lineWidth = 1;
    ctx.stroke();
    
    // Lapun teksti
    ctx.fillStyle = '#E53935';
    ctx.font = 'bold 9px Arial';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('fatboy', 15, 7.5);

    ctx.restore();

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
        
        if (Math.abs(normalizedAngle) <= LANDING_TOLERANCE) {
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