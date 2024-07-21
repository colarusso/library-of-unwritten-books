//var msg = `The library's creator is hosting a <a href="https://suffolklitlab.org/LITCon/2024/" target="_blank">hybrid event at Suffolk Law School</a> on April 8th on AI and law practice. Join us!`
msg = "";

function close_msg() {
    document.getElementById('msg_bar').style.display='none';
    localStorage.setItem('msg',msg)
}

document.addEventListener('DOMContentLoaded', function () {

    if (localStorage.msg != msg && msg != "") {
        document.getElementById('msg_bar').innerHTML = `<a href="javascript:close_msg();" class="ex">X</a>`+ msg;
        document.getElementById('msg_bar').style.display='block';    
    }

    const toggleModeButton = document.getElementById("toggle-mode");
  
    // Retrieve dark mode state from localStorage (if available)
    const darkModeState = localStorage.getItem("darkMode");
    if (darkModeState === "enabled") {
      document.body.classList.add("dark-mode");
        toggleModeButton.innerHTML = "💡"; // Light bulb emoji
    }
  
    // Toggle between light and dark mode
    toggleModeButton.addEventListener("click", function () {
      document.body.classList.toggle("dark-mode");
        if (document.body.classList.contains("dark-mode")) {
            localStorage.setItem("darkMode", "enabled");
            toggleModeButton.innerHTML = "💡"; // Light bulb emoji
        } else {
            localStorage.removeItem("darkMode");
            toggleModeButton.innerHTML = "🌗"; // Moon emoji
        }
    });

});
