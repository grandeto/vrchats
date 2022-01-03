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

var ioToken = function() {
    return getCookie('auth_token');
};

var ioUserId = function() {
    return getCookie('chat_uuid');
};

var ioServer = function() {
    return getCookie('chat_server');
}

var ioEnv = function() {
    return getCookie('io_env');
}

var ioIsAdmin = function() {
    return getCookie('io_is_admin');
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
        if (ioEnv() == 'dev' || ioIsAdmin()) {
            console.error(err.message);
        }
    });
}
