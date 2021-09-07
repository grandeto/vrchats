// cookies example

var getCookie = function(cname) {
    var name = cname + "=";
    var ca = document.cookie.split(';');
    for(var i = 0; i < ca.length; i++) {
      var c = ca[i];
      while (c.charAt(0) == ' ') {
        c = c.substring(1);
      }
      if (c.indexOf(name) == 0) {
        return c.substring(name.length, c.length);
      }
    }
    return "";
}

function setCookie(cname, cvalue, exdays) {
    var d = new Date();
    d.setTime(d.getTime() + (exdays * 24 * 60 * 60 * 1000));
    var expires = "expires="+d.toUTCString();
    document.cookie = cname + "=" + cvalue + ";" + expires + ";path=/;Secure=true;SameSite=Lax";
}

var ioToken = function() {
    return getCookie('chat_token');
};

var ioUserId = function() {
    return getCookie('user_chat_uuid');
};

var ioServer = function() {
    return getCookie('chat_server');
}

if (ioToken() != "" && ioUserId() != "" && ioServer() != "") {
    var socket = io(ioServer(), {
        upgrade: true,
        rememberUpgrade: true,
        secure: true,
        rejectUnauthorized: false, // ssl verify
        reconnectionDelay: 5000,
        reconnectionDelayMax: 10000,
        auth: {
            token: ioToken()
        }
    });

    socket.on(ioUserId(), (...args) => {
        // do something with the event data
        console.log('event', args[0]);
    });

    socket.on("connect_error", (err) => {
        if (err.message === "invalid token") {
            console.error('Invalid token');
            var chat_reload = getCookie('chat_reload');
            if (chat_reload == "" || +chat_reload < 6) {
                setCookie('chat_reload', +chat_reload+1, 1);
                setTimeout(function () {
                    location.reload();
                }, 5000);
            } else {
                setTimeout(function () {
                    setCookie('chat_reload', "", -1);
                    location.reload();
                }, 600000);
            }
        }
    });
}
