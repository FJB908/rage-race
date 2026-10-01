document.addEventListener('DOMContentLoaded', () => {
    const app = document.querySelector('.app');
    const heading = document.createElement('h1');
    heading.className = 'heading';
    heading.textContent = 'Hallo!';
    app.appendChild(heading);
});
