const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

let score = 0;
let highScore = 0;
let state = 'playing'; // 'playing' tai 'landed'

// Fysiikkavakiot
const GRAVITY = 0.25;
const JUMP_FORCE = -8;
const FLOOR_Y = canvas.height - 40;

// Säkkituolin ominaisuudet
const beanbag = {
    x: canvas.width / 2,
    y: 100,
    width: 80,
    height: 50,
    vx: 0,
    vy: 0,
    angle: 0,
    angularVelocity: 0,
    
    reset() {
        this.y = 100;
        this.vy = 0;
        this.angle = 0;
        this.angularVelocity = 0;
    },
    
    jump() {
        this.vy = JUMP_FORCE;
        // Satunnainen pyörimisnopeus -0.15 ja 0.15 välillä
        const spinDirection = Math.random() > 0.5 ? 1 : -1;
        this.angularVelocity = spinDirection * (0.08 + Math.random() * 0.12);
    }
};

function inputAction() {
    if (state === 'landed') {
        beanbag.reset();
        state = 'playing';
    }
    beanbag.jump();
}

window.addEventListener('keydown', (e) => {
    if (e.code === 'Space') {
        e.preventDefault();
        inputAction();
    }
});
canvas.addEventListener('mousedown', inputAction);

function checkLanding() {
    // Normalisoi kulma välille -PI ja PI
    let normalizedAngle = Math.atan2(Math.sin(beanbag.angle), Math.cos(beanbag.angle));
    
    // Tarkistetaan, onko säkkituoli "oikeinpäin"
    // Sallittu toleranssi on noin 45 astetta (0.785 radiaania)
    const tolerance = 0.8;
    
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
    if (state === 'playing') {
        // Päivitä fysiikka
        beanbag.vy += GRAVITY;
        beanbag.y += beanbag.vy;
        beanbag.angle += beanbag.angularVelocity;

        // Lattia-törmäys
        if (beanbag.y + beanbag.height / 2 >= FLOOR_Y) {
            beanbag.y = FLOOR_Y - beanbag.height / 2;
            state = 'landed';
            checkLanding();
        }
        
        // Katto-törmäys (estetään ruudun yläpuolelle karkaaminen)
        if (beanbag.y - beanbag.height / 2 <= 0) {
            beanbag.y = beanbag.height / 2;
            beanbag.vy = 0;
        }
    }
}

function drawBeanbag() {
    ctx.save();
    ctx.translate(beanbag.x, beanbag.y);
    ctx.rotate(beanbag.angle);
    
    // Säkkituolin runko
    ctx.fillStyle = '#E91E63';
    ctx.beginPath();
    ctx.roundRect(-beanbag.width / 2, -beanbag.height / 2, beanbag.width, beanbag.height, 20);
    ctx.fill();
    ctx.strokeStyle = '#880E4F';
    ctx.lineWidth = 4;
    ctx.stroke();

    // Säkkituolin yläosan merkki (jotta pelaaja näkee mikä on oikeinpäin)
    ctx.fillStyle = '#FFFFFF';
    ctx.beginPath();
    ctx.arc(0, -beanbag.height / 2 + 15, 8, 0, Math.PI * 2);
    ctx.fill();

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

    // Säkkituoli
    drawBeanbag();

    // UI-tekstit
    ctx.fillStyle = '#000';
    ctx.font = 'bold 28px sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText(`Pisteet: ${score}`, 20, 40);
    ctx.fillText(`Ennätys: ${highScore}`, 20, 80);

    if (state === 'landed') {
        ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        
        ctx.fillStyle = '#FFF';
        ctx.textAlign = 'center';
        
        let normalizedAngle = Math.atan2(Math.sin(beanbag.angle), Math.cos(beanbag.angle));
        if (Math.abs(normalizedAngle) <= 0.8) {
            ctx.fillStyle = '#4CAF50';
            ctx.font = 'bold 48px sans-serif';
            ctx.fillText('HIENOSTI!', canvas.width / 2, canvas.height / 2 - 30);
        } else {
            ctx.fillStyle = '#F44336';
            ctx.font = 'bold 48px sans-serif';
            ctx.fillText('TULI NENILLEEN!', canvas.width / 2, canvas.height / 2 - 30);
        }
        
        ctx.fillStyle = '#FFF';
        ctx.font = '24px sans-serif';
        ctx.fillText('Paina välilyöntiä tai klikkaa ruutua yrittääksesi uudelleen.', canvas.width / 2, canvas.height / 2 + 30);
    }
}

function gameLoop() {
    update();
    draw();
    requestAnimationFrame(gameLoop);
}

// Käynnistä peli
gameLoop();