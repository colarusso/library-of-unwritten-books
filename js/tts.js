var voices = window.speechSynthesis.getVoices();

var speaking = 0;

var sayit = function(sentences, i) {
    var msg = new SpeechSynthesisUtterance();

    msg.voiceURI = 'native';
    msg.volume = 1; // 0 to 1
    msg.rate = 1; //localStorage.getItem('wpm')/175; //$('#rate').val(); // 0.1 to 10
    msg.pitch = 1; //0 to 2
    //msg.lang = 'en-US' //$('#lang').val();
    msg.onstart = function(event) {
        speaking = 1;
    };
    msg.onend = function(event) {
        console.log('Finished in ' + event.elapsedTime + ' seconds.');
        // Check if there are more speeches queued, if not set speaking to 0
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
    sentences = text.match(/[^\.!\?]+[\.!\?]+/g);

    speechSynthesis.cancel(); // if it errors, this clears out the error.

    for (var i = 0; i < sentences.length; i++) {
        var toSay = sayit(sentences, i);
        toSay.text = sentences[i];
        speechSynthesis.speak(toSay);
    }
}

var stop_talk = function() {
    speechSynthesis.cancel();
    speaking = 0;
}

var audio_play = function(text) {
    if (speaking == 0) {
        talk(text);
    } else {
        stop_talk();
    }
}
