require('@babel/polyfill');

const io = require('socket.io-client'),
    _require = require('broadcast-channel'),
    BroadcastChannel = _require.BroadcastChannel,
    createLeaderElection = _require.createLeaderElection,
    channelName = 'vrchats';
    channel = new BroadcastChannel(channelName),
    leaderElector = createLeaderElection(channel);

const getCookie = function(cname) {
        let name = cname + '=';
        let ca = document.cookie.split(';');
        for(let i = 0; i < ca.length; i++) {
            let c = ca[i];
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
        let d = new Date();
        d.setTime(d.getTime() + (exdays * 24 * 60 * 60 * 1000));
        let expires = 'expires='+d.toUTCString();
        document.cookie = cname + '=' + cvalue + ';' + expires + ';path=/;Secure=true;SameSite=Lax';
    };

channel.onmessage = msg => {
    let newMsgsElement = msg.newMsgsElement,
        chatStreamElement = msg.chatStreamElement;

    handleMsg(newMsgsElement, chatStreamElement, msg)
};

leaderElector.awaitLeadership().then(function () {
    let ioToken,
        ioUserId,
        ioServer,
        xhr = new XMLHttpRequest(),
        res;

    xhr.withCredentials = true;
    xhr.addEventListener('readystatechange', function() {
        if(this.readyState === 4) {
            res = JSON.parse(this.responseText);
            ioToken = res.authToken;
            ioUserId = res.chatUuid;
            ioServer = res.chatServer;

            if (ioToken && ioUserId && ioServer) {
                let socket = io(ioServer, {
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
                    let msg = Object.assign({}, args[0]);

                    handleMsg(res.newMsgsElement, res.chatStreamElement, args[0]);

                    msg.newMsgsElement = res.newMsgsElement;
                    msg.chatStreamElement = res.chatStreamElement;

                    channel.postMessage(msg);
                });

                socket.on('connect_error', (err) => {
                    if (res.env == 'dev' || res.isAdmin) {
                        console.error(err.message);
                    } else if (err.message == 'invalid token') {
                        let chat_reload = getCookie('chat_reload');
                        if (chat_reload == '' || +chat_reload < 6) {
                            setCookie('chat_reload', +chat_reload+1, 1);
                            setTimeout(function () {
                                location.reload();
                            }, 5000); // 5s
                        } else {
                            setTimeout(function () {
                                setCookie('chat_reload', '', -1);
                                location.reload();
                            }, 600000); // 10m
                        }
                    }
                });
            }
        }
    });
    xhr.open('GET', document.location.origin + '/vrchats/resources');
    xhr.send();
});

function handleMsg(newMsgsElement, chatStreamElement, msg) {
    delete msg.newMsgsElement;
    delete msg.chatStreamElement;

    if (msg.type == 'inbox') {
        document.title = document.title.split(' ')[0] + ' +1 new msg'

        let newMsgsEl = document.querySelector(newMsgsElement);

        if (newMsgsEl) {
            newMsgsEl.innerText = 'new';
        }
    }

    let appElement = document.querySelector(chatStreamElement);

    if (appElement) {
        let appScope = angular.element(appElement).scope(),
            controllerScope = appScope.$$childHead;

        if (msg.type == 'inbox' && controllerScope.currentContactId != msg.from_user_id) {
            return;
        }

        if (msg.type == 'sent' && controllerScope.currentContactId != msg.to_user_id) {
            return;
        }

        if (!controllerScope.messages[msg.id]) {
            let newMsg = {};
            newMsg[msg.id] = msg;

            controllerScope.$apply(function() {
                controllerScope.messages = Object.assign(controllerScope.messages, newMsg);
            });
        }
    }
}
