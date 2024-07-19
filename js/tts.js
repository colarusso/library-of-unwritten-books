const wordsPerMinute = localStorage.getItem('wpm') || 175;

var voices = window.speechSynthesis.getVoices();

var speaking = 0;

var sayit = function(text) {
    var msg = new SpeechSynthesisUtterance();

    msg.voiceURI = 'native';
    msg.volume = 1; // 0 to 1
    msg.rate = localStorage.getItem('wpm')/175; //$('#rate').val(); // 0.1 to 10
    msg.pitch = 1; //0 to 2
    //msg.lang = 'en-US' //$('#lang').val();
    msg.text = text;

    msg.onstart = function(event) {
        speaking = 1;
    };
    msg.onend = function(event) {
        console.log('Finished in ' + event.elapsedTime + ' seconds.');
        if (speechSynthesis.speaking === false) {
            speaking = 0;
        }
    };
    msg.onerror = function(event) {
        console.log('Errored ' + event);
        speaking = 0;
    };
    msg.onpause = function(event) {
        console.log('paused ' + event);
    };
    msg.onboundary = function(event) {
        console.log('onboundary ' + event);
    };
    return msg;
}

var talk = function(text) {
    var sentences = text.match(/[^\.!\?]+[\.!\?]+/g);

    speechSynthesis.cancel(); // if it errors, this clears out the error.

    if (sentences.length > 0) {
        var toSay = sayit(sentences[0]);
        speechSynthesis.speak(toSay);
    }

    for (var i = 1; i < sentences.length; i++) {
        var toSay = sayit(sentences[i]);
        speechSynthesis.speak(toSay);
    }
}

var stop_talk = function() {
    speaking = 0;
    speechSynthesis.cancel();
}

var audio_play = function(text) {
    if (speaking == 0) {
        talk(text);
    } else {
        stop_talk();
    }
}
