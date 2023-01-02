const getCookie = function(cname) {
    var name = cname + "="
    var ca = document.cookie.split(';')

    for(var i = 0; i < ca.length; i++) {
      var c = ca[i]

      while (c.charAt(0) == ' ') {
        c = c.substring(1)
      }

      if (c.indexOf(name) == 0) {
        return c.substring(name.length, c.length)
      }
    }

    return ""
}

const ioToken = function() {
    return getCookie('auth_token')
}

const ioUserId = function() {
    return getCookie('chat_uuid')
}

const ioServer = function() {
    return getCookie('chat_server')
}

if (ioToken() && ioUserId() && ioServer()) {
    const socket = io(ioServer(), {
        upgrade: true,
        rememberUpgrade: true,
        secure: true,
        rejectUnauthorized: false, // ssl verify
        reconnectionDelay: 5000,
        reconnectionDelayMax: 10000,
        auth: {
            token: ioToken()
        }
    })

    socket.on(ioUserId(), (...args) => {
        // do something with the event data
        console.log('event', args[0]);
    });

    socket.on("connect_error", (err) => {
        console.error(err.message);
    });
}
