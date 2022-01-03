require('@babel/polyfill');

const io = require('socket.io-client'),
    _require = require('broadcast-channel'),
    BroadcastChannel = _require.BroadcastChannel,
    createLeaderElection = _require.createLeaderElection,
    channelName = 'vrchats';
    channel = new BroadcastChannel(channelName),
    leaderElector = createLeaderElection(channel);

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
