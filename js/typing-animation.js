// Typing Animation
const TYPING_SPEED = 5;

const codeText = `FILL(0, 41, 0)
BACKGROUND(#FFFFFF)
BEGIN_SHAPE()
FOR(VAR I = 0; I < 15; I++){
  CURVEVERTEX(POSITIONS[I][0], POSITIONS[I][1]);
  // VERTEX(POSITIONS[I][0]+20,
  POSITIONS[I][1]+20;
}`;

let currentIndex = 0;
const codeElement = document.querySelector('.code-text');

function typeCode() {
    if (currentIndex < codeText.length) {
        codeElement.textContent += codeText[currentIndex];
        currentIndex++;
        setTimeout(typeCode, TYPING_SPEED);
    } else {
        currentIndex = 0;
        typeCode();
    }
}

window.addEventListener('DOMContentLoaded', () => {
    if (codeElement) typeCode();
});