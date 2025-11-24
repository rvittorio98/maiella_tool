// Sliders
window.addEventListener('DOMContentLoaded', () => {
    const sliders = document.querySelectorAll('input[type="range"]');
    
    sliders.forEach(slider => {
        const valueDisplay = slider.nextElementSibling;
        
        slider.addEventListener('input', function() {
            valueDisplay.textContent = this.value;
        });
    });
});