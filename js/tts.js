const DEFAULT_WPM = 175;
const MIN_WPM = 25;
const MAX_WPM = 800;
const TTS_VOICE_STORAGE_KEY = 'tts_voice';
const TTS_PREVIEW_TEXT = 'Testing, one, two, three.';

if (!localStorage.getItem('wpm')) {
    localStorage.setItem('wpm', DEFAULT_WPM);
}

function getStoredSpeechWpm() {
    const stored = Number(localStorage.getItem('wpm'));
    if (!Number.isFinite(stored) || stored <= 0) {
        return DEFAULT_WPM;
    }
    return Math.max(MIN_WPM, Math.min(MAX_WPM, stored));
}

function wpmToSpeechRate(wpm) {
    // Web Speech exposes a relative multiplier, not an absolute WPM target.
    // Treat the browser/voice's normal 1x rate as approximately DEFAULT_WPM.
    return Math.max(0.1, Math.min(10, Number(wpm) / DEFAULT_WPM));
}

var speaking = 0;

function getSpeechVoices() {
    if (!('speechSynthesis' in window)) {
        return [];
    }
    return window.speechSynthesis.getVoices() || [];
}

function voiceDescriptor(voice) {
    return {
        voiceURI: voice.voiceURI || '',
        name: voice.name || '',
        lang: voice.lang || ''
    };
}

function getStoredVoicePreference() {
    const stored = localStorage.getItem(TTS_VOICE_STORAGE_KEY);
    if (!stored) {
        return null;
    }

    try {
        return JSON.parse(stored);
    } catch (error) {
        // Older/hand-edited values may contain only a voiceURI.
        return { voiceURI: stored, name: '', lang: '' };
    }
}

function findPreferredVoice() {
    const preference = getStoredVoicePreference();
    if (!preference) {
        return null;
    }

    const voices = getSpeechVoices();
    return voices.find((voice) =>
        preference.voiceURI && voice.voiceURI === preference.voiceURI
    ) || voices.find((voice) =>
        preference.name && preference.lang &&
        voice.name === preference.name && voice.lang === preference.lang
    ) || voices.find((voice) =>
        preference.name && voice.name === preference.name
    ) || null;
}

function saveVoicePreference(value) {
    if (!value) {
        localStorage.removeItem(TTS_VOICE_STORAGE_KEY);
        return;
    }

    try {
        const descriptor = JSON.parse(value);
        localStorage.setItem(TTS_VOICE_STORAGE_KEY, JSON.stringify(descriptor));
    } catch (error) {
        // Ignore malformed option values and retain the current preference.
        console.warn('Unable to save text-to-speech voice preference.', error);
    }
}

function populateVoiceSelect(selectElement) {
    if (!selectElement) {
        return;
    }

    const preference = getStoredVoicePreference();
    const voices = getSpeechVoices().slice().sort((a, b) => {
        const langCompare = (a.lang || '').localeCompare(b.lang || '');
        return langCompare || (a.name || '').localeCompare(b.name || '');
    });

    selectElement.replaceChildren();

    const defaultOption = document.createElement('option');
    defaultOption.value = '';
    defaultOption.textContent = 'Browser default';
    selectElement.appendChild(defaultOption);

    for (const voice of voices) {
        const descriptor = voiceDescriptor(voice);
        const option = document.createElement('option');
        option.value = JSON.stringify(descriptor);
        option.textContent = `${voice.name}${voice.lang ? ` (${voice.lang})` : ''}${voice.default ? ' — default' : ''}`;

        if (preference && (
            (preference.voiceURI && descriptor.voiceURI === preference.voiceURI) ||
            (preference.name && preference.lang && preference.name === descriptor.name && preference.lang === descriptor.lang) ||
            (preference.name && !preference.lang && preference.name === descriptor.name)
        )) {
            option.selected = true;
        }

        selectElement.appendChild(option);
    }

    selectElement.disabled = voices.length === 0;
    if (voices.length === 0) {
        defaultOption.textContent = 'Browser default (no voices reported yet)';
    }
}

var sayit = function(text) {
    var msg = new SpeechSynthesisUtterance();
    const selectedVoice = findPreferredVoice();
    const storedWpm = getStoredSpeechWpm();

    if (selectedVoice) {
        msg.voice = selectedVoice;
        if (selectedVoice.lang) {
            msg.lang = selectedVoice.lang;
        }
    }

    msg.volume = 1; // 0 to 1
    msg.rate = wpmToSpeechRate(storedWpm); // 0.1 to 10, relative to this voice/platform
    msg.pitch = 1; // 0 to 2
    msg.text = String(text || '');

    msg.onstart = function() {
        speaking = 1;
    };
    msg.onend = function(event) {
        console.log('Finished in ' + event.elapsedTime + ' seconds.');
        if (speechSynthesis.speaking === false) {
            speaking = 0;
        }
    };
    msg.onerror = function(event) {
        console.log('Text-to-speech error:', event.error || event);
        speaking = 0;
    };
    return msg;
};

function chunkSpeechText(text, maxChars = 1200) {
    const sentences = String(text || '').match(/[^.!?]+(?:[.!?]+|$)/g) || [];
    const chunks = [];
    let current = '';

    const pushCurrent = () => {
        if (current.trim()) {
            chunks.push(current.trim());
            current = '';
        }
    };

    for (const rawSentence of sentences) {
        let sentence = rawSentence.trim();
        if (!sentence) continue;

        // Very long sentences still need to be bounded for browser TTS engines.
        while (sentence.length > maxChars) {
            const candidate = sentence.slice(0, maxChars);
            const splitAt = Math.max(candidate.lastIndexOf(' '), Math.floor(maxChars * 0.6));
            pushCurrent();
            chunks.push(sentence.slice(0, splitAt).trim());
            sentence = sentence.slice(splitAt).trim();
        }

        if (!current) {
            current = sentence;
        } else if ((current.length + 1 + sentence.length) <= maxChars) {
            current += ' ' + sentence;
        } else {
            pushCurrent();
            current = sentence;
        }
    }

    pushCurrent();
    return chunks;
}

var talk = function(text) {
    if (!('speechSynthesis' in window) || typeof SpeechSynthesisUtterance === 'undefined') {
        console.warn('Text-to-speech is not supported by this browser.');
        return;
    }

    text = String(text || '').replace(/Dr\./gi, 'Dr');
    const chunks = chunkSpeechText(text);

    speechSynthesis.cancel(); // Clearing the queue also clears many browser TTS errors.

    if (chunks.length === 0 && text.trim()) {
        chunks.push(text.trim());
    }

    for (const chunk of chunks) {
        speechSynthesis.speak(sayit(chunk));
    }
};

var stop_talk = function() {
    speaking = 0;
    if ('speechSynthesis' in window) {
        speechSynthesis.cancel();
    }
};

function previewSpeechSettings() {
    // Settings changes are direct user gestures, so cancel any existing speech and
    // immediately demonstrate the newly selected voice/rate without queueing previews.
    stop_talk();
    talk(TTS_PREVIEW_TEXT);
}

var audio_play = function(text) {
    if (speaking == 0) {
        talk(text);
    } else {
        stop_talk();
    }
};
