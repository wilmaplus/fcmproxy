const { register, listen } = require('push-receiver');
const { WebSocketServer } = require('ws');

const FCM_PATH = process.env.FCM_PATH || "./fcm_cred.json";
const SENDER_ID = process.env.SENDER_ID
const WEBSOCKET_PORT = process.env.WS_PORT || 8082
const fs = require('fs');

const wss = new WebSocketServer({
    port: WEBSOCKET_PORT
});

const getFCMCredentials = async () => {
    if (!fs.existsSync(FCM_PATH)) {
        const credentials = await register(SENDER_ID);
        fs.writeFileSync(FCM_PATH, JSON.stringify(credentials));
        wss.clients.forEach(client => {
            client.send(JSON.stringify({credentials}));
        })
        return credentials;
    } else {
        return JSON.parse(fs.readFileSync(FCM_PATH).toString('utf-8'));
    }
}

let persistentIds = []
let listenerStarted = false;
let notificationQueue = [];

const handlePersistentIdReceive = async (receivedIds) => {
    persistentIds = receivedIds
    console.log("Received Persistent IDs!");
    if (!listenerStarted) {
        await startFCMListener()
    } else if (notificationQueue.length > 0) {
        console.log("Clearing queue");
        notificationQueue.forEach(notification => {
            wss.clients.forEach(client => {
                client.send(JSON.stringify(notification));
            })
        })
        notificationQueue = [];
        console.log("Queue cleared");
    }
}

const startFCMListener = async () => {
    const credentials = await getFCMCredentials()
    await listen({ ...credentials, persistentIds}, onNotification);
    console.log("Listening for FCM messages...");
    listenerStarted = true;
    function onNotification({ notification, persistentId }) {
        console.log(notification, persistentId);
        persistentIds.push(persistentId)
        // Broadcast new FCM message
        if (wss.clients.size > 0) {
            wss.clients.forEach(client => {
                client.send(JSON.stringify({notification, persistentId}));
            })
        } else {
            notificationQueue.push({notification, persistentId});
        }
    }
}

wss.on('connection', (ws) => {
    ws.on('message', (data) => {
        try {
            let jsonData = JSON.parse(data.toString('utf-8'))
            if (jsonData.request) {
                if (jsonData.success) {
                    switch (jsonData.request) {
                        case 'get-persistent-ids':
                            handlePersistentIdReceive(jsonData.response);
                    }
                } else {
                    console.error("Client responded with error", jsonData)
                }
            }
        } catch (e) {
            console.error("Error while processing message:", e)
        }
    })
    ws.send(JSON.stringify({request: 'get-persistent-ids'}));
});

