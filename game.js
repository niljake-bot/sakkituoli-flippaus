const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

let score = 0;
let highScore = 0;
let state = 'start'; // 'start', 'charging', 'playing', 'landed'

let chargeAmount = 0;
let chargeDirection = 1;
const CHARGE_SPEED = 2; // Sopiva nopeus, jotta ehtii reagoida

// Fysiikkavakiot
const GRAVITY = 0.12; // Vielä hitaampi, pehmeämmin putoava painovoima
const FLOOR_Y = canvas.height - 40;
const LANDING_TOLERANCE = 0.78; // Noin 45 astetta

// Säkkituolin ominaisuudet
const beanbag = {
    x: canvas.width / 2,
    y: FLOOR_Y - 45, 
    width: 150,
    height: 90, // Visuaalinen korkeus (45 ylös ja 45 alas keskipisteestä)
    vx: 0,
    vy: 0,
    angle: 0,
    angularVelocity: 0,
    
    reset() {
        this.y = FLOOR_Y - 45;
        this.vy = 0;
        this.angle = 0;
        this.angularVelocity = 0;
    },
    
    jump(charge) {
        const chargeRatio = charge / 100;
        // Hitaamman painovoiman vuoksi säädetyt voimat pehmeää leijailua varten
        this.vy = -4.5 - (chargeRatio * 6.5); // -4.5 ... -11
        this.angularVelocity = 0.02 + (chargeRatio * 0.05); // 0.02 ... 0.07 (rauhallisempi pyöriminen)
    }
};

function handleInputStart() {
    if (state === 'landed') {
        beanbag.reset();
        state = 'start';
    } else if (state === 'start') {
        beanbag.reset();
        state = 'charging';
        chargeAmount = 0;
        chargeDirection = 1;
    }
}

function handleInputEnd() {
    if (state === 'charging') {
        state = 'playing';
        beanbag.jump(chargeAmount);
    }
}

// Näppäimistö ja hiiri -kuuntelijat
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

canvas.addEventListener('mousedown', handleInputStart);
window.addEventListener('mouseup', handleInputEnd);

canvas.addEventListener('touchstart', (e) => { 
    e.preventDefault(); 
    handleInputStart(); 
}, {passive: false});
window.addEventListener('touchend', (e) => { 
    e.preventDefault(); 
    handleInputEnd(); 
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
        if (beanbag.y + 45 >= FLOOR_Y && beanbag.vy > 0) {
            beanbag.y = FLOOR_Y - 45;
            state = 'landed';
            checkLanding();
        }
        
        // Katto-törmäys (estetään ruudun yläpuolelle karkaaminen)
        if (beanbag.y - 45 <= 0) {
            beanbag.y = 45;
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
        ctx.translate(0, 45 * (1 - squish));
    }
    
    // Säkkituolin muoto (leveä, vaakatason Fatboy Original, n. 140x90 tyylinen)
    ctx.fillStyle = '#E53935'; // Fatboy red
    ctx.strokeStyle = '#B71C1C';
    ctx.lineWidth = 6; // Paksut saumat
    
    ctx.beginPath();
    ctx.moveTo(-65, -40); // Vasen ylä
    ctx.quadraticCurveTo(0, -25, 65, -40); // Yläreuna (lötkö, hieman roikkuu keskeltä)
    ctx.quadraticCurveTo(75, -40, 75, -20); // Oikea yläkulma
    ctx.quadraticCurveTo(85, 0, 75, 20); // Oikea kylki pullottaa
    ctx.quadraticCurveTo(75, 40, 65, 40); // Oikea alakulma
    ctx.quadraticCurveTo(0, 45, -65, 40); // Alareuna
    ctx.quadraticCurveTo(-75, 40, -75, 20); // Vasen alakulma
    ctx.quadraticCurveTo(-85, 0, -75, -20); // Vasen kylki pullottaa
    ctx.quadraticCurveTo(-75, -40, -65, -40); // Vasen yläkulma
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    // Piirretään sauman/tikkauksen efekti reunoille
    ctx.save();
    ctx.strokeStyle = '#FFCDD2'; // Vaaleampi "lanka"
    ctx.lineWidth = 1.5;
    ctx.setLineDash([6, 4]); // Katkoviiva tikkaukselle
    ctx.stroke();
    ctx.restore();

    // Rypyt / taitteet säkkituolin sisällä (lisää lötkön pehmeyden tuntua)
    ctx.strokeStyle = 'rgba(183, 28, 28, 0.4)'; // Läpinäkyvä tumma punainen
    ctx.lineWidth = 2;
    ctx.beginPath();
    // Iso diagonaalinen kangastaitos
    ctx.moveTo(-40, -10);
    ctx.quadraticCurveTo(-10, 15, 30, 5);
    ctx.moveTo(-15, 15);
    ctx.quadraticCurveTo(10, 35, 15, 30);
    ctx.stroke();

    // Hymiö ja suuntanuoli helpottamaan asennon hahmottamista ilmassa
    ctx.save();
    // Silmät
    ctx.fillStyle = '#FFF';
    ctx.strokeStyle = '#333';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(-20, -5, 8, 0, Math.PI * 2);
    ctx.arc(20, -5, 8, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    // Pupillit
    ctx.fillStyle = '#333';
    ctx.beginPath();
    ctx.arc(-20, -5, 3, 0, Math.PI * 2);
    ctx.arc(20, -5, 3, 0, Math.PI * 2);
    ctx.fill();
    // Hymy
    ctx.beginPath();
    ctx.arc(0, 5, 12, 0.1 * Math.PI, 0.9 * Math.PI);
    ctx.stroke();
    
    // Suuntanuoli ylös (selkeyttää yläpuolta entisestään)
    ctx.beginPath();
    ctx.moveTo(0, -30);
    ctx.lineTo(-8, -20);
    ctx.lineTo(-3, -20);
    ctx.lineTo(-3, -15);
    ctx.lineTo(3, -15);
    ctx.lineTo(3, -20);
    ctx.lineTo(8, -20);
    ctx.closePath();
    ctx.fillStyle = 'rgba(255, 255, 255, 0.8)';
    ctx.fill();
    ctx.stroke();
    ctx.restore();

    // Fatboy-tyylinen iso valkoinen kangasmerkki oikealla kyljellä
    ctx.save();
    // Siirrytään oikealle kyljelle, sauman ulkopuolelle
    ctx.translate(76, -10);
    ctx.rotate(0.15); // Pieni kallistus
    ctx.beginPath();
    ctx.rect(0, -16, 64, 32); // Suurennettu, aiemmin 48x24
    ctx.fillStyle = '#FFF';
    ctx.fill();
    ctx.strokeStyle = '#333';
    ctx.lineWidth = 2;
    ctx.stroke();
    
    // Lapun teksti ("fatboy")
    ctx.fillStyle = '#E53935';
    ctx.font = 'bold 16px Arial';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('fatboy', 32, 0);

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
        const barY = beanbag.y - 85; // Säädetty ylemmäs litteämmän ja laajemman säkkituolin vuoksi
        
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
        ctx.fillText('Paina välilyöntiä (tai klikkaa) jatkaaksesi.', canvas.width / 2, canvas.height / 2 + 30);
    }
}

function gameLoop() {
    update();
    draw();
    requestAnimationFrame(gameLoop);
}

// Käynnistä peli
gameLoop();