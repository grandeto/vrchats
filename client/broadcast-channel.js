require('@babel/polyfill');

var io = require('socket.io-client'),
    _require = require('broadcast-channel'),
    BroadcastChannel = _require.BroadcastChannel,
    createLeaderElection = _require.createLeaderElection,
    channelName = 'vrchats';
    channel = new BroadcastChannel(channelName),
    leaderElector = createLeaderElection(channel);

var getCookie = function(cname) {
        var name = cname + '=';
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
        return '';
    },
    setCookie = function(cname, cvalue, exdays) {
        var d = new Date();
        d.setTime(d.getTime() + (exdays * 24 * 60 * 60 * 1000));
        var expires = 'expires='+d.toUTCString();
        document.cookie = cname + '=' + cvalue + ';' + expires + ';path=/;Secure=true;SameSite=Lax';
    };

channel.onmessage = msg => console.log('msg received', msg);

leaderElector.awaitLeadership().then(function () {
    console.log('is leader');
    document.title = '♛ Is Leader!';

    var ioToken,
        ioUserId,
        ioServer,
        xhr = new XMLHttpRequest(),
        res;

    xhr.withCredentials = true;
    xhr.addEventListener('readystatechange', function() {
        if(this.readyState === 4) {
            res = JSON.parse(this.responseText);
            ioToken = res.auth_token;
            ioUserId = res.chat_uuid;
            ioServer = res.chat_server;

            if (ioToken && ioUserId && ioServer) {
                var socket = io(ioServer, {
                    upgrade: true,
                    secure: true,
                    rejectUnauthorized: true, // ssl verify
                    reconnectionDelay: 10000,
                    reconnectionDelayMax: 20000,
                    query: {
                        uniqueUserId: ioUserId
                    },
                    auth: {
                        token: ioToken
                    }
                });

                socket.on(ioUserId, (...args) => {
                    // do something with the event data
                    console.log('event handled by leader', args[0]);
                    channel.postMessage(args[0]);
                });

                socket.on('connect_error', (err) => {
                    switch (err.message) {
                        case 'rate limit block':
                            console.error(err.message);
                            break;
                        case 'invalid token':
                            console.error(err.message);
                            var chat_reload = getCookie('chat_reload');
                            if (chat_reload == '' || +chat_reload < 6) {
                                setCookie('chat_reload', +chat_reload+1, 1);
                                setTimeout(function () {
                                    location.reload();
                                }, 5000);
                            } else {
                                setTimeout(function () {
                                    setCookie('chat_reload', '', -1);
                                    location.reload();
                                }, 600000);
                            }
                            break;
                        default:
                          console.error('error:', err.message);
                          break;
                    }
                });
            }
        }
    });
    xhr.open('GET', document.location.origin + '/vrchats/resources');
    xhr.send();
});
