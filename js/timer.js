var timerState = {
    running: false,
    startTime: 0,
    elapsed: 0,
    rafId: null,
    active: false,
    holdStart: 0,
    ready: false,
    holdThreshold: 300
};

function formatTimer(ms) {
    var totalSeconds = Math.floor(ms / 1000);
    var minutes = Math.floor(totalSeconds / 60);
    var seconds = totalSeconds % 60;
    var millis = Math.floor(ms % 1000);

    return String(minutes).padStart(2, '0') + ':' +
           String(seconds).padStart(2, '0') + ':' +
           String(millis).padStart(3, '0');
}

function updateTimerDisplay() {
    var display = document.getElementById('timer-display');
    if (!display) return;

    if (timerState.running) {
        timerState.elapsed = performance.now() - timerState.startTime;
    }
    display.textContent = formatTimer(timerState.elapsed);

    if (timerState.running) {
        timerState.rafId = requestAnimationFrame(updateTimerDisplay);
    }
}

function startTimer() {
    if (timerState.running) return;
    var display = document.getElementById('timer-display');
    timerState.running = true;
    timerState.elapsed = 0;
    timerState.startTime = performance.now();
    timerState.rafId = requestAnimationFrame(updateTimerDisplay);
    display.className = 'timer-display running';
}

function stopTimer() {
    if (!timerState.running) return;
    var display = document.getElementById('timer-display');
    timerState.running = false;
    timerState.elapsed = performance.now() - timerState.startTime;
    if (timerState.rafId) {
        cancelAnimationFrame(timerState.rafId);
        timerState.rafId = null;
    }
    updateTimerDisplay();
    display.className = 'timer-display';
}

function resetTimer() {
    var display = document.getElementById('timer-display');
    timerState.running = false;
    timerState.elapsed = 0;
    timerState.ready = false;
    if (timerState.rafId) {
        cancelAnimationFrame(timerState.rafId);
        timerState.rafId = null;
    }
    if (display) {
        display.textContent = formatTimer(0);
        display.className = 'timer-display';
    }
}

function setupTimer() {
    var holdCheckId = null;

    document.addEventListener('keydown', function(e) {
        if (!timerState.active) return;
        if (e.code !== 'Space') return;
        if (e.repeat) return;
        e.preventDefault();
        if (document.activeElement) document.activeElement.blur();

        var display = document.getElementById('timer-display');

        if (timerState.running) {
            stopTimer();
            return;
        }

        // Start holding
        timerState.holdStart = performance.now();
        timerState.ready = false;
        display.className = 'timer-display holding';

        holdCheckId = setInterval(function() {
            if (!timerState.holdStart) {
                clearInterval(holdCheckId);
                return;
            }
            var held = performance.now() - timerState.holdStart;
            if (held >= timerState.holdThreshold && !timerState.ready) {
                timerState.ready = true;
                display.className = 'timer-display ready';
                display.textContent = formatTimer(0);
                clearInterval(holdCheckId);
            }
        }, 16);
    });

    document.addEventListener('keyup', function(e) {
        if (!timerState.active) return;
        if (e.code !== 'Space') return;
        e.preventDefault();

        if (holdCheckId) {
            clearInterval(holdCheckId);
            holdCheckId = null;
        }

        var display = document.getElementById('timer-display');

        if (timerState.running) return;

        if (timerState.ready) {
            timerState.ready = false;
            timerState.holdStart = 0;
            startTimer();
        } else {
            timerState.holdStart = 0;
            timerState.ready = false;
            display.className = 'timer-display';
        }
    });
}
